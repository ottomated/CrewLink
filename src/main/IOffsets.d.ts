
export interface IOffsets {
	meetingHud: number[];
	meetingHudCachePtr: number[];
	meetingHudState: number[];
	gameState: number[];
	allPlayersPtr: number[];
	allPlayers: number[];
	playerCount: number[];
	playerAddrPtr: number;
	exiledPlayerId: number[];
	gameCode: number[];
	player: {
		isLocal: number[];
		localX: number[];
		localY: number[];
		remoteX: number[];
		remoteY: number[];
		bufferLength: number;
		offsets: number[];
		inVent: number[];
		struct: {
			type: string;
			skip?: number;
			name: string;
		}[];
	};
}
