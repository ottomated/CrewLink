import { ipcMain } from 'electron';
import GameReader from './GameReader';
import iohook from 'iohook';
import Store from 'electron-store';
import { ISettings } from '../common/ISettings';
import {
	IpcHandlerMessages,
	IpcRendererMessages,
	IpcSyncMessages,
} from '../common/ipc-messages';

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

		// Register key events
		iohook.on('keydown', (ev: IOHookEvent) => {
			const shortcutKey = store.get('pushToTalkShortcut');
			if (!isMouseButton(shortcutKey) && keyCodeMatches(shortcutKey as K, ev)) {
				try {
					event.sender.send(IpcRendererMessages.PUSH_TO_TALK, true);
				} catch (_) {}
			}
		});
		iohook.on('keyup', (ev: IOHookEvent) => {
			const shortcutKey = store.get('pushToTalkShortcut');
			if (!isMouseButton(shortcutKey) && keyCodeMatches(shortcutKey as K, ev)) {
				try {
					event.sender.send(IpcRendererMessages.PUSH_TO_TALK, false);
				} catch (_) {}
			}
			if (
				!isMouseButton(store.get('deafenShortcut')) &&
				keyCodeMatches(store.get('deafenShortcut') as K, ev)
			) {
				try {
					event.sender.send(IpcRendererMessages.TOGGLE_DEAFEN);
				} catch (_) {}
			}
			if (keyCodeMatches(store.get('muteShortcut', 'RAlt') as K, ev)) {
				try {
					event.sender.send(IpcRendererMessages.TOGGLE_MUTE);
				} catch (_) {}
			}
		});

		// Register mouse events
		iohook.on('mousedown', (ev: IOHookEvent) => {
			const shortcutMouse = store.get('pushToTalkShortcut');
			if (
				isMouseButton(shortcutMouse) &&
				mouseClickMatches(shortcutMouse as M, ev)
			) {
				try {
					event.sender.send(IpcRendererMessages.PUSH_TO_TALK, true);
				} catch (_) {}
			}
		});
		iohook.on('mouseup', (ev: IOHookEvent) => {
			const shortcutMouse = store.get('pushToTalkShortcut');
			if (
				isMouseButton(shortcutMouse) &&
				mouseClickMatches(shortcutMouse as M, ev)
			) {
				try {
					event.sender.send(IpcRendererMessages.PUSH_TO_TALK, false);
				} catch (_) {}
			}
			if (
				isMouseButton(store.get('deafenShortcut')) &&
				mouseClickMatches(store.get('deafenShortcut') as M, ev)
			) {
				try {
					event.sender.send(IpcRendererMessages.TOGGLE_DEAFEN);
				} catch (_) {}
			}
			if (
				isMouseButton(store.get('muteShortcut', 'RAlt')) &&
				mouseClickMatches(store.get('muteShortcut', 'RAlt') as M, ev)
			) {
				try {
					event.sender.send(IpcRendererMessages.TOGGLE_MUTE);
				} catch (_) {}
			}
		});

		iohook.start();

		// Read game memory
		gameReader = new GameReader(event.sender.send.bind(event.sender));

		const frame = () => {
			const err = gameReader.loop();
			if (err) {
				readingGame = false;
				event.sender.send(IpcRendererMessages.ERROR, err);
			} else {
				setTimeout(frame, 1000 / 20);
			}
		};
		frame();
	} else if (gameReader) {
		gameReader.amongUs = null;
	}
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
	else if (key && key.length === 1) return key.charCodeAt(0) === ev.rawcode;
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
