import { ipcMain } from 'electron';
import { resolve } from 'path';
import yml from 'js-yaml';
// import * as Struct from 'structron';
import GameReader from './GameReader';
import iohook from 'iohook';
import Store from 'electron-store';
import { ISettings } from '../common/ISettings';
import axios, { AxiosError } from 'axios';
import { createCheckers } from 'ts-interface-checker';

import TI from './hook-ti';
import { existsSync, readFileSync } from 'fs';
import { IOffsets } from './IOffsets';
import { IpcHandlerMessages, IpcRendererMessages, IpcSyncMessages } from '../common/ipc-messages';
const { IOffsets } = createCheckers(TI);

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

async function loadOffsets(): Promise<{ success: true; offsets: IOffsets } | { success: false; error: string }> {
	const valuesFile = resolve((process.env.LOCALAPPDATA || '') + 'Low', 'Innersloth/Among Us/Unity/6b8b0d91-4a20-4a00-a3e4-4da4a883a5f0/Analytics/values');

	let version = '';
	if (existsSync(valuesFile)) {
		try {
			const json = JSON.parse(readFileSync(valuesFile, 'utf8'));
			version = json.app_ver;
		} catch (e) {
			console.error(e);
			return { success: false, error: `Couldn't determine the Among Us version - ${e}. Try opening Among Us and then restarting CrewLink.` };
		}
	} else {
		return { success: false, error: 'Couldn\'t determine the Among Us version - Unity analytics file doesn\'t exist. Try opening Among Us and then restarting CrewLink.' };
	}

	let data: string;
	const offsetStore = store.get('offsets') || {};
	if (version === offsetStore.version) {
		data = offsetStore.data;
	} else {
		try {
			const response = await axios({
				url: `${store.get('serverURL')}/${version}.yml`
			});
			data = response.data;
		} catch (_e) {
			const e = _e as AxiosError;
			console.error(e);
			if (e?.response?.status === 404) {
				return { success: false, error: `You are on an unsupported version of Among Us: ${version}.\n` };
			} else {
				let errorMessage = e.message;
				if (errorMessage.includes('ETIMEDOUT')) {
					errorMessage = 'has too many active players';
				} else if (errorMessage.includes('refuesed')) {
					errorMessage = 'is not input correctly';
				} else {
					errorMessage = 'gave this error: \n' + errorMessage;
				}
				return { success: false, error: `Please use another voice server. ${store.get('serverURL')} ${errorMessage}.` };
			}
		}
	}

	const offsets: IOffsets = yml.safeLoad(data) as unknown as IOffsets;
	try {
		IOffsets.check(offsets);
		if (!version) {
			return { success: false, error: 'Couldn\'t determine the Among Us version. Try opening Among Us and then restarting CrewLink.' };
		} else {
			store.set('offsets', {
				version,
				data
			});
		}
		return { success: true, offsets };
	} catch (e) {
		console.error(e);
		return { success: false, error: `Couldn't parse the latest game offsets from the server: ${store.get('serverURL')}/${version}.yml.\n${e}` };
	}

}

let readingGame = false;
let gameReader: GameReader;

ipcMain.on(IpcSyncMessages.GET_INITIAL_STATE, (event) => {
	if (!readingGame) {
		console.error('Recieved GET_INITIAL_STATE message before the START_HOOK message was received');
		event.returnValue = null;
	}
	event.returnValue = gameReader.lastState;
});

/**
 * null indicates success, failures should return an error string
 */
ipcMain.handle(IpcHandlerMessages.START_HOOK, async (event): Promise<{ error: string } | null> => {
	const offsetsResults = await loadOffsets();
	if (!offsetsResults.success) {
		return { error: offsetsResults.error };
	}
	if (!readingGame) {
		readingGame = true;

		// Register key events
		iohook.on('keydown', (ev: IOHookEvent) => {
			const shortcutKey = store.get('pushToTalkShortcut');
			if (keyCodeMatches(shortcutKey as K, ev)) {
				event.sender.send(IpcRendererMessages.PUSH_TO_TALK, true);
			}
		});
		iohook.on('keyup', (ev: IOHookEvent) => {
			const shortcutKey = store.get('pushToTalkShortcut');
			if (keyCodeMatches(shortcutKey as K, ev)) {
				event.sender.send(IpcRendererMessages.PUSH_TO_TALK, false);
			}
			if (keyCodeMatches(store.get('deafenShortcut') as K, ev)) {
				event.sender.send(IpcRendererMessages.TOGGLE_DEAFEN);
			}
		});

		iohook.start();

		// Read game memory
		gameReader = new GameReader(event.sender.send.bind(event.sender), offsetsResults.offsets);

		const frame = () => {
			gameReader.loop();
			setTimeout(frame, 1000 / 20);
		};
		frame();
	} else if (gameReader) {
		gameReader.amongUs = null;
	}
	return null;
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
