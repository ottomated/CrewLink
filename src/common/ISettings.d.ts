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
	obsOverlay: boolean;
	obsComptaibilityMode: boolean;
	obsSecret: string | undefined;
}

export interface ILobbySettings {
	maxDistance: number;
	visionHearing: boolean;
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
