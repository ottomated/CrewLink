'use strict';

import { autoUpdater } from 'electron-updater';
import { app, BrowserWindow, ipcMain, session } from 'electron';
import windowStateKeeper from 'electron-window-state';
import { join as joinPath } from 'path';
import { format as formatUrl } from 'url';
import './hook';
import { overlayWindow } from 'electron-overlay-window';
import { initializeIpcHandlers, initializeIpcListeners } from './ipc-handlers';
import { IpcRendererMessages } from '../common/ipc-messages';
import { ProgressInfo } from 'builder-util-runtime';

const args = require('minimist')(process.argv);

const isDevelopment = process.env.NODE_ENV !== 'production';
const devTools = (isDevelopment || args.dev === 1) && false;

declare global {
	namespace NodeJS {
		interface Global {
			mainWindow: BrowserWindow | null;
			overlay: BrowserWindow | null;
		}
	}
}
// global reference to mainWindow (necessary to prevent window from being garbage collected)
global.mainWindow = null;
global.overlay = null;

app.commandLine.appendSwitch('disable-pinch');

function createMainWindow() {
	const mainWindowState = windowStateKeeper({});

	const window = new BrowserWindow({
		title: 'Bettercrewlink-GUI',
		width: 250,
		height: 350,
		maxWidth: 250,
		minWidth: 250,
		maxHeight: 350,
		minHeight: 350,
		x: mainWindowState.x,
		y: mainWindowState.y,

		resizable: false,
		frame: false,
		fullscreenable: false,
		maximizable: false,
		transparent: true,
		webPreferences: {
			enableRemoteModule: true,
			nodeIntegration: true,
			webSecurity: false,
		},
	});

	mainWindowState.manage(window);

	if (devTools) {
		// Force devtools into detached mode otherwise they are unusable
		window.webContents.openDevTools({
			mode: 'detach',
		});
	}

	let crewlinkVersion: string;
	if (isDevelopment) {
		crewlinkVersion = '0.0.0';
		window.loadURL(`http://localhost:${process.env.ELECTRON_WEBPACK_WDS_PORT}?version=DEV&view=app`);
	} else {
		crewlinkVersion = autoUpdater.currentVersion.version;
		window.loadURL(
			formatUrl({
				pathname: joinPath(__dirname, 'index.html'),
				protocol: 'file',
				query: {
					version: autoUpdater.currentVersion.version,
					view: 'app',
				},
				slashes: true,
			})
		);
	}
	//window.webContents.userAgent = `CrewLink/${crewlinkVersion} (${process.platform})`;
	window.webContents.userAgent = `CrewLink/2.0.1 (win32)`;
	window.on('closed', () => {
		try {
			const mainWindow = global.mainWindow;
			const overlay = global.overlay;
			global.mainWindow = null;
			global.overlay = null;
			overlay?.close();
			mainWindow?.destroy();
			overlay?.destroy();
		} catch {
			/* empty */
		}
	});

	window.webContents.on('devtools-opened', () => {
		window.focus();
		setImmediate(() => {
			window.focus();
		});
	});
	console.log('Opened app version: ', crewlinkVersion);
	return window;
}

