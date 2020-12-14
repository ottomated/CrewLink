
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
			type: 'INT' | 'INT_BE' | 'UINT' | 'UINT_BE' | 'SHORT' | 'SHORT_BE' | 'USHORT' | 'USHORT_BE' | 'FLOAT' | 'CHAR' | 'BYTE' | 'SKIP';
			skip?: number;
			name: string;
		}[];
	};
}
