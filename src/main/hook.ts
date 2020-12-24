import { app, dialog, ipcMain } from 'electron';
import path from 'path';
// import * as Struct from 'structron';
import { HKEY, enumerateValues } from 'registry-js';
import spawn from 'cross-spawn';
import GameReader from './GameReader';
import iohook from 'iohook';
import Store from 'electron-store';
import { ISettings } from '../common/ISettings';

interface IOHookEvent {
	type: string;
	keychar?: number;
	keycode?: number;
	rawcode?: number;
	button?: number;
	clicks?: number;
	x?: number;
	y?: number;
}

const store = new Store<ISettings>();

let readingGame = false;
let gameReader: GameReader;

ipcMain.on('start', async (event) => {
	if (!readingGame) {
		readingGame = true;

		// Register key events
		iohook.on('keydown', (ev: IOHookEvent) => {
			const shortcutKey = store.get('pushToTalkShortcut');
			if (!isMouseButton(shortcutKey) && keyCodeMatches(shortcutKey as K, ev)) {
				event.reply('pushToTalk', true);
			}
		});
		iohook.on('keyup', (ev: IOHookEvent) => {
			const shortcutKey = store.get('pushToTalkShortcut');
			if (!isMouseButton(shortcutKey) && keyCodeMatches(shortcutKey as K, ev)) {
				event.reply('pushToTalk', false);
			}
			if (
				!isMouseButton(store.get('deafenShortcut')) &&
				keyCodeMatches(store.get('deafenShortcut') as K, ev)
			) {
				event.reply('toggleDeafen');
			}
			if (keyCodeMatches(store.get('muteShortcut', 'RAlt') as K, ev)) {
				event.reply('toggleMute');
			}
		});

		// Register mouse events
		iohook.on('mousedown', (ev: IOHookEvent) => {
			const shortcutMouse = store.get('pushToTalkShortcut');
			if (
				isMouseButton(shortcutMouse) &&
				mouseClickMatches(shortcutMouse as M, ev)
			) {
				event.reply('pushToTalk', true);
			}
		});
		iohook.on('mouseup', (ev: IOHookEvent) => {
			const shortcutMouse = store.get('pushToTalkShortcut');
			if (
				isMouseButton(shortcutMouse) &&
				mouseClickMatches(shortcutMouse as M, ev)
			) {
				event.reply('pushToTalk', false);
			}
		});

		iohook.start();

		// Read game memory
		gameReader = new GameReader(
			event.reply as (event: string, ...args: unknown[]) => void
		);

		ipcMain.on('initState', (event: Electron.IpcMainEvent) => {
			event.returnValue = gameReader.lastState;
		});
		const frame = () => {
			const err = gameReader.loop();
			if (err) {
				readingGame = false;
				event.reply('error', err);
			} else {
				setTimeout(frame, 1000 / 20);
			}
		};
		frame();
	} else if (gameReader) {
		gameReader.amongUs = null;
	}
	event.reply('started');
});

const keycodeMap = {
	Space: 57,
	Backspace: 14,
	Delete: 61011,
	Enter: 28,
	Up: 61000,
	Down: 61008,
	Left: 61003,
	Right: 61005,
	Home: 60999,
	End: 61007,
	PageUp: 61001,
	PageDown: 61009,
	Escape: 1,
	LControl: 29,
	LShift: 42,
	LAlt: 56,
	RControl: 3613,
	RShift: 54,
	RAlt: 3640,
	F1: 59,
	F2: 60,
	F3: 61,
	F4: 62,
	F5: 63,
	F6: 64,
	F7: 65,
	F8: 66,
	F9: 67,
	F10: 68,
	F11: 87,
	F12: 88,
};
type K = keyof typeof keycodeMap;

function keyCodeMatches(key: K, ev: IOHookEvent): boolean {
	if (keycodeMap[key]) return keycodeMap[key] === ev.keycode;
	else if (key.length === 1) return key.charCodeAt(0) === ev.rawcode;
	else {
		console.error('Invalid key', key);
		return false;
	}
}

const mouseClickMap = {
	MouseButton4: 4,
	MouseButton5: 5,
	MouseButton6: 6,
	MouseButton7: 7,
};

type M = keyof typeof mouseClickMap;

function mouseClickMatches(key: M, ev: IOHookEvent): boolean {
	if (mouseClickMap[key]) return mouseClickMap[key] === ev.button;
	return false;
}

function isMouseButton(shortcutKey: string): boolean {
	return shortcutKey.includes('MouseButton');
}

ipcMain.on('openGame', () => {
	// Get steam path from registry
	const steamPath = enumerateValues(
		HKEY.HKEY_LOCAL_MACHINE,
		'SOFTWARE\\WOW6432Node\\Valve\\Steam'
	).find((v) => v.name === 'InstallPath');
	// Check if Steam is installed
	if (!steamPath) {
		dialog.showErrorBox('Error', 'Could not find your Steam install path.');
	} else {
		try {
			const process = spawn(path.join(steamPath.data as string, 'steam.exe'), [
				'-applaunch',
				'945360',
			]);
			process.on('error', () => {
				dialog.showErrorBox('Error', 'Please launch the game manually.');
			});
		} catch (e) {
			dialog.showErrorBox('Error', 'Please launch the game manually.');
		}
	}
});

ipcMain.on('relaunch', () => {
	app.relaunch();
	app.quit();
});
