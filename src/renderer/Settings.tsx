import Store from 'electron-store';
import React, { SVGProps, useContext, useEffect, useReducer, useState } from "react";
import { SettingsContext } from "./App";
import Ajv from 'ajv';
import './css/settings.css';
import MicrophoneSoundBar from './MicrophoneSoundBar';
import TestSpeakersButton from './TestSpeakersButton';

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
					store.set('serverURL', serverURL)
				} else {
					console.warn('Error while parsing the old serverIP property. Default URL will be used instead.');
				}

				// @ts-ignore: Old serverIP property no longer exists in ISettings
				store.delete('serverIP')
			}
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
			default: 'http://54.193.94.35:9736',
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
		stereoInLobby: {
			type: 'boolean',
			default: true
		},
		stunServerURL: {
			type: ['string', 'null'],
			format: 'uri',
			default: 'stun:stun.l.google.com:19302'
		},
		turnServerURL: {
			type: ['string', 'null'],
			format: 'uri',
			default: null
		},
		turnUsername: {
			type: ['string', 'null'],
			default: null
		},
		turnPassword: {
			type: ['string', 'null'],
			default: null
		}
	}
});

export interface SettingsProps {
	open: boolean;
	onClose: any;
}

export interface ISettings {
	alwaysOnTop: boolean;
	microphone: string;
	speaker: string;
	pushToTalk: boolean;
	serverURL: string;
	pushToTalkShortcut: string;
	deafenShortcut: string;
	offsets: {
		version: string;
		data: string;
	},
	hideCode: boolean;
	stereoInLobby: boolean;
	stunServerURL: string | null;
	turnServerURL: string | null;
	turnUsername: string | null;
	turnPassword: string | null;
}
export const settingsReducer = (state: ISettings, action: {
	type: 'set' | 'setOne', action: [string, any] | ISettings
}): ISettings => {
	if (action.type === 'set') return action.action as ISettings;
	let v = (action.action as [string, any]);
	store.set(v[0], v[1]);
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

	return <input className={isValidURL ? '' : 'input-error'} spellCheck={false} type="text" value={currentURL} onChange={onChange} />
}

function Arrow(props: SVGProps<SVGSVGElement>) {
	return <svg viewBox="0 0 24 24" fill="#868686" width="20px" height="20px" {...props}>
		<path d="M0 0h24v24H0z" fill="none" />
		<path d="M11.67 3.87L9.9 2.1 0 12l9.9 9.9 1.77-1.77L3.54 12z" />
	</svg>
}

type CollapsibleSettingsProps = {
	entryName: string,
	collapsibleContent: JSX.Element
};

function CollapsibleSettings({ collapsibleContent, entryName }: CollapsibleSettingsProps) {
	const [collapsed, setCollapsed] = useState(true);

	return <div className="collapsible-content-wrapper">
		<label className="clickable" onClick={() => setCollapsed(!collapsed)}>
			<Arrow className="inline-icon" transform={collapsed ? 'rotate(180)' : 'rotate(-90)'} width="16" height="16" />
			{entryName}
		</label>
		<div className="collapsible-content">
			{collapsed ? '' : collapsibleContent}
		</div>
	</div>;
}

export default function Settings({ open, onClose }: SettingsProps) {
	const [settings, setSettings] = useContext(SettingsContext);
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
	}, [
		settings.microphone,
		settings.speaker,
		settings.serverURL,
		settings.stunServerURL,
		settings.turnServerURL,
		settings.turnUsername,
		settings.turnPassword
	]);

	const [devices, setDevices] = useState<MediaDevice[]>([]);
	const [_, updateDevices] = useReducer((state) => state + 1, 0);
	useEffect(() => {
		navigator.mediaDevices.enumerateDevices()
			.then(devices => setDevices(devices
				.map(d => {
					let label = d.label;
					if (d.deviceId === 'default') {
						label = "Default";
					} else {
						let match = /\((.+?)\)/.exec(d.label);
						if (match && match[1])
							label = match[1];
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
		<Arrow className="titlebar-button back" onClick={() => {
			if (unsaved) {
				onClose();
				location.reload();
			} else {
				onClose();
			}
		}} />
		{/* <div className="form-control m" style={{ color: '#e74c3c' }} onClick={() => {
			ipcRenderer.send('alwaysOnTop', !settings.alwaysOnTop);
			setSettings({
				type: 'setOne',
				action: ['alwaysOnTop', !settings.alwaysOnTop]
			});
		}}>
			<input type="checkbox" checked={settings.alwaysOnTop} readOnly />Always on Top
		</div> */}
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
				{open && <MicrophoneSoundBar />}
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
				{open && <TestSpeakersButton />}
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
					})
				}} />
			</div>
			<div className="form-control m" style={{ color: '#9b59b6' }} onClick={() => setSettings({
				type: 'setOne',
				action: ['hideCode', !settings.hideCode]
			})}>
				<input type="checkbox" checked={!settings.hideCode} style={{ color: '#9b59b6' }} readOnly />
				<label>Show Lobby Code</label>
			</div>
			<div className="form-control m" style={{ color: '#fd79a8' }} onClick={() => setSettings({
				type: 'setOne',
				action: ['stereoInLobby', !settings.stereoInLobby]
			})}>
				<input type="checkbox" checked={settings.stereoInLobby} style={{ color: '#fd79a8' }} readOnly />
				<label>Stereo Audio in Lobbies</label>
			</div>
			<CollapsibleSettings entryName="Advanced Settings" collapsibleContent={
				<div>
					<div className="form-control l m" style={{ color: '#3498db' }}>
						<label>STUN Server</label>
						<URLInput initialURL={settings.stunServerURL || ''} onValidURL={(url: string) => {
							setSettings({
								type: 'setOne',
								action: ['stunServerURL', url !== '' ? url : null]
							})
						}} />
					</div>
					<div className="form-control l m" style={{ color: '#3498db' }}>
						<label>TURN Server</label>
						<URLInput initialURL={settings.turnServerURL || ''} onValidURL={(url: string) => {
							setSettings({
								type: 'setOne',
								action: ['turnServerURL', url !== '' ? url : null]
							})
						}} />
					</div>
					<div className="form-control l m" style={{ color: '#3498db' }}>
						<label>TURN Username</label>
						<input spellCheck={false} type="text" value={settings.turnUsername || ''} onChange={(e) => {
							setSettings({
								type: 'setOne',
								action: ['turnUsername', e.target.value !== '' ? e.target.value : null]
							})
						}} />
					</div>
					<div className="form-control l m" style={{ color: '#3498db' }}>
						<label>TURN Password</label>
						<input spellCheck={false} type="password" value={settings.turnPassword || ''} onChange={(e) => {
							setSettings({
								type: 'setOne',
								action: ['turnPassword', e.target.value !== '' ? e.target.value : null]
							})
						}} />
					</div>
				</div>
			} />
		</div>
	</div>
}