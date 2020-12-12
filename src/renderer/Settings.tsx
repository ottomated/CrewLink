import Store from 'electron-store';
import React, { useContext, useEffect, useReducer, useState } from 'react';
import { SettingsContext, LobbySettingsContext, GameStateContext } from './contexts';
import Ajv from 'ajv';
import './css/settings.css';
import MicrophoneSoundBar from './MicrophoneSoundBar';
import TestSpeakersButton from './TestSpeakersButton';
import { ISettings, ILobbySettings } from '../common/ISettings';
import { GameState } from '../common/AmongUsState';
import { remote } from 'electron';

const keys = new Set(['Space', 'Backspace', 'Delete', 'Enter', 'Up', 'Down', 'Left', 'Right', 'Home', 'End', 'PageUp', 'PageDown', 'Escape', 'LControl', 'LShift', 'LAlt', 'RControl', 'RShift', 'RAlt']);

const validateURL = new Ajv({
	allErrors: true,
	format: 'full'
}).compile({
	type: 'string',
	format: 'uri'
});

const store = new Store<ISettings>({
	migrations: {
		'1.1.3': store => {
			const serverIP = store.get('serverIP');
			if (typeof serverIP === 'string') {
				const serverURL = `http://${serverIP}`;
				if (validateURL(serverURL)) {
					store.set('serverURL', serverURL);
				} else {
					console.warn('Error while parsing the old serverIP property. Default URL will be used instead.');
				}

				// @ts-ignore: Old serverIP property no longer exists in ISettings
				store.delete('serverIP');
			}
		},
		'1.1.5': store => {
			const serverURL = store.get('serverURL');
			if (serverURL === 'http://54.193.94.35:9736') {
				store.set('serverURL', 'http://crewlink.guus.info');
			}
		},
		'1.1.6': store => {
			const enableSpatialAudio = store.get('stereoInLobby');
			if (typeof enableSpatialAudio === 'boolean') {
				store.set('enableSpatialAudio', enableSpatialAudio);
			}
			// @ts-ignore
			store.delete('stereoInLobby');
		},
		'1.1.7': store => {
			// @ts-ignore
			store.delete('offsets');
		},
		'1.1.92': store => {
			store.delete('offsets');
		},
		'1.1.93': store => {
			store.delete('offsets');
			console.log("delete offsets");
		}
		
	},
	schema: {
		alwaysOnTop: {
			type: 'boolean',
			default: false
		},
		microphone: {
			type: 'string',
			default: 'Default'
		},
		speaker: {
			type: 'string',
			default: 'Default'
		},
		pushToTalk: {
			type: 'boolean',
			default: false,
		},
		serverURL: {
			type: 'string',
			default: 'http://crewlink.guus.info',
			format: 'uri'
		},
		pushToTalkShortcut: {
			type: 'string',
			default: 'V'
		},
		deafenShortcut: {
			type: 'string',
			default: 'RControl'
		},
		offsets: {
			type: 'object',
			properties: {
				version: {
					type: 'string',
					default: ''
				},
				data: {
					type: 'string',
					default: ''
				}
			}
		},
		hideCode: {
			type: 'boolean',
			default: false
		},
		enableSpatialAudio: {
			type: 'boolean',
			default: true
		},
		localLobbySettings: {
			type: 'object',
			default: {
				maxDistance: 5.32,
				haunting: false

			}
		}
	}
});

store.onDidChange('serverURL', (newUrl) => {
	if (newUrl === 'http://54.193.94.35:9736') {
		store.set('serverURL', 'http://crewlink.guus.info');
	}
	if (newUrl === 'https://crewl.ink') {
		store.set('serverURL', 'http://crewlink.guus.info');
	}
});

export interface SettingsProps {
	open: boolean;
	onClose: () => void;
}

export const settingsReducer = (state: ISettings, action: {
	type: 'set' | 'setOne' | 'setLobbySetting', action: [string, unknown] | ISettings
}): ISettings => {
	if (action.type === 'set') return action.action as ISettings;
	const v = (action.action as [string, unknown]);
	if (action.type === 'setLobbySetting') {
		let settings = {
			...state.localLobbySettings,
			[v[0]]: v[1]
		};
		v[0] = 'localLobbySettings';
		v[1] = settings;
	}
	store.set(v[0], v[1]);
	return {
		...state,
		[v[0]]: v[1]
	};
};

export const lobbySettingsReducer = (state: ILobbySettings, action: {
	type: 'set' | 'setOne', action: [string, any] | ILobbySettings
}): ILobbySettings => {
	if (action.type === 'set') return action.action as ILobbySettings;
	let v = (action.action as [string, any]);
	return {
		...state,
		[v[0]]: v[1]
	};
}

