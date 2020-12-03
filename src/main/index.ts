'use strict'

import { autoUpdater } from 'electron-updater';
import installExtension, { REACT_DEVELOPER_TOOLS } from 'electron-devtools-installer';
import { app, BrowserWindow, ipcMain } from 'electron';
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

		// open devtools on launch
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

	async function injectExtensions () {
    console.log( `Attempting to injecti extensions...` );

    // add react devtools
    try {
      const name = await installExtension( REACT_DEVELOPER_TOOLS );
      console.log( `Added Extension:  ${name}` );
    } catch ( error ) {
      console.error( 'An error occurred installing extension(s): ', error );
    }
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
	app.on('ready', async () => {

    mainWindow = createMainWindow();

    if (isDevelopment) {
      await injectExtensions();
    }
	});

	// ipcMain.on('alwaysOnTop', (event, onTop: boolean) => {
	// 	if (mainWindow) {
	// 		mainWindow.setAlwaysOnTop(onTop, 'floating', 1);
	// 		mainWindow.setVisibleOnAllWorkspaces(true);
	// 		mainWindow.setFullScreenable(false);
	// 	}
	// });

	ipcMain.on('shortcut', (event, val) => {
		event.returnValue = false;
		// console.log('register', val);
		// globalShortcut.unregisterAll();
		// event.returnValue = globalShortcut.register(val!, () => {
		// 	console.log("push-to-talk");
		// })

	});
}