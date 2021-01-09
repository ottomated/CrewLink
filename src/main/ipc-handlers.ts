import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { HKEY, enumerateValues } from 'registry-js';
import spawn from 'cross-spawn';
import path from 'path';

import { IpcMessages, IpcOverlayMessages } from '../common/ipc-messages';

// Listeners are fire and forget, they do not have "responses" or return values
export const initializeIpcListeners = (overlayWindow: BrowserWindow): void => {
	ipcMain.on(
		IpcMessages.SHOW_ERROR_DIALOG,
		(e, opts: { title: string; content: string }) => {
			if (
				typeof opts === 'object' &&
				opts &&
				typeof opts.title === 'string' &&
				typeof opts.content === 'string'
			) {
				dialog.showErrorBox(opts.title, opts.content);
			}
		}
	);

	ipcMain.on(IpcMessages.OPEN_AMONG_US_GAME, () => {
		// Get steam path from registry
		const steamPath = enumerateValues(
			HKEY.HKEY_LOCAL_MACHINE,
			'SOFTWARE\\WOW6432Node\\Valve\\Steam'
		).find((v) => v.name === 'InstallPath');
		// Check if Steam is installed
		if (!steamPath) {
			dialog.showErrorBox('Error', 'Could not find your Steam install path.');
		} else {
			try {
				const process = spawn(
					path.join(steamPath.data as string, 'steam.exe'),
					['-applaunch', '945360']
				);
				process.on('error', () => {
					dialog.showErrorBox('Error', 'Please launch the game through Steam.');
				});
			} catch (e) {
				dialog.showErrorBox('Error', 'Please launch the game through Steam.');
			}
		}
	});

	ipcMain.on(IpcMessages.RESTART_CREWLINK, () => {
		app.relaunch();
		app.quit();
	});

	ipcMain.on(IpcMessages.QUIT_CREWLINK, () => {
		for (const win of BrowserWindow.getAllWindows()) {
			win.close();
		}
		app.quit();
	});

	ipcMain.on(
		IpcMessages.SEND_TO_OVERLAY,
		(_, event: IpcOverlayMessages, ...args: unknown[]) => {
			overlayWindow.webContents.send(event, ...args);
		}
	);
};

// Handlers are async cross-process instructions, they should have a return value
// or the caller should be "await"'ing them.  If neither of these are the case
// consider making it a "listener" instead for performance and readability
export const initializeIpcHandlers = (): void => {
	// TODO: Put handlers here
};
