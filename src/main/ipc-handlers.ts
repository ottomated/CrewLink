import { app, dialog, ipcMain } from 'electron';
import { HKEY, enumerateValues } from 'registry-js';
import spawn from 'cross-spawn';
import path from 'path';

import { IpcMessages, IpcOverlayMessages } from '../common/ipc-messages';

// Listeners are fire and forget, they do not have "responses" or return values
export const initializeIpcListeners = (): void => {
	ipcMain.on(IpcMessages.SHOW_ERROR_DIALOG, (e, opts: { title: string; content: string }) => {
		if (typeof opts === 'object' && opts && typeof opts.title === 'string' && typeof opts.content === 'string') {
			dialog.showErrorBox(opts.title, opts.content);
		}
	});

	ipcMain.on(IpcMessages.OPEN_AMONG_US_GAME, () => {
		// Get steam path from registry
		const steamPath = enumerateValues(HKEY.HKEY_LOCAL_MACHINE, 'SOFTWARE\\WOW6432Node\\Valve\\Steam').find(
			(v) => v.name === 'InstallPath'
		);
		// Check if Steam is installed
		const error = () => dialog.showErrorBox('Error', 'Start the game manually. \r\n(this button is only for steam)');
		if (!steamPath) {
			error();
		} else {
			try {
				const process = spawn(path.join(steamPath.data as string, 'steam.exe'), ['-applaunch', '945360']);
				process.on('error', error);
			} catch (e) {
				error();
			}
		}
	});

	ipcMain.on(IpcMessages.RESTART_CREWLINK, () => {
		app.relaunch();
		app.quit();
	});

	ipcMain.on(IpcMessages.SEND_TO_OVERLAY, (_, event: IpcOverlayMessages, ...args: unknown[]) => {
		try {
			if (global.overlay) global.overlay.webContents.send(event, ...args);
		} catch (e) {
			/*empty*/
		}
	});

	ipcMain.on(IpcMessages.QUIT_CREWLINK, () => {
		try {
			const mainWindow = global.mainWindow;
			const overlay = global.overlay;
			global.mainWindow = null;
			global.overlay = null;
			mainWindow?.close();
			overlay?.close();
			mainWindow?.destroy();
			overlay?.destroy();
		} catch {
			/* empty */
		}
		app.quit();
	});
};

// Handlers are async cross-process instructions, they should have a return value
// or the caller should be "await"'ing them.  If neither of these are the case
// consider making it a "listener" instead for performance and readability
export const initializeIpcHandlers = (): void => {
	// TODO: Put handlers here
};
