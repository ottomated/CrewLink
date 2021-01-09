export interface IOffsetsStore {
	x64: IOffsets;
	x86: IOffsets;
}

interface ISignature {
	sig: string;
	addressOffset: number;
	patternOffset: number;
}

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
	hostId: number[];
	clientId: number[];
	shipStatus: number[];
	shipStatusSystems: number[];
	shipStatusMap: number[];
	miraCompletedCommsConsoles: number[];
	commsSabotaged: number[];
	player: {
		localX: number[];
		localY: number[];
		remoteX: number[];
		remoteY: number[];
		bufferLength: number;
		offsets: number[];
		inVent: number[];
		clientId: number[];
		struct: {
			type:
				| 'INT'
				| 'INT_BE'
				| 'UINT'
				| 'UINT_BE'
				| 'SHORT'
				| 'SHORT_BE'
				| 'USHORT'
				| 'USHORT_BE'
				| 'FLOAT'
				| 'CHAR'
				| 'BYTE'
				| 'SKIP';
			skip?: number;
			name: string;
		}[];
	};
	signatures: {
		innerNetClient: ISignature;
		meetingHud: ISignature;
		gameData: ISignature;
		shipStatus: ISignature;
	};
}

export default {
	x64: {
		meetingHud: [0x21d03e0, 0xb8, 0],
		meetingHudCachePtr: [0x10],
		meetingHudState: [0xc0],
		gameState: [0x21d0ea0, 0xb8, 0, 0xac],
		gameCode: [0x21d0ea0, 0xb8, 0, 0x74],
		hostId: [0x143be9c, 0xb8, 0, 0x78],
		clientId: [0x143be9c, 0xb8, 0, 0x7c],
		allPlayersPtr: [0x21d0e60, 0xb8, 0, 0x30],
		allPlayers: [0x10],
		playerCount: [0x18],
		playerAddrPtr: 0x20,
		exiledPlayerId: [0xff, 0x21d03e0, 0xb8, 0, 0xe0, 0x10],
		shipStatus: [0x21d0ce0, 0xb8, 0x0],
		shipStatusSystems: [0xc0],
		shipStatusMap: [0x154],
		miraCompletedCommsConsoles: [0x18, 0x20], // OAMJKPNKGBM
		commsSabotaged: [0x10],
		player: {
			struct: [
				{ type: 'SKIP', skip: 16, name: 'unused' },
				{ type: 'UINT', name: 'id' },
				{ type: 'SKIP', skip: 4, name: 'unused' },
				{ type: 'UINT', name: 'name' },
				{ type: 'SKIP', skip: 4, name: 'unused' },
				{ type: 'UINT', name: 'color' },
				{ type: 'UINT', name: 'hat' },
				{ type: 'UINT', name: 'pet' },
				{ type: 'UINT', name: 'skin' },
				{ type: 'UINT', name: 'disconnected' },
				{ type: 'SKIP', skip: 4, name: 'unused' },
				{ type: 'UINT', name: 'taskPtr' },
				{ type: 'SKIP', skip: 4, name: 'unused' },
				{ type: 'BYTE', name: 'impostor' },
				{ type: 'BYTE', name: 'dead' },
				{ type: 'SKIP', skip: 6, name: 'unused' },
				{ type: 'UINT', name: 'objectPtr' },
				{ type: 'SKIP', skip: 4, name: 'unused' },
			],
			localX: [144, 108],
			localY: [144, 112],
			remoteX: [144, 88],
			remoteY: [144, 92],
			bufferLength: 80,
			offsets: [0, 0],
			inVent: [61],
			clientId: [40],
		},
		signatures: {
			innerNetClient: {
				sig:
					'48 8B 05 ? ? ? ? 48 8B 88 ? ? ? ? 48 8B 01 48 85 C0 0F 84 ? ? ? ? 66 66 66 0F 1F 84 00 ? ? ? ?',
				patternOffset: 3,
				addressOffset: 4,
			},
			meetingHud: {
				sig:
					'48 8B 05 ? ? ? ? 48 8B 88 ? ? ? ? 74 72 48 8B 39 48 8B 0D ? ? ? ? F6 81 ? ? ? ? ?',
				patternOffset: 3,
				addressOffset: 4,
			},
			gameData: {
				sig:
					'48 8B 05 ? ? ? ? 48 8B 88 ? ? ? ? 48 8B 01 48 85 C0 0F 84 ? ? ? ? BE ? ? ? ?',
				patternOffset: 3,
				addressOffset: 4,
			},
			shipStatus: {
				sig:
					'48 8B 05 ? ? ? ? 48 8B 5C 24 ? 48 8B 6C 24 ? 48 8B 74 24 ? 48 8B 88 ? ? ? ? 48 89 39 48 83 C4 20 5F',
				patternOffset: 3,
				addressOffset: 4,
			},
		},
	},
	x86: {
		meetingHud: [0x1c573a4, 0x5c, 0],
		meetingHudCachePtr: [0x8],
		meetingHudState: [0x84],
		gameState: [0x1c57f54, 0x5c, 0, 0x64],
		gameCode: [0x1c57f54, 0x5c, 0, 0x40],
		hostId: [0x1c57f54, 0x5c, 0, 0x44],
		clientId: [0x1c57f54, 0x5c, 0, 0x48],
		allPlayersPtr: [0x1c57be8, 0x5c, 0, 0x24],
		allPlayers: [0x08],
		playerCount: [0x0c],
		playerAddrPtr: 0x10,
		exiledPlayerId: [0xff, 0x1c573a4, 0x5c, 0, 0x94, 0x08],
		shipStatus: [0x1c57cac, 0x5c, 0x0],
		shipStatusSystems: [0x84],
		shipStatusMap: [0xd4],
		miraCompletedCommsConsoles: [0xc, 0x10], // OAMJKPNKGBM
		commsSabotaged: [0x8],
		player: {
			struct: [
				{ type: 'SKIP', skip: 8, name: 'unused' },
				{ type: 'UINT', name: 'id' },
				{ type: 'UINT', name: 'name' },
				{ type: 'UINT', name: 'color' },
				{ type: 'UINT', name: 'hat' },
				{ type: 'UINT', name: 'pet' },
				{ type: 'UINT', name: 'skin' },
				{ type: 'UINT', name: 'disconnected' },
				{ type: 'UINT', name: 'taskPtr' },
				{ type: 'BYTE', name: 'impostor' },
				{ type: 'BYTE', name: 'dead' },
				{ type: 'SKIP', skip: 2, name: 'unused' },
				{ type: 'UINT', name: 'objectPtr' },
			],
			localX: [96, 80],
			localY: [96, 84],
			remoteX: [96, 60],
			remoteY: [96, 64],
			bufferLength: 56,
			offsets: [0, 0],
			inVent: [49],
			clientId: [28],
		},
		signatures: {
			innerNetClient: {
				sig:
					'8B 0D ? ? ? ? 83 C4 08 8B F0 8B 49 5C 8B 11 85 D2 74 15 8B 4D 0C 8B 49 18 8B 01 50 56 52 8B 00 FF D0',
				patternOffset: 2,
				addressOffset: 0,
			},
			meetingHud: {
				sig:
					'A1 ? ? ? ? 56 8B 40 5C 8B 30 A1 ? ? ? ? F6 80 ? ? ? ? ? 74 0F 83 78 74 00 75 09 50 E8 ? ? ? ? 83 C4 04 6A 00 56 E8 ? ? ? ? 83 C4 08 84 C0 0F 85 ? ? ? ? 57 8B 7D 0C 6A 00 57 FF 35 ? ? ? ? E8 ? ? ? ? 8B 0D ? ? ? ? 83 C4 0C 8B F0 F6 81 ? ? ? ? ?',
				patternOffset: 1,
				addressOffset: 0,
			},
			gameData: {
				sig:
					'8B 0D ? ? ? ? 8B F0 83 C4 10 8B 49 5C 8B 01 85 C0 0F 84 ? ? ? ? 6A 00 FF 75 F4 50 E8 ? ? ? ? 83 C4 0C 89 45 E8 85 C0',
				patternOffset: 2,
				addressOffset: 0,
			},
			shipStatus: {
				sig:
					'A1 ? ? ? ? 8B 40 5C 8B 00 85 C0 74 5A 8B 80 ? ? ? ? 85 C0 74 50 6A 00 6A 00',
				patternOffset: 1,
				addressOffset: 0,
			},
		},
	},
} as IOffsetsStore;
