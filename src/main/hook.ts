import { dialog, ipcMain } from 'electron';
import path, { resolve } from 'path';
import yml from 'js-yaml';
// import * as Struct from 'structron';
import { HKEY, enumerateValues } from 'registry-js';
import spawn from 'cross-spawn';
import GameReader from './GameReader';
import iohook from 'iohook';
import Store from 'electron-store';
import { ISettings } from '../renderer/Settings';
import axios from 'axios';
import { createCheckers } from 'ts-interface-checker';

import TI from './hook-ti';
import { existsSync, readFileSync } from 'fs';
const { IOffsets } = createCheckers(TI);

const store = new Store<ISettings>();

export interface IOffsets {
	meetingHud: number[];
	meetingHudCachePtr: number[];
	meetingHudState: number[];
	gameState: number[];
	allPlayersPtr: number[];
	allPlayers: number[];
	playerCount: number[];
	playerAddrPtr: number;
	exiledPlayerId: number[];
	gameCode: number[];
	player: {
		isLocal: number[];
		localX: number[];
		localY: number[];
		remoteX: number[];
		remoteY: number[];
		bufferLength: number;
		offsets: number[];
		inVent: number[];
		struct: {
			type: string;
			skip?: number;
			name: string;
		}[];
	}
}

async function loadOffsets(event: Electron.IpcMainEvent): Promise<IOffsets | undefined> {

	const valuesFile = resolve((process.env.LOCALAPPDATA || '') + "Low", 'Innersloth/Among Us/Unity/6b8b0d91-4a20-4a00-a3e4-4da4a883a5f0/Analytics/values');
	let version: string = '';
	if (existsSync(valuesFile)) {
		try {
			let json = JSON.parse(readFileSync(valuesFile, 'utf8'));
			version = json.app_ver;
		} catch (e) {
			console.log(e);
		}
	}

	let data: string;
	let offsetStore = store.get('offsets') || {};
	if (version === offsetStore.version) {
		data = offsetStore.data;
	} else {
		const response = await axios({
			url: `http://${store.get('serverIP')}/${version}.yml`,
			method: 'GET',
			validateStatus: () => true
		});
		data = response.data;
	}

	let offsets: IOffsets = yml.safeLoad(data) as any;
	try {
		IOffsets.check(offsets);
		if (!version) {
			event.reply('error', `Couldn't get the current game version. Make sure you have opened Among Us before.`);
		} else {
			store.set('offsets', {
				version,
				data
			})
		}
		return offsets;
	} catch (e) {
		console.error(e);
		event.reply('error', `Couldn't fetch the latest game data from the server ${store.get('serverIP')}.\n${e}`);
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
		iohook.on('keydown', (ev: any) => {
			let shortcutKey = store.get('pushToTalkShortcut');
			if (keyCodeMatches(shortcutKey as K, ev)) {
				event.reply('pushToTalk', true);
			}
		});
		iohook.on('keyup', (ev: any) => {
			let shortcutKey = store.get('pushToTalkShortcut');
			if (keyCodeMatches(shortcutKey as K, ev)) {
				event.reply('pushToTalk', false);
			}
			if (keyCodeMatches(store.get('deafenShortcut') as K, ev)) {
				event.reply('toggleDeafen');
			}
		});

		iohook.start();

		// Read game memory
		gameReader = new GameReader(event.reply, offsets);

		ipcMain.on('initState', (event: Electron.IpcMainEvent) => {
			event.returnValue = gameReader.lastState;
		});
		const frame = () => {
			gameReader.loop();
			setTimeout(frame, 1000 / 20);
		}
		frame();
	} else {
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

function keyCodeMatches(key: K, ev: any): boolean {
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
})