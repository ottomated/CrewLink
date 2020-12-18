
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
	enableSpatialAudio: boolean;
	compactOverlay: boolean;
	overlayPosition: string;
	enableOverlay: boolean;
	localLobbySettings: {
		maxDistance: number;
		haunting: boolean;
	}
}

export interface ILobbySettings {
	maxDistance: number;
	haunting: boolean;
}
