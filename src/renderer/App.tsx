import React, { useEffect, useReducer, useState } from 'react';
import Voice from './Voice';
import Menu from './Menu';
import { ipcRenderer, remote } from 'electron';
import { AmongUsState } from '../common/AmongUsState';
import Settings, { settingsReducer, lobbySettingsReducer } from './Settings';
import { GameStateContext, SettingsContext, LobbySettingsContext } from './contexts';

let appVersion = '';
if (typeof window !== 'undefined' && window.location) {
	let query = new URLSearchParams(window.location.search.substring(1));
	appVersion = (' v' + query.get('version')) + " beta" || '';
}


enum AppState { MENU, VOICE }

export default function App() {
	const [state, setState] = useState<AppState>(AppState.MENU);
	const [gameState, setGameState] = useState<AmongUsState>({} as AmongUsState);
	const [settingsOpen, setSettingsOpen] = useState(false);
	const [errored, setErrored] = useState(false);
	const settings = useReducer(settingsReducer, {
		alwaysOnTop: true,
		microphone: 'Default',
		speaker: 'Default',
		pushToTalk: false,
		serverURL: 'http://crewlink.guus.info',
		pushToTalkShortcut: 'V',
		deafenShortcut: 'RControl',
		offsets: {
			version: '',
			data: ''
		},
		hideCode: false,
		enableSpatialAudio: true,
		overlayPosition: 'top',
		compactOverlay: false,
		enableOverlay: false,
		localLobbySettings: {
			maxDistance: 5.32,
			haunting: false
		}
	});
	const lobbySettings = useReducer(lobbySettingsReducer, {
		maxDistance: 5.32,
		haunting: false
	});
	useEffect(() => {
		const onOpen = (_: Electron.IpcRendererEvent, isOpen: boolean) => {

			setState(isOpen ? AppState.VOICE : AppState.MENU);
			const overlay = remote.getGlobal('overlay');
			if (overlay) {
				overlay.webContents.send('overlayState', 'MENU');
			}
	
		};
		const onState = (_: Electron.IpcRendererEvent, newState: AmongUsState) => {
			setGameState(newState);
			let overlay = remote.getGlobal('overlay');
			if (overlay) {
				overlay.webContents.send('overlayGameState', newState);
			}
		};
		let shouldInit = true;
		const onError = (_: Electron.IpcRendererEvent, error: string) => {
			alert(error + '\n\nRestart the app after you fix this.');
			shouldInit = false;
			setErrored(true);
		};
		ipcRenderer.on('gameOpen', onOpen);
		ipcRenderer.on('error', onError);
		ipcRenderer.on('gameState', onState);
		ipcRenderer.once('started', () => {
			if (shouldInit)
				setGameState(ipcRenderer.sendSync('initState'));
		});

		ipcRenderer.send('start');

		return () => {
			ipcRenderer.off('gameOpen', onOpen);
			ipcRenderer.off('error', onError);
			ipcRenderer.off('gameState', onState);
		};
	}, []);


	let page;
	switch (state) {
	case AppState.MENU:
		page = <Menu errored={errored} />;
		break;
	case AppState.VOICE:
		page = <Voice />;
		break;
	}
	return (
		<GameStateContext.Provider value={gameState}>
			<LobbySettingsContext.Provider value={lobbySettings}>
				<SettingsContext.Provider value={settings}>
					<div className="titlebar">
						<span className="title">CrewLink{appVersion}</span>
						<svg className="titlebar-button settings" onClick={() => setSettingsOpen(!settingsOpen)} enableBackground="new 0 0 24 24" viewBox="0 0 24 24" fill="#868686" width="20px" height="20px">
							<g>
								<path d="M0,0h24v24H0V0z" fill="none" />
								<path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z" />
							</g>
						</svg>
						<svg className="titlebar-button refresh" width="20px" height="20px" viewBox="0 0 512 512"  fill="#868686" enableBackground="new 0 0 24 24" onClick={() => {ipcRenderer.send('reload')}}>
							<g>
								<path d="M479.971,32.18c-21.72,21.211-42.89,43-64.52,64.301c-1.05,1.23-2.26-0.16-3.09-0.85
									c-24.511-23.98-54.58-42.281-87.221-52.84c-37.6-12.16-78.449-14.07-117.029-5.59c-68.67,14.67-128.811,64.059-156.44,128.609
									c0.031,0.014,0.062,0.025,0.093,0.039c-2.3,4.537-3.605,9.666-3.605,15.1c0,18.475,14.977,33.451,33.451,33.451
									c15.831,0,29.084-11.002,32.555-25.773c19.757-41.979,58.832-74.445,103.967-85.527c52.2-13.17,111.37,1.33,149.4,40.041
									c-22.03,21.83-44.391,43.34-66.33,65.26c59.52-0.32,119.06-0.141,178.59-0.09C480.291,149.611,479.931,90.891,479.971,32.18z"/>
								<path d="M431.609,297.5c-14.62,0-27.041,9.383-31.591,22.453c-0.009-0.004-0.019-0.008-0.027-0.012
									c-19.11,42.59-57.57,76.219-102.84,88.18c-52.799,14.311-113.45,0.299-152.179-39.051c21.92-21.76,44.369-43.01,66.189-64.869
									c-59.7,0.049-119.41,0.029-179.11,0.01c-0.14,58.6-0.159,117.189,0.011,175.789c21.92-21.91,43.75-43.91,65.79-65.699
									c14.109,13.789,29.76,26.07,46.92,35.869c54.739,31.971,123.399,38.602,183.299,17.891
									c57.477-19.297,106.073-63.178,131.212-118.318c3.645-5.357,5.776-11.824,5.776-18.793C465.06,312.477,450.083,297.5,431.609,297.5
									z"/>
							</g>
						</svg>
					
						<svg className="titlebar-button close" viewBox="0 0 24 24" fill="#868686" width="20px" height="20px" onClick={() => {
							remote.getCurrentWindow().close();
						}}>
							<path d="M0 0h24v24H0z" fill="none" />
							<path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
						</svg>
					</div>
					<Settings open={settingsOpen} onClose={() => setSettingsOpen(false)} />
					{page}
				</SettingsContext.Provider>
			</LobbySettingsContext.Provider>
		</GameStateContext.Provider>
	);
}

