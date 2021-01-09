export interface AmongUsState {
	gameState: GameState;
	oldGameState: GameState;
	lobbyCode: string;
	players: Player[];
	isHost: boolean;
	clientId: number;
	hostId: number;
}

export interface Player {
	ptr: number;
	id: number;
	clientId: number;
	name: string;
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

export interface AudioConnected {
	[peer: string]: boolean; // isConnected
}

export interface VoiceState {
	otherTalking: OtherTalking;
	playerSocketIds: {
		[index: number]: string;
	};
	otherDead: OtherTalking;
	socketClients: SocketClientMap;
	audioConnected: AudioConnected;
}