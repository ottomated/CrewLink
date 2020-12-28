export interface ISettings {
	alwaysOnTop: boolean;
	microphone: string;
	microphoneGain: number;
	speaker: string;
	pushToTalk: boolean;
	serverURL: string;
	pushToTalkShortcut: string;
	deafenShortcut: string;
	muteShortcut: string;
	hideCode: boolean;
	enableSpatialAudio: boolean;
	localLobbySettings: ILobbySettings;
}

export interface ILobbySettings {
	maxDistance: number;
}
