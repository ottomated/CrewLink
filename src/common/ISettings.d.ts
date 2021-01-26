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
	natFix: boolean;
	compactOverlay: boolean;
	overlayPosition: string;
	enableOverlay: boolean;
	meetingOverlay: boolean;

	localLobbySettings: ILobbySettings;
	ghostVolume: number;
	masterVolume: number;
	mobileHost: boolean;
	vadEnabled: boolean;
	echoCancellation: boolean;
	noiseSuppression: boolean;
	enableSpatialAudio: boolean;
	playerConfigMap: playerConfigMap;
}

export interface ILobbySettings {
	maxDistance: number;
	haunting: boolean;
	hearImpostorsInVents: boolean;
	impostersHearImpostersInvent: boolean;
	commsSabotage: boolean;
	deadOnly: boolean;
	meetingGhostOnly: boolean;
	hearThroughCameras: boolean;
	wallsBlockAudio: boolean;
}

export interface SocketConfig {
	volume: number;
}

export interface playerConfigMap {
	[socketId: number]: SocketConfig;
}
