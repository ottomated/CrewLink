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
import { GameState, AmongUsState, Player } from '../common/AmongUsState';
import offsetStore, { IOffsets } from './offsetStore';
import Errors from '../common/Errors';
import { CameraLocation, MapType } from '../common/AmongusMap';

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
	is_64bit = false;
	oldGameState = GameState.UNKNOWN;
	lastState: AmongUsState = {} as AmongUsState;
	amongUs: ProcessObject | null = null;
	gameAssembly: ModuleObject | null = null;

	gameCode = 'MENU';

	checkProcessOpen(): void {
		const processOpen = getProcesses().find((p) => p.szExeFile === 'Among Us.exe');

		if (!this.amongUs && processOpen) {
			try {
				this.amongUs = openProcess('Among Us.exe');
				this.gameAssembly = findModule('GameAssembly.dll', this.amongUs.th32ProcessID);
				this.initializeoffsets();
				this.sendIPC(IpcRendererMessages.NOTIFY_GAME_OPENED, true);
			} catch (e) {
				if (processOpen && e.toString() === 'Error: unable to find process') throw Errors.OPEN_AS_ADMINISTRATOR;
				this.amongUs = null;
			}
		} else if (this.amongUs && !processOpen) {
			this.amongUs = null;
			try {
				this.sendIPC(IpcRendererMessages.NOTIFY_GAME_OPENED, false);
			} catch (e) {
				/*empty*/
			}
		}
		return;
	}

	loop(): string | null {
		try {
			this.checkProcessOpen();
		} catch (e) {
			return e;
		}
		if (this.PlayerStruct && this.offsets && this.amongUs !== null && this.gameAssembly !== null) {
			let state = GameState.UNKNOWN;
			const meetingHud = this.readMemory<number>('pointer', this.gameAssembly.modBaseAddr, this.offsets.meetingHud);
			const meetingHud_cachePtr =
				meetingHud === 0 ? 0 : this.readMemory<number>('pointer', meetingHud, this.offsets.objectCachePtr);
			const meetingHudState =
				meetingHud_cachePtr === 0 ? 4 : this.readMemory('int', meetingHud, this.offsets.meetingHudState, 4);

			const innerNetClient = this.readMemory<number>('ptr', this.gameAssembly.modBaseAddr, this.offsets.innerNetClient);

			const gameState = this.readMemory<number>('int', innerNetClient, this.offsets.gameState);

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

			const lobbyCodeInt =
				state === GameState.MENU ? -1 : this.readMemory<number>('int32', innerNetClient, this.offsets.gameCode);
			this.gameCode =
				state === GameState.MENU
					? ''
					: lobbyCodeInt === this.lastState.lobbyCodeInt
					? this.gameCode
					: this.IntToGameCode(lobbyCodeInt);

			const allPlayersPtr = this.readMemory<number>('ptr', this.gameAssembly.modBaseAddr, this.offsets.allPlayersPtr);
			const allPlayers = this.readMemory<number>('ptr', allPlayersPtr, this.offsets.allPlayers);

			const playerCount = this.readMemory<number>('int' as const, allPlayersPtr, this.offsets.playerCount);
			let playerAddrPtr = allPlayers + this.offsets.playerAddrPtr;
			const players = [];

			const hostId = this.readMemory<number>('uint32', innerNetClient, this.offsets.hostId);
			const clientId = this.readMemory<number>('uint32', innerNetClient, this.offsets.clientId);

			const exiledPlayerId = this.readMemory<number>(
				'byte',
				this.gameAssembly.modBaseAddr,
				this.offsets.exiledPlayerId
			);
			let impostors = 0,
				crewmates = 0,
				lightRadius = 1;
			let comsSabotaged = false;
			let currentCamera = CameraLocation.NONE;
			let map = MapType.UNKNOWN;
			const closedDoors: number[] = [];
			let localPlayer = undefined;
			if (this.gameCode && playerCount) {
				for (let i = 0; i < Math.min(playerCount, 20); i++) {
					const { address, last } = this.offsetAddress(playerAddrPtr, this.offsets.player.offsets);
					const playerData = readBuffer(this.amongUs.handle, address + last, this.offsets.player.bufferLength);
					const player = this.parsePlayer(address + last, playerData, clientId);
					playerAddrPtr += this.is_64bit ? 8 : 4;
					if (!player || state === GameState.MENU) {
						continue;
					}

					if (player.isLocal) {
						localPlayer = player;
					}

					players.push(player);

					if (player.id === exiledPlayerId || player.isDead || player.disconnected || player.name === '') continue;
					if (player.isImpostor) impostors++;
					else crewmates++;
				}
				if (localPlayer) {
					lightRadius = this.readMemory<number>('float', localPlayer.objectPtr, this.offsets.lightRadius, -1);
				}
				if (state === GameState.TASKS) {
					const shipPtr = this.readMemory<number>('ptr', this.gameAssembly.modBaseAddr, this.offsets.shipStatus);

					const systemsPtr = this.readMemory<number>('ptr', shipPtr, this.offsets.shipStatus_systems);
					map = this.readMemory<number>('int32', shipPtr, this.offsets.shipStatus_map, MapType.UNKNOWN);

					if (systemsPtr !== 0 && state === GameState.TASKS) {
						this.readDictionary(systemsPtr, 32, (k, v) => {
							const key = this.readMemory<number>('int32', k);
							if (key === 14) {
								const value = this.readMemory<number>('ptr', v);
								switch (map) {
									case MapType.POLUS:
									case MapType.THE_SKELD: {
										comsSabotaged =
											this.readMemory<number>('uint32', value, this.offsets?.HudOverrideSystemType_isActive) === 1;
										break;
									}
									case MapType.MIRA_HQ: {
										comsSabotaged =
											this.readMemory<number>('uint32', value, this.offsets?.hqHudSystemType_CompletedConsoles) < 2;
									}
								}
							} else if (key === 18 && map === MapType.MIRA_HQ) {
								//SystemTypes Decontamination
								const value = this.readMemory<number>('ptr', v);
								const lowerDoorOpen = this.readMemory<number>('int', value, this.offsets?.deconDoorLowerOpen);
								const upperDoorOpen = this.readMemory<number>('int', value, this.offsets?.deconDoorUpperOpen);
								if (!lowerDoorOpen) {
									closedDoors.push(0);
								}
								if (!upperDoorOpen) {
									closedDoors.push(1);
								}
							}
						});
					}
					const minigamePtr = this.readMemory<number>('ptr', this.gameAssembly.modBaseAddr, this.offsets?.miniGame);
					const minigameCachePtr = this.readMemory<number>('ptr', minigamePtr, this.offsets?.objectCachePtr);

					if (minigameCachePtr && minigameCachePtr !== 0 && localPlayer) {
						if (map === MapType.POLUS) {
							const currentCameraId = this.readMemory<number>(
								'uint32',
								minigamePtr,
								this.offsets?.planetSurveillanceMinigame_currentCamera
							);
							const camarasCount = this.readMemory<number>(
								'uint32',
								minigamePtr,
								this.offsets?.planetSurveillanceMinigame_camarasCount
							);

							if (currentCameraId >= 0 && currentCameraId <= 5 && camarasCount === 6) {
								currentCamera = currentCameraId as CameraLocation;
							}
						} else if (map === MapType.THE_SKELD) {
							const roomCount = this.readMemory<number>(
								'uint32',
								minigamePtr,
								this.offsets?.surveillanceMinigame_FilteredRoomsCount
							);
							if (roomCount === 4) {
								const dist = Math.sqrt(Math.pow(localPlayer.x - -12.9364, 2) + Math.pow(localPlayer.y - -2.7928, 2));
								if (dist < 0.6) {
									currentCamera = CameraLocation.Skeld;
								}
							}
						}
					}
					if (map !== MapType.MIRA_HQ) {
						const allDoors = this.readMemory<number>('ptr', shipPtr, this.offsets.shipstatus_allDoors);
						const doorCount = Math.min(this.readMemory<number>('int', allDoors, this.offsets.playerCount), 16);
						for (let doorNr = 0; doorNr < doorCount; doorNr++) {
							const door = this.readMemory<number>(
								'ptr',
								allDoors + this.offsets.playerAddrPtr + doorNr * (this.is_64bit ? 0x8 : 0x4)
							);
							const doorOpen = this.readMemory<number>('int', door + this.offsets.door_isOpen) === 1;
							//	const doorId = this.readMemory<number>('int', door + this.offsets.door_doorId);
							//console.log(doorId);
							if (!doorOpen) {
								closedDoors.push(doorNr);
							}
						}
					}
				}
				//	console.log('doorcount: ', doorCount, doorsOpen);
			}

			if (this.oldGameState === GameState.DISCUSSION && state === GameState.TASKS) {
				if (impostors === 0 || impostors >= crewmates) {
					this.exileCausesEnd = true;
					state = GameState.LOBBY;
				}
			}

			if (
				this.oldGameState === GameState.MENU &&
				state === GameState.LOBBY &&
				this.menuUpdateTimer > 0 &&
				(this.lastPlayerPtr === allPlayers || players.length === 1 || !players.find((p) => p.isLocal))
			) {
				state = GameState.MENU;
				this.menuUpdateTimer--;
			} else {
				this.menuUpdateTimer = 20;
			}
			this.lastPlayerPtr = allPlayers;

			const lobbyCode = state !== GameState.MENU ? this.gameCode || 'MENU' : 'MENU';
			const newState: AmongUsState = {
				lobbyCode: lobbyCode,
				lobbyCodeInt,
				players,
				gameState: lobbyCode === 'MENU' ? GameState.MENU : state,
				oldGameState: this.oldGameState,
				isHost: (hostId && clientId && hostId === clientId) as boolean,
				hostId: hostId,
				clientId: clientId,
				comsSabotaged,
				currentCamera,
				lightRadius,
				lightRadiusChanged: lightRadius != this.lastState?.lightRadius,
				map,
				closedDoors,
			};
			//	const stateHasChanged = !equal(this.lastState, newState);
			//	if (stateHasChanged) {
			try {
				this.sendIPC(IpcRendererMessages.NOTIFY_GAME_STATE_CHANGED, newState);
			} catch (e) {
				process.exit(0);
			}
			//	}
			this.lastState = newState;
			this.oldGameState = state;
		}
		return null;
	}

	constructor(sendIPC: Electron.WebContents['send']) {
		this.sendIPC = sendIPC;
	}

	initializeoffsets(): void {
		this.is_64bit = this.isX64Version();
		this.offsets = this.is_64bit ? offsetStore.x64 : offsetStore.x86;
		this.PlayerStruct = new Struct();
		for (const member of this.offsets.player.struct) {
			if (member.type === 'SKIP' && member.skip) {
				this.PlayerStruct = this.PlayerStruct.addMember(Struct.TYPES.SKIP(member.skip), member.name);
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
		const shipStatus = this.findPattern(
			this.offsets.signatures.shipStatus.sig,
			this.offsets.signatures.shipStatus.patternOffset,
			this.offsets.signatures.shipStatus.addressOffset
		);
		const miniGame = this.findPattern(
			this.offsets.signatures.miniGame.sig,
			this.offsets.signatures.miniGame.patternOffset,
			this.offsets.signatures.miniGame.addressOffset
		);

		this.offsets.meetingHud[0] = meetingHud;
		this.offsets.exiledPlayerId[1] = meetingHud;

		this.offsets.allPlayersPtr[0] = gameData;
		this.offsets.innerNetClient[0] = innerNetClient;
		this.offsets.shipStatus[0] = shipStatus;
		this.offsets.miniGame[0] = miniGame;
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

	readMemory<T>(dataType: DataType, address: number, offsets?: number[], defaultParam?: T): T {
		if (!this.amongUs) return defaultParam as T;
		if (address === 0) return defaultParam as T;
		dataType = dataType == 'pointer' || dataType == 'ptr' ? (this.is_64bit ? 'uint64' : 'uint32') : dataType;
		const { address: addr, last } = this.offsetAddress(address, offsets || []);
		if (addr === 0) return defaultParam as T;
		return readMemoryRaw<T>(this.amongUs.handle, addr + last, dataType);
	}

	offsetAddress(address: number, offsets: number[]): { address: number; last: number } {
		if (!this.amongUs) throw 'Among Us not open? Weird error';
		address = this.is_64bit ? address : address & 0xffffffff;
		for (let i = 0; i < offsets.length - 1; i++) {
			address = readMemoryRaw<number>(this.amongUs.handle, address + offsets[i], this.is_64bit ? 'uint64' : 'uint32');

			if (address == 0) break;
		}
		const last = offsets.length > 0 ? offsets[offsets.length - 1] : 0;
		return { address, last };
	}

	readString(address: number): string {
		try {
			if (address === 0 || !this.amongUs) {
				return '';
			}
			const length = Math.max(
				0,
				Math.min(readMemoryRaw<number>(this.amongUs.handle, address + (this.is_64bit ? 0x10 : 0x8), 'int'), 15)
			);
			const buffer = readBuffer(this.amongUs.handle, address + (this.is_64bit ? 0x14 : 0xc), length << 1);
			if (buffer) {
				return buffer.toString('utf16le').replace(/\0/g, '');
			} else {
				return '';
			}
		} catch (e) {
			return '';
		}
	}

	readDictionary(
		address: number,
		maxLen: number,
		callback: (keyPtr: number, valPtr: number, index: number) => void
	): void {
		const entries = this.readMemory<number>('ptr', address + (this.is_64bit ? 0x18 : 0xc));
		let len = this.readMemory<number>('uint32', entries + (this.is_64bit ? 0x18 : 0xc));
		len = len > maxLen ? maxLen : len;
		for (let i = 0; i < len; i++) {
			const offset = entries + ((this.is_64bit ? 0x20 : 0x10) + i * (this.is_64bit ? 0x18 : 0x10));
			callback(offset, offset + (this.is_64bit ? 0x10 : 0xc), i);
		}
	}

	findPattern(signature: string, patternOffset = 0x1, addressOffset = 0x0): number {
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
		const offsetAddr = this.readMemory<number>('int', this.gameAssembly.modBaseAddr, [instruction_location]);
		return this.is_64bit
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

	hashCode(s: string): number {
		let h = 0;
		for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
		return h;
	}

	parsePlayer(ptr: number, buffer: Buffer, LocalclientId = -1): Player | undefined {
		if (!this.PlayerStruct || !this.offsets) return undefined;

		const { data } = this.PlayerStruct.report<PlayerReport>(buffer, 0, {});

		if (this.is_64bit) {
			data.objectPtr = this.readMemory('pointer', ptr, [this.PlayerStruct.getOffsetByName('objectPtr')]);
			data.name = this.readMemory('pointer', ptr, [this.PlayerStruct.getOffsetByName('name')]);
		}

		const clientId = this.readMemory<number>('uint32', data.objectPtr, this.offsets.player.clientId);
		const isLocal = clientId === LocalclientId && data.disconnected === 0;

		const positionOffsets = isLocal
			? [this.offsets.player.localX, this.offsets.player.localY]
			: [this.offsets.player.remoteX, this.offsets.player.remoteY];

		let x = this.readMemory<number>('float', data.objectPtr, positionOffsets[0]);
		let y = this.readMemory<number>('float', data.objectPtr, positionOffsets[1]);
		let bugged = false;
		if (x === undefined || y === undefined) {
			x = 9999;
			y = 9999;
			bugged = true;
		}

		const x_round = parseFloat(x?.toFixed(4));
		const y_round = parseFloat(y?.toFixed(4));

		// if (isLocal) {
		// 	console.log('Current position: ', { x_low: x_round, y_low: y_round });
		// }
		const name = this.readString(data.name);
		const nameHash = this.hashCode(name);
		return {
			ptr,
			id: data.id,
			clientId: clientId,
			name,
			nameHash,
			colorId: data.color,
			hatId: data.hat,
			petId: data.pet,
			skinId: data.skin,
			disconnected: data.disconnected > 0,
			isImpostor: data.impostor > 0,
			isDead: data.dead > 0,
			taskPtr: data.taskPtr,
			objectPtr: data.objectPtr,
			bugged,
			inVent: this.readMemory<number>('byte', data.objectPtr, this.offsets.player.inVent) > 0,
			isLocal,
			x: x_round || x || 999,
			y: y_round || y || 999,
		};
	}
}
