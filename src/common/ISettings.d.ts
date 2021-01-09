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
	meetingOverlay: boolean;
	overlayPosition: 'left' | 'right' | 'hidden';
	localLobbySettings: ILobbySettings;
}

export interface ILobbySettings {
	maxDistance: number;
	haunting: boolean;
	hearImpostorsInVents: boolean;
	commsSabotage: boolean;
}
