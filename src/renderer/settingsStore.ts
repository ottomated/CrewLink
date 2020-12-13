import Store from 'electron-store';
import Ajv from 'ajv';
import { ISettings } from '../common/ISettings';

export const validateURL = new Ajv({
	allErrors: true,
	format: 'full'
}).compile({
	type: 'string',
	format: 'uri'
});

export const store = new Store<ISettings>({
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
				store.set('serverURL', 'https://crewl.ink');
			}
		},
		'1.1.6': store => {
			const enableSpatialAudio = store.get('stereoInLobby');
			if (typeof enableSpatialAudio === 'boolean') {
				store.set('enableSpatialAudio', enableSpatialAudio);
			}
			// @ts-ignore
			store.delete('stereoInLobby');
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
			default: 'https://crewl.ink',
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
		}
	}
});

store.onDidChange('serverURL', (newUrl) => {
	if (newUrl === 'http://54.193.94.35:9736') {
		store.set('serverURL', 'https://crewl.ink');
	}
});

export const settingsReducer = (
	state: ISettings,
	action: {
		type: 'set' | 'setOne';
		action: [string, unknown] | ISettings;
	}
): ISettings => {
	if (action.type === 'set') {
		return action.action as ISettings;
	}
	const [key, value] = (action.action as [string, unknown]);
	store.set(key, value);
	return {
		...state,
		[key]: value
	};
};