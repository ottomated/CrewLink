import { app, dialog, ipcMain } from 'electron';
import path from 'path';
import yml from 'js-yaml';
// import * as Struct from 'structron';
import { HKEY, enumerateValues } from 'registry-js';
import spawn from 'cross-spawn';
import GameReader from './GameReader';
import iohook from 'iohook';
import Store from 'electron-store';
import { ISettings } from '../common/ISettings';
import axios, { AxiosError } from 'axios';
import { createCheckers } from 'ts-interface-checker';

import TI from './hook-ti';
import { IOffsetsContainer } from './IOffsets';
const {  IOffsetsContainer } = createCheckers(TI);
// import { overlayWindow } from 'electron-overlay-window';

interface IOHookEvent {
  type: string
  keychar?: number
  keycode?: number
  rawcode?: number
  button?: number
  clicks?: number
  x?: number
  y?: number
}

const store = new Store<ISettings>();

async function loadOffsets(event: Electron.IpcMainEvent): Promise<IOffsetsContainer | undefined> {
	let version = 'offsets_new'
	let data: string;
	// const offsetStore = store.get('offsets') || {};
	// if (version === offsetStore.version) {
	// 	data = offsetStore.data;
	// } else 
	{
		try {
			const response = await axios({
			url: `http://crewlink.guus.info/offsets.yml`
			});
			data = response.data;
		} catch (_e) {
			const e = _e as AxiosError;
			console.error(e);
			if (e?.response?.status === 404) {
				event.reply('error', `You are on an unsupported voice server: ${version}.\n`);
			} else {
				let errorMessage = e.message;
				if (errorMessage.includes('ETIMEDOUT')) {
					errorMessage = 'has too many active players';
				} else if (errorMessage.includes('refuesed')) {
					errorMessage = 'is not input correctly';
				} else {
					errorMessage = 'gave this error: \n' + errorMessage;
				}
				event.reply('error', `Please use another voice server. ${store.get('serverURL')} ${errorMessage}.`);
			}
			return;
		}
	}

	const offsets: IOffsetsContainer = yml.safeLoad(data) as unknown as IOffsetsContainer;
	try {
		IOffsetsContainer.check(offsets);
		if (!version) {
			event.reply('error', 'Couldn\'t determine the Among Us version. Try opening Among Us and then restarting CrewLink.');
			return;
		} else {
			store.set('offsets', {
				version,
				data
			});
		}
		return offsets;
	} catch (e) {
		console.error(e);
		event.reply('error', `Couldn't parse the latest game offsets from the server: ${store.get('serverURL')}/${version}.yml.\n${e}`);
		return;
	}

}

let readingGame = false;
let gameReader: GameReader;

ipcMain.on('start', async (event) => {
	const offsets = await loadOffsets(event);
	if (!readingGame && offsets) {
		readingGame = true;

		// Register key events
		iohook.on('keydown', (ev: IOHookEvent) => {
			const shortcutKey = store.get('pushToTalkShortcut');
			if (keyCodeMatches(shortcutKey as K, ev)) {
				event.reply('pushToTalk', true);
			}
		});
		iohook.on('keyup', (ev: IOHookEvent) => {
			const shortcutKey = store.get('pushToTalkShortcut');
			if (keyCodeMatches(shortcutKey as K, ev)) {
				event.reply('pushToTalk', false);
			}
			if (keyCodeMatches(store.get('deafenShortcut') as K, ev)) {
				event.reply('toggleDeafen');
			}
		});

		iohook.start();

		// Read game memory
		gameReader = new GameReader(event.reply as (event: string, ...args: unknown[]) => void, offsets);

		ipcMain.on('initState', (event: Electron.IpcMainEvent) => {
			event.returnValue = gameReader.lastState;
		});

		const frame = () => {
			gameReader.loop();
			setTimeout(frame, 1000 / 20);
		};
		frame();
	} else if (gameReader) {
		gameReader.amongUs = null;
	}
	event.reply('started');
});

ipcMain.on('reload', async => {
	global.mainWindow?.reload();
	//overlayWindow?.hide();
	//global.overlay?.reload();
	//setTimeout(function() {	overlayWindow?.show(); }.bind(this), 1000); // let it load fr a second
});

const keycodeMap = {
	'Space': 57, 'Backspace': 14, 'Delete': 61011, 'Enter': 28, 'Up': 61000, 'Down': 61008, 'Left': 61003, 'Right': 61005, 'Home': 60999, 'End': 61007, 'PageUp': 61001, 'PageDown': 61009, 'Escape': 1, 'LControl': 29, 'LShift': 42, 'LAlt': 56, 'RControl': 3613, 'RShift': 54, 'RAlt': 3640,
	'F1': 59,
	'F2': 60,
	'F3': 61,
	'F4': 62,
	'F5': 63,
	'F6': 64,
	'F7': 65,
	'F8': 66,
	'F9': 67,
	'F10': 68,
	'F11': 87,
	'F12': 88,
};
type K = keyof typeof keycodeMap;

function keyCodeMatches(key: K, ev: IOHookEvent): boolean {
	if (keycodeMap[key])
		return keycodeMap[key] === ev.keycode;
	else if (key.length === 1)
		return key.charCodeAt(0) === ev.rawcode;
	else {
		console.error('Invalid key', key);
		return false;
	}
}



ipcMain.on('openGame', () => {
	// Get steam path from registry
	const steamPath = enumerateValues(HKEY.HKEY_LOCAL_MACHINE,
		'SOFTWARE\\WOW6432Node\\Valve\\Steam')
		.find(v => v.name === 'InstallPath');
	// Check if Steam is installed
	if (!steamPath) {
		dialog.showErrorBox('Error', 'Could not find your Steam install path.');
	} else {
		try {
			const process = spawn(path.join(steamPath.data as string, 'steam.exe'), [
				'-applaunch',
				'945360'
			]);
			process.on('error', () => {
				dialog.showErrorBox('Error', 'Please launch the game through Steam.');
			});
		} catch (e) {
			dialog.showErrorBox('Error', 'Please launch the game through Steam.');
		}
	}
});

ipcMain.on('relaunch', () => {
	app.relaunch();
	app.quit();
});
