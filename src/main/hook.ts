import { app, dialog, ipcMain } from 'electron';
import path, { resolve } from 'path';
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
import { existsSync, readFileSync } from 'fs';
import { IOffsets } from './IOffsets';
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

async function validateServer(serverURL: string, gameVersion: string): Promise<string | undefined> {
	try {
		const response = await axios({
			url: `${serverURL}/health`
		});

		const json = response.data;

		if (typeof json !== 'object') {
			return 'The server did not respond to our health check in a way we expected. Please use a different server.';
		}

		if (!('supportedVersions' in json)) {
			return;
		}

		if (!json.supportedVersions.includes(gameVersion)) {
			return `This server does not support this game version: ${gameVersion}`;
		}

		return;
	} catch (_healthE) {
		const healthE = _healthE as AxiosError;

		const status = healthE?.response?.status;

		if (status) {
			// When we get a valid response, we need to validate the status of it.
			if (status === 404) {
				// When the URL 404s, it's an unsupported crewlink version, or not a crewlink server at all.
				return 'The specified server url is not a valid CrewLink server.\nThis usually means either the server is out of date, or not a CrewLink server at all.';
			} else if (status >= 500 && status <= 504 || status >= 520 && status <= 524) {
				return 'This server is currently experiencing an outage. Please try a different server.';
			}
		}

		let errorMessage = healthE.message;

		if (errorMessage.includes('ETIMEDOUT')) {
			// Case occurs when the server does not respond, and has no information. This happens mostly with incorrect servers/ports/port forwarding.
			errorMessage = 'Server connection timed out.\nIf this is your server, this usually means the server did not respond to a connection. This usually happens with port forwarding issues.';
		} else if (errorMessage.includes('refused')) {
			// Case occurs when the server responds, but denies the connection. Usually firewall on the server.
			errorMessage = 'Server is not accepting connections, either due to a firewall or rate limit.';
		} else {
			errorMessage = 'Server gave this error: \n' + errorMessage;
		}

		return errorMessage;
	}
}

async function loadOffsets(event: Electron.IpcMainEvent): Promise<IOffsets | undefined> {

	const valuesFile = resolve((process.env.LOCALAPPDATA || '') + 'Low', 'Innersloth/Among Us/Unity/6b8b0d91-4a20-4a00-a3e4-4da4a883a5f0/Analytics/values');
	let version = '';
	if (existsSync(valuesFile)) {
		try {
			const json = JSON.parse(readFileSync(valuesFile, 'utf8'));
			version = json.app_ver;
		} catch (e) {
			console.error(e);
			event.reply('error', `Couldn't determine the Among Us version - ${e}. Try opening Among Us and then restarting CrewLink.`);
			return;
		}
	} else {
		event.reply('error', 'Couldn\'t determine the Among Us version - Unity analytics file doesn\'t exist. Try opening Among Us and then restarting CrewLink.');
		return;
	}

	let data: string;
	const offsetStore = store.get('offsets') || {};
	if (version === offsetStore.version) {
		data = offsetStore.data;
	} else {
		const serverURL = store.get('serverURL');

		let errorMessage = await validateServer(serverURL, version);

		if (errorMessage) {
			event.reply('error', errorMessage);
			return;
		}

		try {
			const response = await axios({
				url: `${serverURL}/${version}.yml`
			});
			data = response.data;
		} catch (_e) {
			const e = _e as AxiosError;
			console.error(e);
			if (e?.response?.status === 404) {
				event.reply('error', `You are on an unsupported version of Among Us: ${version}.\n`);
			} else {
				let errorMessage = e.message;
				if (errorMessage.includes('ETIMEDOUT')) {
					errorMessage = 'has too many active players';
				} else if (errorMessage.includes('refuesed')) {
					errorMessage = 'is not input correctly';
				} else {
					errorMessage = 'gave this error: \n' + errorMessage;
				}
				event.reply('error', `Please use another voice server. ${serverURL} ${errorMessage}.`);
			}
			return;
		}
	}

	const offsets: IOffsets = yml.safeLoad(data) as unknown as IOffsets;
	try {
		IOffsets.check(offsets);
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
