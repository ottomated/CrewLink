'use strict';

import { autoUpdater } from 'electron-updater';
import { app, BrowserWindow } from 'electron';
import windowStateKeeper from 'electron-window-state';
import { join as joinPath } from 'path';
import { format as formatUrl } from 'url';
import './hook';
import { overlayWindow as electronOverlayWindow } from 'electron-overlay-window';
import { initializeIpcHandlers, initializeIpcListeners } from './ipc-handlers';
import { IpcRendererMessages } from '../common/ipc-messages';
import { ProgressInfo } from 'builder-util-runtime';
import iohook from 'iohook';

const isDevelopment = process.env.NODE_ENV !== 'production';

let mainWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;

app.commandLine.appendSwitch('disable-pinch');

function createMainWindow() {
	const mainWindowState = windowStateKeeper({});

	const window = new BrowserWindow({
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
			nodeIntegration: true,
			webSecurity: false,
		},
	});

	mainWindowState.manage(window);
	if (isDevelopment) {
		// Force devtools into detached mode otherwise they are unusable
		window.webContents.openDevTools({
			mode: 'detach',
		});
	}

	let crewlinkVersion: string;
	if (isDevelopment) {
		crewlinkVersion = '0.0.0';
		window.loadURL(
			`http://localhost:${process.env.ELECTRON_WEBPACK_WDS_PORT}?version=DEV&view=app`
		);
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
	window.webContents.userAgent = `CrewLink/${crewlinkVersion} (${process.platform})`;

	window.on('closed', () => {
		mainWindow = null;
		if (overlayWindow != null) {
			try {
				overlayWindow.close();
			} catch (_) {
				console.error(_);
			}
			overlayWindow = null;
		}
	});

	window.webContents.on('devtools-opened', () => {
		window.focus();
		setImmediate(() => {
			window.focus();
		});
	});

	return window;
}

function createOverlay() {
	const window = new BrowserWindow({
		width: 400,
		height: 300,
		webPreferences: {
			nodeIntegration: true,
			webSecurity: false,
		},
		...electronOverlayWindow.WINDOW_OPTS,
	});

	if (isDevelopment) {
		window.loadURL(
			`http://localhost:${process.env.ELECTRON_WEBPACK_WDS_PORT}?version=${autoUpdater.currentVersion.version}&view=overlay`
		);
	} else {
		window.loadURL(
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
	window.setIgnoreMouseEvents(true);
	electronOverlayWindow.attachTo(window, 'Among Us');

	if (isDevelopment) {
		// Force devtools into detached mode otherwise they are unusable
		window.webContents.openDevTools({
			mode: 'detach',
		});
	}
	return window;
}

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
	app.quit();
} else {
	autoUpdater.checkForUpdates();
	autoUpdater.on('update-available', () => {
		mainWindow?.webContents.send(IpcRendererMessages.AUTO_UPDATER_STATE, {
			state: 'available',
		});
	});
	autoUpdater.on('error', (err: string) => {
		mainWindow?.webContents.send(IpcRendererMessages.AUTO_UPDATER_STATE, {
			state: 'error',
			error: err,
		});
	});
	autoUpdater.on('download-progress', (progress: ProgressInfo) => {
		mainWindow?.webContents.send(IpcRendererMessages.AUTO_UPDATER_STATE, {
			state: 'downloading',
			progress,
		});
	});
	autoUpdater.on('update-downloaded', () => {
		mainWindow?.webContents.send(IpcRendererMessages.AUTO_UPDATER_STATE, {
			state: 'downloaded',
		});
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

	app.on('second-instance', () => {
		// Someone tried to run a second instance, we should focus our window.
		if (mainWindow) {
			if (mainWindow.isMinimized()) mainWindow.restore();
			mainWindow.focus();
		}
	});

	// quit application when all windows are closed
	app.on('window-all-closed', () => {
		// on macOS it is common for applications to stay open until the user explicitly quits
		if (process.platform !== 'darwin') {
			if (overlayWindow != null) {
				overlayWindow.close();
				overlayWindow = null;
			}
			app.quit();
		}
	});

	app.on('before-quit', () => {
		iohook.stop();
	});

	app.on('activate', () => {
		// on macOS it is common to re-create a window even after all windows have been closed
		if (mainWindow === null) {
			mainWindow = createMainWindow();
		}
	});

	// create main BrowserWindow when electron is ready
	app.whenReady().then(() => {
		mainWindow = createMainWindow();
		overlayWindow = createOverlay();
		initializeIpcListeners(overlayWindow);
		initializeIpcHandlers();
	});
}
