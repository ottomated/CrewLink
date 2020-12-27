import { ProgressInfo } from 'builder-util-runtime';

// Renderer --> Main (send/on)
export enum IpcMessages {
	SHOW_ERROR_DIALOG = 'SHOW_ERROR_DIALOG',
	OPEN_AMONG_US_GAME = 'OPEN_AMONG_US_GAME',
	RESTART_CREWLINK = 'RESTART_CREWLINK',
	QUIT_CREWLINK = 'QUIT_CREWLINK',
}

// Renderer --> Main (sendSync/on)
export enum IpcSyncMessages {
	GET_INITIAL_STATE = 'GET_INITIAL_STATE',
}

// Renderer --> Main (invoke/handle)
export enum IpcHandlerMessages {
	START_HOOK = 'START_HOOK',
}

// Main --> Renderer (send/on)
export enum IpcRendererMessages {
	NOTIFY_GAME_OPENED = 'NOTIFY_GAME_OPENED',
	NOTIFY_GAME_STATE_CHANGED = 'NOTIFY_GAME_STATE_CHANGED',
	TOGGLE_DEAFEN = 'TOGGLE_DEAFEN',
	TOGGLE_MUTE = 'TOGGLE_MUTE',
	PUSH_TO_TALK = 'PUSH_TO_TALK',
	ERROR = 'ERROR',
	AUTO_UPDATER_STATE = 'AUTO_UPDATER_STATE',
}

export interface AutoUpdaterState {
	state: 'error' | 'available' | 'downloading' | 'downloaded' | 'unavailable';
	error?: string;
	progress?: ProgressInfo;
}
