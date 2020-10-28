import { ipcMain } from 'electron';
// import * as mem from 'memoryjs';
// import * as Struct from 'structron';
import * as registry from 'registry-js';

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
	console.log(registry
		.enumerateValues(registry.HKEY.HKEY_LOCAL_MACHINE, 'SOFTWARE\\WOW6432Node\\Valve\\Steam')
		.find(v=>v.name === 'InstallPath'));
		
})