interface MediaDevice {
	id: string;
	kind: MediaDeviceKind;
	label: string;
}

type URLInputProps = {
	initialURL: string,
	onValidURL: (url: string) => void
};

function URLInput({ initialURL, onValidURL }: URLInputProps) {
	const [isValidURL, setURLValid] = useState(true);
	const [currentURL, setCurrentURL] = useState(initialURL);

	useEffect(() => {
		setCurrentURL(initialURL);
	}, [initialURL]);

	function onChange(event: React.ChangeEvent<HTMLInputElement>) {
		setCurrentURL(event.target.value);

		if (validateURL(event.target.value)) {
			setURLValid(true);
			onValidURL(event.target.value);
		} else {
			setURLValid(false);
		}
	}

	return <input className={isValidURL ? '' : 'input-error'} spellCheck={false} type="text" value={currentURL} onChange={onChange} />;
}

const Settings: React.FC<SettingsProps> = function ({ open, onClose }: SettingsProps) {
	const [settings, setSettings] = useContext(SettingsContext);
	const gameState = useContext(GameStateContext);
	const [lobbySettings] = useContext(LobbySettingsContext);
	const [unsavedCount, setUnsavedCount] = useState(0);
	const unsaved = unsavedCount > 2;
	useEffect(() => {
		setSettings({
			type: 'set',
			action: store.store
		});
	}, []);

	useEffect(() => {
		setUnsavedCount(s => s + 1);
	}, [settings.microphone, settings.speaker, settings.serverURL, settings.enableSpatialAudio]);

	useEffect(() => {
		remote.getCurrentWindow().setAlwaysOnTop(settings.alwaysOnTop, 'screen-saver')
	}, [settings.alwaysOnTop]);

	
	const [devices, setDevices] = useState<MediaDevice[]>([]);
	const [_, updateDevices] = useReducer((state) => state + 1, 0);
	useEffect(() => {
		navigator.mediaDevices.enumerateDevices()
			.then(devices => setDevices(devices
				.map(d => {
					let label = d.label;
					if (d.deviceId === 'default') {
						label = 'Default';
					} else {
						const match = /(.+?)\)/.exec(d.label);
						if (match && match[1])
							label = match[1] + ')';
					}
					return {
						id: d.deviceId,
						kind: d.kind,
						label
					};
				})
			));
	}, [_]);

	const setShortcut = (ev: React.KeyboardEvent<HTMLInputElement>, shortcut: string) => {
		let k = ev.key;
		if (k.length === 1) k = k.toUpperCase();
		else if (k.startsWith('Arrow')) k = k.substring(5);
		if (k === ' ') k = 'Space';

		if (k === 'Control' || k === 'Alt' || k === 'Shift')
			k = (ev.location === 1 ? 'L' : 'R') + k;

		if (/^[0-9A-Z]$/.test(k) || /^F[0-9]{1,2}$/.test(k) ||
			keys.has(k)
		) {
			setSettings({
				type: 'setOne',
				action: [shortcut, k]
			});
		}
	};

	const microphones = devices.filter(d => d.kind === 'audioinput');
	const speakers = devices.filter(d => d.kind === 'audiooutput');

	return <div id="settings" style={{ transform: open ? 'translateX(0)' : 'translateX(-100%)' }}>
		<svg className="titlebar-button back" viewBox="0 0 24 24" fill="#868686" width="20px" height="20px" onClick={() => {
			setSettings({
				type: 'setOne',
				action: ['localLobbySettings', settings.localLobbySettings]
			});
			if (unsaved) {
				onClose();
				location.reload();
			}
			else
				onClose();
		}}>
			<path d="M0 0h24v24H0z" fill="none" />
			<path d="M11.67 3.87L9.9 2.1 0 12l9.9 9.9 1.77-1.77L3.54 12z" />
		</svg>
		<div className="settings-scroll">

			<div className="form-control m l" style={{ color: '#e74c3c' }}>
				<label>Microphone</label>
				<select value={settings.microphone} onChange={(ev) => {
					setSettings({
						type: 'setOne',
						action: ['microphone', microphones[ev.target.selectedIndex].id]
					});
				}} onClick={() => updateDevices()}>
					{
						microphones.map(d => (
							<option key={d.id} value={d.id}>{d.label}</option>
						))
					}
				</select>
				{open && <MicrophoneSoundBar microphone={settings.microphone} />}
			</div>
			<div className="form-control m l" style={{ color: '#e67e22' }}>
				<label>Speaker</label>
				<select value={settings.speaker} onChange={(ev) => {
					setSettings({
						type: 'setOne',
						action: ['speaker', speakers[ev.target.selectedIndex].id]
					});
				}} onClick={() => updateDevices()}>
					{
						speakers.map(d => (
							<option key={d.id} value={d.id}>{d.label}</option>
						))
					}
				</select>
				{open && <TestSpeakersButton speaker={settings.speaker} />}
			</div>

			<div className="form-control" style={{ color: '#f1c40f' }} onClick={() => setSettings({
				type: 'setOne',
				action: ['pushToTalk', false]
			})}>
				<input type="checkbox" checked={!settings.pushToTalk} style={{ color: '#f1c40f' }} readOnly />
				<label>Voice Activity</label>
			</div>
			<div className={`form-control${settings.pushToTalk ? '' : ' m'}`} style={{ color: '#f1c40f' }} onClick={() => setSettings({
				type: 'setOne',
				action: ['pushToTalk', true]
			})}>
				<input type="checkbox" checked={settings.pushToTalk} readOnly />
				<label>Push to Talk</label>
			</div>
			{settings.pushToTalk &&
				<div className="form-control m" style={{ color: '#f1c40f' }}>
					<input spellCheck={false} type="text" value={settings.pushToTalkShortcut} readOnly onKeyDown={(ev) => setShortcut(ev, 'pushToTalkShortcut')} />
				</div>
			}
			<div className="form-control l m" style={{ color: '#2ecc71' }}>
				<label>Deafen Shortcut</label>
				<input spellCheck={false} type="text" value={settings.deafenShortcut} readOnly onKeyDown={(ev) => setShortcut(ev, 'deafenShortcut')} />
			</div>
			<div className="form-control l m" style={{ color: '#3498db' }}>
				<label>Voice Server</label>
				<URLInput initialURL={settings.serverURL} onValidURL={(url: string) => {
					setSettings({
						type: 'setOne',
						action: ['serverURL', url]
					});
				}} />
			</div>
			<div className="form-control m" style={{ color: '#9b59b6' }} onClick={() => setSettings({
				type: 'setOne',
				action: ['hideCode', !settings.hideCode]
			})}>
				<input type="checkbox" checked={!settings.hideCode} style={{ color: '#9b59b6' }} readOnly />
				<label>Show Lobby Code</label>
			</div>
			<div className={gameState.gameState === GameState.MENU || gameState.gameState === undefined ? "form-control m" : "form-control"} style={{ color: '#fd79a8' }} onClick={() => setSettings({
				type: 'setOne',
				action: ['enableSpatialAudio', !settings.enableSpatialAudio]
			})}>
				<input type="checkbox" checked={settings.enableSpatialAudio} style={{ color: '#fd79a8' }} readOnly />
				<label>Enable Spatial Audio</label>
			</div>
			<div className="form-control m" style={{ color: '#fd79a8' }} onClick={() => setSettings({
				type: 'setOne',
				action: ['alwaysOnTop', !settings.alwaysOnTop]
			})}>
				<input type="checkbox" checked={settings.alwaysOnTop} style={{ color: '#fd79a8' }} readOnly />
				<label>Show on top of the game</label>
			</div>
			
		
			<div className='settings-alert' style={{ display: unsaved ? 'flex' : 'none' }}>
				<span>
					Exit to apply changes
				</span>
			</div>
			{gameState.gameState !== undefined && gameState.gameState !== GameState.MENU &&
				<h2 style={{ color: '#e74c3c' }}>Lobby settings</h2>
			}
			{gameState.gameState !== undefined && gameState.gameState !== GameState.MENU && gameState.isHost === true ? (
				<div>
				<div className="form-control l m" style={{ color: '#3498db' }}>
					<label>Max Distance</label>
					<input spellCheck={false} type="range" min="1" max="10" step="0.1" onChange={(ev) => setSettings({
						type: 'setLobbySetting',
						action: ['maxDistance', parseFloat(ev.target.value)]
					})} value={settings.localLobbySettings.maxDistance} />
					<span>{settings.localLobbySettings.maxDistance}</span>
				</div>
				<div className="form-control m" style={{ color: '#3498db' }} onClick={() => setSettings({
				type: 'setLobbySetting',
				action: ['haunting', !settings.localLobbySettings.haunting]
			})}>
				<input type="checkbox" checked={settings.localLobbySettings.haunting} style={{ color: '#fd79a8' }} readOnly />
				<label>Ghost haunt imposters</label>
			</div>
				</div>
			) : gameState.gameState !== undefined && gameState.gameState !== GameState.MENU && (
				<div>
				<div className="form-control l m" style={{ color: '#3498db' }}>
					<label>Max Distance: {lobbySettings.maxDistance}</label>
				</div>
				<div className="form-control l m" style={{ color: '#3498db' }}>
					<label>Impostors Hear Ghosts: {lobbySettings.haunting? 'true' : 'false'}</label>
				</div>
				</div>
			)}
		</div>
	</div>;
};

export default Settings;
