import {
	DataType,
	findModule,
	getProcesses,
	ModuleObject,
	openProcess,
	ProcessObject,
	readBuffer,
	readMemory as readMemoryRaw,
} from 'memoryjs';
import Struct from 'structron';
import { IpcRendererMessages } from '../common/ipc-messages';
import { GameState, AmongUsState, Player } from '../common/AmongUsState';
import equal from 'deep-equal';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import offsetStore, { IOffsets } from './offsetStore';
import Errors from '../common/Errors';

interface ValueType<T> {
	read(buffer: BufferSource, offset: number): T;
	SIZE: number;
}

interface PlayerReport {
	objectPtr: number;
	id: number;
	name: number;
	color: number;
	hat: number;
	pet: number;
	skin: number;
	disconnected: number;
	impostor: number;
	dead: number;
	taskPtr: number;
}

export default class GameReader {
	sendIPC: Electron.WebContents['send'];
	offsets: IOffsets | undefined;
	PlayerStruct: Struct | undefined;

	menuUpdateTimer = 20;
	lastPlayerPtr = 0;
	shouldReadLobby = false;
	exileCausesEnd = false;
	oldGameState = GameState.UNKNOWN;
	lastState: AmongUsState = {} as AmongUsState;

	amongUs: ProcessObject | null = null;
	gameAssembly: ModuleObject | null = null;
	dllHash: string | null = null;

	gameCode = 'MENU';

	checkProcessOpen(): void {
		const processOpen = getProcesses().find(
			(p) => p.szExeFile === 'Among Us.exe'
		);
		if (!this.amongUs && processOpen) {
			// If process just opened
			try {
				this.amongUs = openProcess('Among Us.exe');
				this.gameAssembly = findModule(
					'GameAssembly.dll',
					this.amongUs.th32ProcessID
				);

				const dllHash = createHash('sha256');
				dllHash.update(readFileSync(this.gameAssembly.szExePath));
				this.dllHash = dllHash.digest('base64');
				this.sendIPC(IpcRendererMessages.NOTIFY_GAME_OPENED, true);
			} catch (e) {
				if (processOpen && e.toString() === 'Error: unable to find process')
					throw Errors.OPEN_AS_ADMINISTRATOR;
				this.amongUs = null;
			}
		} else if (this.amongUs && !processOpen) {
			this.amongUs = null;
			this.dllHash = null;
			this.sendIPC(IpcRendererMessages.NOTIFY_GAME_OPENED, false);
		}
		return;
	}

	loop(): string | null {
		try {
			this.checkProcessOpen();
		} catch (e) {
			return e;
		}
		if (!this.offsets && this.dllHash) {
			if (!Object.prototype.hasOwnProperty.call(offsetStore, this.dllHash)) {
				return Errors.UNSUPPORTED_VERSION;
			}
			this.offsets = offsetStore[this.dllHash];
			this.PlayerStruct = new Struct();
			for (const member of this.offsets.offsets.player.struct) {
				if (member.type === 'SKIP' && member.skip) {
					this.PlayerStruct = this.PlayerStruct.addMember(
						Struct.TYPES.SKIP(member.skip),
						member.name
					);
				} else {
					this.PlayerStruct = this.PlayerStruct.addMember<unknown>(
						Struct.TYPES[member.type] as ValueType<unknown>,
						member.name
					);
				}
			}
		}
		if (
			this.amongUs !== null &&
			this.gameAssembly !== null &&
			this.offsets &&
			this.PlayerStruct
		) {
			const offsets = this.offsets.offsets;
			let state = GameState.UNKNOWN;
			const meetingHud = this.readMemory<number>(
				'pointer',
				this.gameAssembly.modBaseAddr,
				offsets.meetingHud
			);
			const meetingHud_cachePtr =
				meetingHud === 0
					? 0
					: this.readMemory<number>(
							'uint32',
							meetingHud,
							offsets.meetingHudCachePtr
					  );
			const meetingHudState =
				meetingHud_cachePtr === 0
					? 4
					: this.readMemory('int', meetingHud, offsets.meetingHudState, 4);
			const gameState = this.readMemory<number>(
				'int',
				this.gameAssembly.modBaseAddr,
				offsets.gameState
			);

			switch (gameState) {
				case 0:
					state = GameState.MENU;
					this.exileCausesEnd = false;
					break;
				case 1:
				case 3:
					state = GameState.LOBBY;
					this.exileCausesEnd = false;
					break;
				default:
					if (this.exileCausesEnd) state = GameState.LOBBY;
					else if (meetingHudState < 4) state = GameState.DISCUSSION;
					else state = GameState.TASKS;
					break;
			}

			const allPlayersPtr =
				this.readMemory<number>(
					'ptr',
					this.gameAssembly.modBaseAddr,
					offsets.allPlayersPtr
				) & 0xffffffff;
			const allPlayers = this.readMemory<number>(
				'ptr',
				allPlayersPtr,
				offsets.allPlayers
			);
			const playerCount = this.readMemory<number>(
				'int' as const,
				allPlayersPtr,
				offsets.playerCount
			);
			let playerAddrPtr = allPlayers + offsets.playerAddrPtr;
			const players = [];

			const exiledPlayerId = this.readMemory<number>(
				'byte',
				this.gameAssembly.modBaseAddr,
				offsets.exiledPlayerId
			);
			let impostors = 0,
				crewmates = 0;

			for (let i = 0; i < Math.min(playerCount, 100); i++) {
				const { address, last } = this.offsetAddress(
					playerAddrPtr,
					offsets.player.offsets
				);
				const playerData = readBuffer(
					this.amongUs.handle,
					address + last,
					offsets.player.bufferLength
				);
				const player = this.parsePlayer(
					address + last,
					playerData,
					this.offsets,
					this.PlayerStruct
				);
				playerAddrPtr += 4;
				if (state !== GameState.MENU)
					players.push(player);

				if (
					player.name === '' ||
					player.id === exiledPlayerId ||
					player.isDead ||
					player.disconnected
				)
					continue;

				if (player.isImpostor) impostors++;
				else crewmates++;
			}

			if (
				this.oldGameState === GameState.DISCUSSION &&
				state === GameState.TASKS
			) {
				if (impostors === 0 || impostors >= crewmates) {
					this.exileCausesEnd = true;
					state = GameState.LOBBY;
				}
			}
			if (
				this.oldGameState === GameState.MENU &&
				state === GameState.LOBBY &&
				this.menuUpdateTimer > 0 &&
				(this.lastPlayerPtr === allPlayers ||
					players.length === 1 ||
					!players.find((p) => p.isLocal))
			) {
				state = GameState.MENU;
				this.menuUpdateTimer--;
			} else {
				this.menuUpdateTimer = 20;
			}
			this.lastPlayerPtr = allPlayers;

			const inGame =
				state === GameState.TASKS ||
				state === GameState.DISCUSSION ||
				state === GameState.LOBBY;
			let newGameCode = 'MENU';
			if (state === GameState.LOBBY) {
				newGameCode = this.readString(
					this.readMemory<number>(
						'int32',
						this.gameAssembly.modBaseAddr,
						offsets.gameCode
					)
				);
				if (newGameCode) {
					const split = newGameCode.split('\r\n');
					if (split.length === 2) {
						newGameCode = split[1];
					} else {
						newGameCode = '';
					}
					if (!/^[A-Z]{6}$/.test(newGameCode) || newGameCode === 'MENU') {
						newGameCode = '';
					}
				}
				// console.log(this.gameCode, newGameCode);
			} else if (inGame) {
				newGameCode = '';
			}
			if (newGameCode) this.gameCode = newGameCode;

			const hostId = this.readMemory<number>(
				'uint32',
				this.gameAssembly.modBaseAddr,
				offsets.hostId
			);
			const clientId = this.readMemory<number>(
				'uint32',
				this.gameAssembly.modBaseAddr,
				offsets.clientId
			);
			const newState = {
				lobbyCode: this.gameCode,
				players,
				gameState: state,
				oldGameState: this.oldGameState,
				isHost: (hostId && clientId && hostId === clientId) as boolean,
				hostId: hostId,
				clientId: clientId,
			};
			const stateHasChanged = !equal(this.lastState, newState);
			if (stateHasChanged) {
				try {
					this.sendIPC(IpcRendererMessages.NOTIFY_GAME_STATE_CHANGED, newState);
				} catch (e) {
					process.exit(0);
				}
			}
			this.lastState = newState;
			this.oldGameState = state;
			return null; // No error
		}
		return null;
	}

