export interface ISettings {
	alwaysOnTop: boolean;
	microphone: string;
	speaker: string;
	pushToTalk: boolean;
	serverURL: string;
	pushToTalkShortcut: string;
	deafenShortcut: string;
	muteShortcut: string;
	hideCode: boolean;
	enableSpatialAudio: boolean;
	natFix: boolean;
	compactOverlay: boolean;
	overlayPosition: string;
	enableOverlay: boolean;
	localLobbySettings: ILobbySettings;
}

export interface ILobbySettings {
	maxDistance: number;
	haunting: boolean;
}
