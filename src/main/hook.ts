import { dialog, ipcMain } from 'electron';
import path from 'path';
// import * as mem from 'memoryjs';
// import * as Struct from 'structron';
import { HKEY, enumerateValues } from 'registry-js';
import { spawn } from 'child_process';

ipcMain.on('start', (event) => {
	// const amongUs = mem.openProcess('Among Us.exe');
	// const gameAssembly = mem.findModule('GameAssembly.dll', amongUs.th32ProcessID);

	const frame = () => {
		console.log('frame');
		requestAnimationFrame(frame);
	}
	requestAnimationFrame(frame);

});

ipcMain.on('openGame', () => {
	console.log('opengamer');
	const steamPath = enumerateValues(HKEY.HKEY_LOCAL_MACHINE,
		'SOFTWARE\\WOW6432Node\\Valve\\Steam')
		.find(v => v.name === 'InstallPath');
	if (!steamPath) {
		dialog.showErrorBox('Error', 'Could not find your Steam install path.');
	} else {
		try {
			spawn(path.join(steamPath.data as string, 'steam.exe'), [
				'-applaunch',
				'945360'
			]);
		} catch (e) {
			dialog.showErrorBox('Error', 'Please launch the game through Steam.');
		}
	}
})