	constructor(sendIPC: Electron.WebContents['send']) {
		this.sendIPC = sendIPC;
	}

	readMemory<T>(
		dataType: DataType,
		address: number,
		offsets: number[],
		defaultParam?: T
	): T {
		if (!this.amongUs) return defaultParam as T;
		if (address === 0) return defaultParam as T;
		const { address: addr, last } = this.offsetAddress(address, offsets);
		if (addr === 0) return defaultParam as T;
		return readMemoryRaw<T>(this.amongUs.handle, addr + last, dataType);
	}
	offsetAddress(
		address: number,
		offsets: number[]
	): { address: number; last: number } {
		if (!this.amongUs) throw 'Among Us not open? Weird error';
		address = address & 0xffffffff;
		for (let i = 0; i < offsets.length - 1; i++) {
			address = readMemoryRaw<number>(
				this.amongUs.handle,
				address + offsets[i],
				'uint32'
			);

			if (address == 0) break;
		}
		const last = offsets.length > 0 ? offsets[offsets.length - 1] : 0;
		return { address, last };
	}
	readString(address: number): string {
		if (address === 0 || !this.amongUs) return '';
		const length = readMemoryRaw<number>(
			this.amongUs.handle,
			address + 0x8,
			'int'
		);
		const buffer = readBuffer(this.amongUs.handle, address + 0xc, length << 1);
		return buffer.toString('binary').replace(/\0/g, '');
	}

	parsePlayer(
		ptr: number,
		buffer: Buffer,
		{ offsets }: IOffsets,
		PlayerStruct: Struct
	): Player {
		const { data } = PlayerStruct.report<PlayerReport>(buffer, 0, {});

		const isLocal =
			this.readMemory<number>('int', data.objectPtr, offsets.player.isLocal) !==
			0;

		const positionOffsets = isLocal
			? [offsets.player.localX, offsets.player.localY]
			: [offsets.player.remoteX, offsets.player.remoteY];

		const x = this.readMemory<number>(
			'float',
			data.objectPtr,
			positionOffsets[0]
		);
		const y = this.readMemory<number>(
			'float',
			data.objectPtr,
			positionOffsets[1]
		);
		return {
			ptr,
			id: data.id,
			name: this.readString(data.name),
			colorId: data.color,
			hatId: data.hat,
			petId: data.pet,
			skinId: data.skin,
			disconnected: data.disconnected > 0,
			isImpostor: data.impostor > 0,
			isDead: data.dead > 0,
			taskPtr: data.taskPtr,
			objectPtr: data.objectPtr,
			inVent:
				this.readMemory<number>('byte', data.objectPtr, offsets.player.inVent) >
				0,
			isLocal,
			x,
			y,
		};
	}
}
