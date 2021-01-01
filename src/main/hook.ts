import { ipcMain } from 'electron';
import GameReader from './GameReader';
// import iohook from 'iohook';
import { keyboardWatcher } from 'node-keyboard-watcher';
import Store from 'electron-store';
import { ISettings } from '../common/ISettings';
import {
	IpcHandlerMessages,
	IpcRendererMessages,
	IpcSyncMessages,
} from '../common/ipc-messages';
import { overlayWindow } from 'electron-overlay-window';

const store = new Store<ISettings>({ watch: true });
store.onDidAnyChange(resetKeyHooks);
let readingGame = false;
let gameReader: GameReader;

function resetKeyHooks(): void {
	keyboardWatcher.clearKeyHooks();
	AddKeyHanlder(store.get('pushToTalkShortcut') as K);
	AddKeyHanlder(store.get('deafenShortcut') as K);
	AddKeyHanlder(store.get('muteShortcut') as K);
}

ipcMain.on(IpcSyncMessages.GET_INITIAL_STATE, (event) => {
	if (!readingGame) {
		console.error(
			'Recieved GET_INITIAL_STATE message before the START_HOOK message was received'
		);
		event.returnValue = null;
		return;
	}
	event.returnValue = gameReader.lastState;
});

ipcMain.handle(IpcHandlerMessages.START_HOOK, async (event) => {
	if (!readingGame) {
		readingGame = true;
		resetKeyHooks();

		keyboardWatcher.on('keydown', (keyId: number) => {
			if (keyCodeMatches(store.get('pushToTalkShortcut') as K, keyId)) {
				event.sender.send(IpcRendererMessages.PUSH_TO_TALK, true);
			}
		});

		keyboardWatcher.on('keyup', (keyId: number) => {
			if (keyCodeMatches(store.get('pushToTalkShortcut') as K, keyId)) {
				event.sender.send(IpcRendererMessages.PUSH_TO_TALK, false);
			}
			if (keyCodeMatches(store.get('deafenShortcut') as K, keyId)) {
				event.sender.send(IpcRendererMessages.TOGGLE_DEAFEN);
			}
			if (keyCodeMatches(store.get('muteShortcut', 'RAlt') as K, keyId)) {
				event.sender.send(IpcRendererMessages.TOGGLE_MUTE);
			}
		});

		keyboardWatcher.start();

		// Read game memory
		gameReader = new GameReader(event.sender.send.bind(event.sender));
		const frame = () => {

			const err = gameReader.loop();
			if (err) {
				readingGame = false;
				event.sender.send(IpcRendererMessages.ERROR, err);
			} else {
				setTimeout(frame, 1000 / 5);
			}
		};
		frame();
	} else if (gameReader) {
		gameReader.amongUs = null;
	}
});

ipcMain.on('reload', async () => {
	global.mainWindow?.reload();
	overlayWindow?.hide();
	global.overlay?.reload();
	setTimeout(
		function () {
			overlayWindow?.show();
		}.bind(this),
		1000
	); // let it load fr a second
});

const keycodeMap = {
	Space: 0x20,
	Backspace: 0x08,
	Delete: 0x2e,
	Enter: 0x0d,
	Up: 0x26,
	Down: 0x28,
	Left: 0x24,
	Right: 0x27,
	Home: 0x24,
	End: 0x23,
	PageUp: 0x21,
	PageDown: 0x22,
	Escape: 0x1b,
	LControl: 0x11,
	LShift: 0x10,
	LAlt: 0x12,
	RControl: 0x11,
	RShift: 0x10,
	RAlt: 0x12,
	F1: 0x70,
	F2: 0x71,
	F3: 0x72,
	F4: 0x73,
	F5: 0x74,
	F6: 0x75,
	F7: 0x76,
	F8: 0x77,
	F9: 0x78,
	F10: 0x79,
	F11: 0x7a,
	F12: 0x7b,
	MouseButton4: 0x05,
	MouseButton5: 0x06,
};
type K = keyof typeof keycodeMap;

function keyCodeMatches(key: K, keyId: number): boolean {
	if (keycodeMap[key]) return keycodeMap[key] === keyId;
	else if (key && key.length === 1) return key.charCodeAt(0) === keyId;
	else {
		console.error('Invalid key', key);
		return false;
	}
}

function AddKeyHanlder(key: K) {
	if (keycodeMap[key]) {
		keyboardWatcher.addKeyHook(keycodeMap[key]);
	} else if (key && key.length === 1) {
		keyboardWatcher.addKeyHook(key.charCodeAt(0));
	}
}