function createOverlay() {
	const overlay = new BrowserWindow({
		title: 'Bettercrewlink-overlay',
		width: 400,
		height: 300,
		webPreferences: {
			nodeIntegration: true,
			enableRemoteModule: true,
			webSecurity: false,
		},
		fullscreenable: true,
		skipTaskbar: true,
		frame: false,
		show: false,
		transparent: true,
		resizable: true,
		//	...overlayWindow.WINDOW_OPTS,
	});

	if (devTools) {
		overlay.webContents.openDevTools({
			mode: 'detach',
		});
	}

	if (isDevelopment) {
		overlay.loadURL(
			`http://localhost:${process.env.ELECTRON_WEBPACK_WDS_PORT}?version=${autoUpdater.currentVersion.version}&view=overlay`
		);
	} else {
		overlay.loadURL(
			formatUrl({
				pathname: joinPath(__dirname, 'index.html'),
				protocol: 'file',
				query: {
					version: autoUpdater.currentVersion.version,
					view: 'overlay',
				},
				slashes: true,
			})
		);
	}
	overlay.setIgnoreMouseEvents(true);
	overlayWindow.attachTo(overlay, 'Among Us');

	return overlay;
}

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
	app.quit();
} else {
	autoUpdater.checkForUpdates();
	autoUpdater.on('update-available', () => {
		try {
			global.mainWindow?.webContents.send(IpcRendererMessages.AUTO_UPDATER_STATE, {
				state: 'available',
			});
		} catch (e) {}
	});
	autoUpdater.on('error', (err: string) => {
		try {
			global.mainWindow?.webContents.send(IpcRendererMessages.AUTO_UPDATER_STATE, {
				state: 'error',
				error: err,
			});
		} catch (e) {
			/*empty*/
		}
	});
	autoUpdater.on('download-progress', (progress: ProgressInfo) => {
		try {
			global.mainWindow?.webContents.send(IpcRendererMessages.AUTO_UPDATER_STATE, {
				state: 'downloading',
				progress,
			});
		} catch (e) {
			/*empty*/
		}
	});
	autoUpdater.on('update-downloaded', () => {
		try {
			global.mainWindow?.webContents.send(IpcRendererMessages.AUTO_UPDATER_STATE, {
				state: 'downloaded',
			});
		} catch (e) {
			/*empty*/
		}

		app.relaunch();
		autoUpdater.quitAndInstall();
	});

	// Mock auto-update download
	// setTimeout(() => {
	// 	mainWindow?.webContents.send(IpcRendererMessages.AUTO_UPDATER_STATE, {
	// 		state: 'available'
	// 	});
	// 	let total = 1000*1000;
	// 	let i = 0;
	// 	let interval = setInterval(() => {
	// 		mainWindow?.webContents.send(IpcRendererMessages.AUTO_UPDATER_STATE, {
	// 			state: 'downloading',
	// 			progress: {
	// 				total,
	// 				delta: total * 0.01,
	// 				transferred: i * total / 100,
	// 				percent: i,
	// 				bytesPerSecond: 1000
	// 			}
	// 		} as AutoUpdaterState);
	// 		i++;
	// 		if (i === 100) {
	// 			clearInterval(interval);
	// 			mainWindow?.webContents.send(IpcRendererMessages.AUTO_UPDATER_STATE, {
	// 				state: 'downloaded',
	// 			});
	// 		}
	// 	}, 100);
	// }, 10000);

	// quit application when all windows are closed
	app.on('window-all-closed', () => {
		// on macOS it is common for applications to stay open until the user explicitly quits
		try {
			const mainWindow = global.mainWindow;
			const overlay = global.overlay;
			global.mainWindow = null;
			global.overlay = null;
			overlay?.close();
			mainWindow?.destroy();
			overlay?.destroy();
		} catch {
			/* empty */
		}
		app.quit();
	});

	app.on('activate', () => {
		// on macOS it is common to re-create a window even after all windows have been closed
		if (global.mainWindow === null) {
			global.mainWindow = createMainWindow();
		}

		session.fromPartition('default').setPermissionRequestHandler((webContents, permission, callback) => {
			const allowedPermissions = ['audioCapture']; // Full list here: https://developer.chrome.com/extensions/declare_permissions#manifest
			console.log('permission requested ', permission);
			if (allowedPermissions.includes(permission)) {
				callback(true); // Approve permission request
			} else {
				console.error(
					`The application tried to request permission for '${permission}'. This permission was not whitelisted and has been blocked.`
				);

				callback(false); // Deny
			}
		});
	});

	// create main BrowserWindow when electron is ready
	app.whenReady().then(() => {
		initializeIpcListeners();
		initializeIpcHandlers();
		global.mainWindow = createMainWindow();
	});

	app.on('second-instance', () => {
		// Someone tried to run a second instance, we should focus our window.
		if (global.mainWindow) {
			if (global.mainWindow.isMinimized()) global.mainWindow.restore();
			global.mainWindow.focus();
		}
	});

	ipcMain.on('enableOverlay', async (_event, enable) => {
		if (enable) {
			if (!global.overlay) {
				global.overlay = createOverlay();
			}
			overlayWindow.show();
		} else {
			overlayWindow.hide();

			if (global.overlay?.closable) {
				overlayWindow.stop();
				global.overlay?.close();
				global.overlay = null;
			}
		}
	});
}
