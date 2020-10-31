import { ipcRenderer } from "electron";
import React, { useEffect, useReducer, useState } from "react";
import './css/settings.css';

export interface SettingsProps {
	open: boolean;
	onClose: any;
}

export interface Settings {
	alwaysOnTop: boolean;
	microphone: string;
	pushToTalk: boolean;
	serverIP: string;
}
const reducer = (state: Settings, action: [string, any]) => {
	return {
		...state,
		[action[0]]: action[1]
	};
}

interface MediaDevice {
	id: string;
	kind: MediaDeviceKind;
	label: string;
}

export default function Settings({ open, onClose }: SettingsProps) {

	const [settings, setSettings] = useReducer(reducer, {
		alwaysOnTop: false,
		microphone: 'test',
		pushToTalk: false,
		serverIP: 'ottomated.net'
	});

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

	return <div id="settings" style={{ transform: open ? 'translateX(0)' : 'translateX(-100%)' }}>
		<svg className="titlebar-button back" viewBox="0 0 24 24" fill="#868686" width="20px" height="20px" onClick={onClose}>
			<path d="M0 0h24v24H0z" fill="none" />
			<path d="M11.67 3.87L9.9 2.1 0 12l9.9 9.9 1.77-1.77L3.54 12z" />
		</svg>
		<div className="form-control m" style={{color: '#e74c3c'}} onClick={() => {
			ipcRenderer.send('alwaysOnTop', !settings.alwaysOnTop);
			setSettings(['alwaysOnTop', !settings.alwaysOnTop]);
		}}>
			<input type="checkbox" checked={settings.alwaysOnTop} />Always on Top
		</div>
		<div className="form-control m l" style={{color: '#e67e22'}}>
			<label>Microphone</label>
			<select onClick={() => updateDevices()}>
				{
					devices.filter(d=>d.kind === 'audioinput').map(d => (
						<option key={d.id} value={d.id}>{d.label}</option>
					))
				}
			</select>
		</div>
		<div className="form-control m l" style={{color: '#f1c40f'}}>
			<label>Speaker</label>
			<select onClick={() => updateDevices()}>
				{
					devices.filter(d=>d.kind === 'audiooutput').map(d => (
						<option key={d.id} value={d.id}>{d.label}</option>
					))
				}
			</select>
		</div>
		<div className="form-control" style={{color: '#2ecc71'}} onClick={() => setSettings(['pushToTalk', true])}>
			<input type="radio" checked={settings.pushToTalk} />
			<label>Push to Talk</label>
		</div>
		<div className="form-control m" style={{color: '#2ecc71'}} onClick={() => setSettings(['pushToTalk', false])}>
			<input type="radio" checked={!settings.pushToTalk} />
			<label>Voice Activity</label>
		</div>
		<div className="form-control l" style={{color: '#3498db'}}>
			<label>Voice Server IP</label>
			<input spellCheck={false} type="text" onChange={(ev) => setSettings(['serverIP', ev.target.value])} value={settings.serverIP} />
		</div>
	</div>
}