import { dialog, ipcMain } from 'electron';
import path from 'path';
// import * as Struct from 'structron';
import { HKEY, enumerateValues } from 'registry-js';
import spawn from 'cross-spawn';
import GameReader from './GameReader';

ipcMain.on('start', (event) => {

	const gameReader = new GameReader(event.reply);
	ipcMain.on('initState', (event) => {
		event.returnValue = gameReader.lastState;
	});
	const frame = () => {
		gameReader.loop();
		setTimeout(frame, 1000 / 20);
	}
	frame();

});

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