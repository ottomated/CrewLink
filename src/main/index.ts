'use strict'

import { autoUpdater } from 'electron-updater';
import { app, BrowserWindow } from 'electron';
import * as path from 'path'
import { format as formatUrl } from 'url'
import './hook';

const isDevelopment = process.env.NODE_ENV !== 'production'

// global reference to mainWindow (necessary to prevent window from being garbage collected)
let mainWindow: BrowserWindow | null;

app.commandLine.appendSwitch('disable-pinch');

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
	app.quit();
} else {
	// app.disableHardwareAcceleration();
	autoUpdater.checkForUpdatesAndNotify();
	app.on('second-instance', (event, commandLine, workingDirectory) => {
		// Someone tried to run a second instance, we should focus our window.
		if (mainWindow) {
			if (mainWindow.isMinimized()) mainWindow.restore()
			mainWindow.focus()
		}
	})


	function createMainWindow() {
		const window = new BrowserWindow({
			width: 250,
			height: 350,
			minWidth: 250,
			minHeight: 350,
			resizable: false,
			frame: false,
			fullscreenable: false,
			maximizable: false,
			transparent: true,
			webPreferences: {
				nodeIntegration: true,
				enableRemoteModule: true,
				webSecurity: false
			}
		});

		if (isDevelopment) {
			window.webContents.openDevTools()
		}

		if (isDevelopment) {
			window.loadURL(`http://localhost:${process.env.ELECTRON_WEBPACK_WDS_PORT}?version=${autoUpdater.currentVersion.version}`)
		}
		else {
			window.loadURL(formatUrl({
				pathname: path.join(__dirname, 'index.html'),
				protocol: 'file',
				query: {
					version: autoUpdater.currentVersion.version
				},
				slashes: true
			}))
		}

		window.on('closed', () => {
			mainWindow = null
		})

		window.webContents.on('devtools-opened', () => {
			window.focus()
			setImmediate(() => {
				window.focus()
			})
		})

		return window
	}

	// quit application when all windows are closed
	app.on('window-all-closed', () => {
		// on macOS it is common for applications to stay open until the user explicitly quits
		if (process.platform !== 'darwin') {
			app.quit()
		}
	})

	app.on('activate', () => {
		// on macOS it is common to re-create a window even after all windows have been closed
		if (mainWindow === null) {
			mainWindow = createMainWindow()
		}
	})

	// create main BrowserWindow when electron is ready
	app.on('ready', () => {
		mainWindow = createMainWindow();
	});

}