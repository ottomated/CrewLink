import { CameraLocation, MapType } from './AmongusMap';

export interface AmongUsState {
	gameState: GameState;
	oldGameState: GameState;
	lobbyCodeInt: number;
	lobbyCode: string;
	players: Player[];
	isHost: boolean;
	clientId: number;
	hostId: number;
	comsSabotaged: boolean;
	currentCamera: CameraLocation;
	map: MapType;
	lightRadius: number;
	lightRadiusChanged: boolean;
	closedDoors: number[];
}

export interface Player {
	ptr: number;
	id: number;
	clientId: number;
	name: string;
	nameHash: number;
	colorId: number;
	hatId: number;
	petId: number;
	skinId: number;
	disconnected: boolean;
	isImpostor: boolean;
	isDead: boolean;
	taskPtr: number;
	objectPtr: number;
	isLocal: boolean;
	bugged: boolean;
	x: number;
	y: number;
	inVent: boolean;
}

export enum GameState {
	LOBBY,
	TASKS,
	DISCUSSION,
	MENU,
	UNKNOWN,
}

export interface Client {
	playerId: number;
	clientId: number;
}
export interface SocketClientMap {
	[socketId: string]: Client;
}
export interface OtherTalking {
	[playerId: number]: boolean; // isTalking
}

export interface OtherDead {
	[playerId: number]: boolean; // isTalking
}

export interface AudioConnected {
	[peer: string]: boolean; // isConnected
}

export interface VoiceState {
	otherTalking: OtherTalking;
	playerSocketIds: {
		[index: number]: string;
	};
	otherDead: OtherDead;
	socketClients: SocketClientMap;
	audioConnected: AudioConnected;
	localTalking: boolean;
	localIsAlive: boolean;
	muted: boolean;
	deafened: boolean;
}
