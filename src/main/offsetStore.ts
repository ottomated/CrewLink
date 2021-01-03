export interface IOffsets {
	versionNumber: string;
	versionSource: 'steam' | 'itch' | 'windowsStore';
	offsets: {
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
	};
}

export default {
	'lagz++MaYU+z5QoxU9US54EQe9HVGPo9rZ8DTisw8tc=': {
		versionNumber: '2020.10.22',
		versionSource: 'steam',
		offsets: {
			meetingHud: [21280716, 92, 0],
			meetingHudCachePtr: [8],
			meetingHudState: [132],
			gameState: [21281584, 92, 0, 100],
			hostId: [21281584, 92, 0, 68],
			clientId: [21281584, 92, 0, 72],
			allPlayersPtr: [21281328, 92, 0, 36],
			allPlayers: [8],
			playerCount: [12],
			playerAddrPtr: 16,
			exiledPlayerId: [255, 21280716, 92, 0, 148, 8],
			gameCode: [20607324, 92, 0, 32, 40],
			player: {
				struct: [
					{
						type: 'SKIP',
						skip: 8,
						name: 'unused',
					},
					{
						type: 'UINT',
						name: 'id',
					},
					{
						type: 'UINT',
						name: 'name',
					},
					{
						type: 'UINT',
						name: 'color',
					},
					{
						type: 'UINT',
						name: 'hat',
					},
					{
						type: 'UINT',
						name: 'pet',
					},
					{
						type: 'UINT',
						name: 'skin',
					},
					{
						type: 'UINT',
						name: 'disconnected',
					},
					{
						type: 'UINT',
						name: 'taskPtr',
					},
					{
						type: 'BYTE',
						name: 'impostor',
					},
					{
						type: 'BYTE',
						name: 'dead',
					},
					{
						type: 'SKIP',
						skip: 2,
						name: 'unused',
					},
					{
						type: 'UINT',
						name: 'objectPtr',
					},
				],
				isLocal: [84],
				localX: [96, 80],
				localY: [96, 84],
				remoteX: [96, 60],
				remoteY: [96, 64],
				bufferLength: 56,
				offsets: [0, 0],
				inVent: [49],
			},
		},
	},
	'CwEL0xldOcCJ3AGNg0suvSa6Z9L0nE6+pgioBPwJdbc=': {
		versionNumber: '2020.12.9',
		versionSource: 'steam',
		offsets: {
			meetingHud: [29717412, 92, 0],
			meetingHudCachePtr: [8],
			meetingHudState: [132],
			gameState: [29720404, 92, 0, 100],
			hostId: [29720404, 92, 0, 68],
			clientId: [29720404, 92, 0, 72],
			allPlayersPtr: [29719528, 92, 0, 36],
			allPlayers: [8],
			playerCount: [12],
			playerAddrPtr: 16,
			exiledPlayerId: [255, 29717412, 92, 0, 148, 8],
			gameCode: [28254460, 92, 0, 32, 40],
			player: {
				struct: [
					{
						type: 'SKIP',
						skip: 8,
						name: 'unused',
					},
					{
						type: 'UINT',
						name: 'id',
					},
					{
						type: 'UINT',
						name: 'name',
					},
					{
						type: 'UINT',
						name: 'color',
					},
					{
						type: 'UINT',
						name: 'hat',
					},
					{
						type: 'UINT',
						name: 'pet',
					},
					{
						type: 'UINT',
						name: 'skin',
					},
					{
						type: 'UINT',
						name: 'disconnected',
					},
					{
						type: 'UINT',
						name: 'taskPtr',
					},
					{
						type: 'BYTE',
						name: 'impostor',
					},
					{
						type: 'BYTE',
						name: 'dead',
					},
					{
						type: 'SKIP',
						skip: 2,
						name: 'unused',
					},
					{
						type: 'UINT',
						name: 'objectPtr',
					},
				],
				isLocal: [84],
				localX: [96, 80],
				localY: [96, 84],
				remoteX: [96, 60],
				remoteY: [96, 64],
				bufferLength: 56,
				offsets: [0, 0],
				inVent: [49],
			},
		},
	},
} as {
	[dllHash: string]: IOffsets;
};
