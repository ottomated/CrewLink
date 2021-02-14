import {
	DataType,
	findModule,
	getProcesses,
	ModuleObject,
	openProcess,
	ProcessObject,
	readBuffer,
	readMemory as readMemoryRaw,
	findPattern as findPatternRaw,
} from 'memoryjs';
import Struct from 'structron';
import { IpcRendererMessages } from '../common/ipc-messages';
import {
	GameState,
	AmongUsState,
	Player,
	MapType,
} from '../common/AmongUsState';
import equal from 'deep-equal';
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
	is64Bit = false;
	oldGameState = GameState.UNKNOWN;
	lastState: AmongUsState = {} as AmongUsState;
	amongUs: ProcessObject | null = null;
	gameAssembly: ModuleObject | null = null;

	gameCode = 'MENU';

	checkProcessOpen(): void {
		const processOpen = getProcesses().find(
			(p) => p.szExeFile === 'Among Us.exe'
		);
		if (!this.amongUs && processOpen) {
			try {
				this.amongUs = openProcess('Among Us.exe');
				this.gameAssembly = findModule(
					'GameAssembly.dll',
					this.amongUs.th32ProcessID
				);
				this.initializeoffsets();
				this.sendIPC(IpcRendererMessages.NOTIFY_GAME_OPENED, true);
			} catch (e) {
				if (processOpen && e.toString() === 'Error: unable to find process')
					throw Errors.OPEN_AS_ADMINISTRATOR;
				this.amongUs = null;
			}
		} else if (this.amongUs && !processOpen) {
			this.amongUs = null;
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
		if (
			this.PlayerStruct &&
			this.offsets &&
			this.amongUs !== null &&
			this.gameAssembly !== null
		) {
			let state = GameState.UNKNOWN;
			const meetingHud = this.readMemory<number>(
				'pointer',
				this.gameAssembly.modBaseAddr,
				this.offsets.meetingHud
			);
			const meetingHud_cachePtr =
				meetingHud === 0
					? 0
					: this.readMemory<number>(
							'pointer',
							meetingHud,
							this.offsets.meetingHudCachePtr
					  );
			const meetingHudState =
				meetingHud_cachePtr === 0
					? 4
					: this.readMemory('int', meetingHud, this.offsets.meetingHudState, 4);
			const gameState = this.readMemory<number>(
				'int',
				this.gameAssembly.modBaseAddr,
				this.offsets.gameState
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

			this.gameCode =
				state === GameState.MENU
					? ''
					: this.IntToGameCode(
							this.readMemory<number>(
								'int32',
								this.gameAssembly.modBaseAddr,
								this.offsets.gameCode
							)
					  );

			const hostId = this.readMemory<number>(
				'uint32',
				this.gameAssembly.modBaseAddr,
				this.offsets.hostId
			);
			const clientId = this.readMemory<number>(
				'uint32',
				this.gameAssembly.modBaseAddr,
				this.offsets.clientId
			);

			const allPlayersPtr = this.readMemory<number>(
				'ptr',
				this.gameAssembly.modBaseAddr,
				this.offsets.allPlayersPtr
			);
			const allPlayers = this.readMemory<number>(
				'ptr',
				allPlayersPtr,
				this.offsets.allPlayers
			);
			const playerCount = this.readMemory<number>(
				'int' as const,
				allPlayersPtr,
				this.offsets.playerCount
			);
			let playerAddrPtr = allPlayers + this.offsets.playerAddrPtr;
			const players = [];

			const exiledPlayerId = this.readMemory<number>(
				'byte',
				this.gameAssembly.modBaseAddr,
				this.offsets.exiledPlayerId
			);
			let impostors = 0,
				crewmates = 0;

			let commsSabotaged = false;

			if (this.gameCode) {
				for (let i = 0; i < Math.min(playerCount, 100); i++) {
					const { address, last } = this.offsetAddress(
						playerAddrPtr,
						this.offsets.player.offsets
					);
					const playerData = readBuffer(
						this.amongUs.handle,
						address + last,
						this.offsets.player.bufferLength
					);

					const player = this.parsePlayer(address + last, playerData, clientId);
					playerAddrPtr += this.is64Bit ? 8 : 4;
					if (!player) continue;
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

				const shipPtr = this.readMemory<number>(
					'ptr',
					this.gameAssembly.modBaseAddr,
					this.offsets.shipStatus
				);

				const systemsPtr = this.readMemory<number>(
					'ptr',
					shipPtr,
					this.offsets.shipStatusSystems
				);
				const map: MapType = this.readMemory<number>(
					'int32',
					shipPtr,
					this.offsets.shipStatusMap,
					MapType.UNKNOWN
				);

				if (
					systemsPtr !== 0 &&
					(state === GameState.TASKS || state === GameState.DISCUSSION)
				) {
					const entries = this.readMemory<number>(
						'ptr',
						systemsPtr + (this.is64Bit ? 0x18 : 0xc)
					);
					const len = this.readMemory<number>(
						'uint32',
						entries + (this.is64Bit ? 0x18 : 0xc)
					);

					for (let i = 0; i < Math.min(len, 32); i++) {
						const keyPtr =
							entries +
							((this.is64Bit ? 0x20 : 0x10) + i * (this.is64Bit ? 0x18 : 0x10));
						const valPtr = keyPtr + (this.is64Bit ? 0x10 : 0xc);
						const key = this.readMemory<number>('int32', keyPtr);
						if (key === 14) {
							const value = this.readMemory<number>('ptr', valPtr);
							switch (map) {
								case MapType.POLUS:
								case MapType.THE_SKELD: {
									commsSabotaged =
										this.readMemory<number>(
											'uint32',
											value,
											this.offsets.commsSabotaged
										) === 1;
									break;
								}
								case MapType.MIRA_HQ: {
									commsSabotaged =
										this.readMemory<number>(
											'uint32',
											value,
											this.offsets.miraCompletedCommsConsoles
										) < 2;
								}
							}
						}
					}
				}
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

			const newState: AmongUsState = {
				lobbyCode: this.gameCode || 'MENU',
				players,
				gameState: state,
				oldGameState: this.oldGameState,
				isHost: (hostId && clientId && hostId === clientId) as boolean,
				hostId: hostId,
				clientId: clientId,
				commsSabotaged,
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
		}
		return null;
	}

	constructor(sendIPC: Electron.WebContents['send']) {
		this.sendIPC = sendIPC;
	}

	initializeoffsets(): void {
		this.is64Bit = this.isX64Version();
		this.offsets = this.is64Bit ? offsetStore.x64 : offsetStore.x86;
		this.PlayerStruct = new Struct();
		for (const member of this.offsets.player.struct) {
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

		const innerNetClient = this.findPattern(
			this.offsets.signatures.innerNetClient.sig,
			this.offsets.signatures.innerNetClient.patternOffset,
			this.offsets.signatures.innerNetClient.addressOffset
		);
		const meetingHud = this.findPattern(
			this.offsets.signatures.meetingHud.sig,
			this.offsets.signatures.meetingHud.patternOffset,
			this.offsets.signatures.meetingHud.addressOffset
		);
		const gameData = this.findPattern(
			this.offsets.signatures.gameData.sig,
			this.offsets.signatures.gameData.patternOffset,
			this.offsets.signatures.gameData.addressOffset
		);

		this.offsets.meetingHud[0] = meetingHud;
		this.offsets.exiledPlayerId[1] = meetingHud;
		this.offsets.allPlayersPtr[0] = gameData;
		this.offsets.gameState[0] = innerNetClient;
		this.offsets.gameCode[0] = innerNetClient;
		this.offsets.hostId[0] = innerNetClient;
		this.offsets.clientId[0] = innerNetClient;
	}

	isX64Version(): boolean {
		if (!this.amongUs || !this.gameAssembly) return false;

		const optionalHeader_offset = readMemoryRaw<number>(
			this.amongUs.handle,
			this.gameAssembly.modBaseAddr + 0x3c,
			'uint32'
		);
		const optionalHeader_magic = readMemoryRaw<number>(
			this.amongUs.handle,
			this.gameAssembly.modBaseAddr + optionalHeader_offset + 0x18,
			'short'
		);
		return optionalHeader_magic === 0x20b;
	}

	readMemory<T>(
		dataType: DataType,
		address: number,
		offsets: number[] = [],
		defaultParam?: T
	): T {
		if (!this.amongUs) return defaultParam as T;
		if (address === 0) return defaultParam as T;
		dataType =
			dataType == 'pointer' || dataType == 'ptr'
				? this.is64Bit
					? 'uint64'
					: 'uint32'
				: dataType;
		const { address: addr, last } = this.offsetAddress(address, offsets);
		if (addr === 0) return defaultParam as T;
		return readMemoryRaw<T>(this.amongUs.handle, addr + last, dataType);
	}

	offsetAddress(
		address: number,
		offsets: number[]
	): { address: number; last: number } {
		if (!this.amongUs) throw 'Among Us not open? Weird error';
		address = this.is64Bit ? address : address & 0xffffffff;
		for (let i = 0; i < offsets.length - 1; i++) {
			address = readMemoryRaw<number>(
				this.amongUs.handle,
				address + offsets[i],
				this.is64Bit ? 'uint64' : 'uint32'
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
			address + (this.is64Bit ? 0x10 : 0x8),
			'int'
		);
		const buffer = readBuffer(
			this.amongUs.handle,
			address + (this.is64Bit ? 0x14 : 0xc),
			length << 1
		);
		return buffer.toString('binary').replace(/\0/g, '');
	}

	findPattern(
		signature: string,
		patternOffset = 0x1,
		addressOffset = 0x0
	): number {
		if (!this.amongUs || !this.gameAssembly) return 0x0;
		const signatureTypes = 0x0 | 0x2;
		const instruction_location = findPatternRaw(
			this.amongUs.handle,
			'GameAssembly.dll',
			signature,
			signatureTypes,
			patternOffset,
			0x0
		);
		const offsetAddr = this.readMemory<number>(
			'int',
			this.gameAssembly.modBaseAddr,
			[instruction_location]
		);
		return this.is64Bit
			? offsetAddr + instruction_location + addressOffset
			: offsetAddr - this.gameAssembly.modBaseAddr;
	}

	IntToGameCode(input: number): string {
		if (!input || input === 0 || input > -1000) return '';

		const V2 = 'QWXRTYLPESDFGHUJKZOCVBINMA';
		const a = input & 0x3ff;
		const b = (input >> 10) & 0xfffff;
		return [
			V2[Math.floor(a % 26)],
			V2[Math.floor(a / 26)],
			V2[Math.floor(b % 26)],
			V2[Math.floor((b / 26) % 26)],
			V2[Math.floor((b / (26 * 26)) % 26)],
			V2[Math.floor((b / (26 * 26 * 26)) % 26)],
		].join('');
	}

	parsePlayer(
		ptr: number,
		buffer: Buffer,
		localClientId = -1
	): Player | undefined {
		if (!this.PlayerStruct || !this.offsets) return undefined;

		const { data } = this.PlayerStruct.report<PlayerReport>(buffer, 0, {});

		if (this.is64Bit) {
			data.objectPtr = this.readMemory('pointer', ptr, [
				this.PlayerStruct.getOffsetByName('objectPtr'),
			]);
			data.name = this.readMemory('pointer', ptr, [
				this.PlayerStruct.getOffsetByName('name'),
			]);
		}

		const clientId = this.readMemory<number>(
			'uint32',
			data.objectPtr,
			this.offsets.player.clientId
		);

		const isLocal = clientId === localClientId;

		const positionOffsets = isLocal
			? [this.offsets.player.localX, this.offsets.player.localY]
			: [this.offsets.player.remoteX, this.offsets.player.remoteY];

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
			clientId: clientId,
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
				this.readMemory<number>(
					'byte',
					data.objectPtr,
					this.offsets.player.inVent
				) > 0,
			isLocal,
			x,
			y,
		};
	}
}
