import { DataType, findModule, getProcesses, ModuleObject, openProcess, ProcessObject, readBuffer, readMemory as readMemoryRaw, findPattern as findPatternRaw } from 'memoryjs';
import Struct from 'structron';
import patcher from '../patcher';
import { GameState, AmongUsState, Player } from '../common/AmongUsState';
import { IOffsets, IOffsetsContainer } from './IOffsets';


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
	reply: (event: string, ...args: unknown[]) => void;
	offsets?: IOffsets;
	offsetsContainer: IOffsetsContainer;
	PlayerStruct?: Struct;

	menuUpdateTimer = 20;
	lastPlayerPtr = 0;
	shouldReadLobby = false;
	exileCausesEnd = false;
	is_64bit: boolean = false;
	oldGameState = GameState.UNKNOWN;
	lastState: AmongUsState = {} as AmongUsState;
	amongUs: ProcessObject | null = null;
	gameAssembly: ModuleObject | null = null;


	gameCode = 'MENU';

	checkProcessOpen(): void {
		const processOpen = getProcesses().find(p => p.szExeFile === 'Among Us.exe');
		if (!this.amongUs && processOpen) { // If process just opened
			try {
				this.amongUs = openProcess('Among Us.exe');
				this.gameAssembly = findModule('GameAssembly.dll', this.amongUs.th32ProcessID);
				this.initializeoffsets();
				this.reply('gameOpen', true);
			} catch (e) {
				this.amongUs = null;
			}
		} else if (this.amongUs && !processOpen) {
			this.amongUs = null;
			this.reply('gameOpen', false);
		}
		return;
	}

	loop(): void {
		this.checkProcessOpen();
		if (this.PlayerStruct && this.offsets && this.amongUs !== null && this.gameAssembly !== null) {
			let state = GameState.UNKNOWN;
			const meetingHud = this.readMemory<number>('pointer', this.gameAssembly.modBaseAddr, this.offsets.meetingHud);
			const meetingHud_cachePtr = meetingHud === 0 ? 0 : this.readMemory<number>('pointer', meetingHud, this.offsets.meetingHudCachePtr);
			const meetingHudState = meetingHud_cachePtr === 0 ? 4 : this.readMemory('int', meetingHud, this.offsets.meetingHudState, 4);
			const gameState = this.readMemory<number>('int', this.gameAssembly.modBaseAddr, this.offsets.gameState);

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
					if (this.exileCausesEnd)
						state = GameState.LOBBY;
					else if (meetingHudState < 4)
						state = GameState.DISCUSSION;
					else
						state = GameState.TASKS;
					break;
			}
			this.gameCode = this.IntToGameCode(this.readMemory<number>('int32', this.gameAssembly.modBaseAddr, this.offsets.gameCode))
			const allPlayersPtr = this.readMemory<number>('ptr', this.gameAssembly.modBaseAddr, this.offsets.allPlayersPtr);
			const allPlayers = this.readMemory<number>('ptr', allPlayersPtr, this.offsets.allPlayers);
			const playerCount = this.readMemory<number>('int' as const, allPlayersPtr, this.offsets.playerCount);
			let playerAddrPtr = allPlayers + this.offsets.playerAddrPtr;
			const players = [];

			const exiledPlayerId = this.readMemory<number>('byte', this.gameAssembly.modBaseAddr, this.offsets.exiledPlayerId);
			let impostors = 0, crewmates = 0;

			if (this.gameCode) {
				for (let i = 0; i < Math.min(playerCount, 10); i++) {
					const { address, last } = this.offsetAddress(playerAddrPtr, this.offsets.player.offsets);
					const playerData = readBuffer(this.amongUs.handle, address + last, this.offsets.player.bufferLength);
					const player = this.parsePlayer(address + last, playerData);
					playerAddrPtr += 4;
					if (!player) continue;
					players.push(player);

					if (player.name === '' || player.id === exiledPlayerId || player.isDead || player.disconnected) continue;

					if (player.isImpostor)
						impostors++;
					else
						crewmates++;
				}
			}

			if (this.oldGameState === GameState.DISCUSSION && state === GameState.TASKS) {
				if (impostors === 0 || impostors >= crewmates) {
					this.exileCausesEnd = true;
					state = GameState.LOBBY;
				}
			}
			if (this.oldGameState === GameState.MENU && state === GameState.LOBBY && this.menuUpdateTimer > 0 &&
				(this.lastPlayerPtr === allPlayers || players.length === 1 || !players.find(p => p.isLocal))) {
				state = GameState.MENU;
				this.menuUpdateTimer--;
			} else {
				this.menuUpdateTimer = 20;
			}
			this.lastPlayerPtr = allPlayers;


			const newState = {
				lobbyCode: this.gameCode || 'MENU',
				players,
				gameState: state,
				oldGameState: this.oldGameState
			};
			const patch = patcher.diff(this.lastState, newState);
			if (patch) {
				try {
					this.reply('gameState', newState);
				} catch (e) {
					process.exit(0);
				}
			}
			this.lastState = newState;
			this.oldGameState = state;
		}
	}

	constructor(reply: (event: string, ...args: unknown[]) => void, offsets: IOffsetsContainer) {
		this.reply = reply;
		this.offsetsContainer = offsets;
	}


	initializeoffsets() {
		this.is_64bit = this.isX64Version();
		this.offsets = this.is_64bit ? this.offsetsContainer.x64 : this.offsetsContainer.x86;
		this.PlayerStruct = new Struct();
		for (const member of this.offsets.player.struct) {
			if (member.type === 'SKIP' && member.skip) {
				this.PlayerStruct = this.PlayerStruct.addMember(Struct.TYPES.SKIP(member.skip), member.name);
			} else {
				this.PlayerStruct = this.PlayerStruct.addMember<unknown>(Struct.TYPES[member.type] as ValueType<unknown>, member.name);
			}
		}

		const gameClient = this.findPattern(this.offsets.signatures.gameclient.sig, this.offsets.signatures.gameclient.patternOffset, this.offsets.signatures.gameclient.addressOffset);
		const meetingHud = this.findPattern(this.offsets.signatures.meetingHud.sig, this.offsets.signatures.meetingHud.patternOffset, this.offsets.signatures.meetingHud.addressOffset);
		const gameData = this.findPattern(this.offsets.signatures.gameData.sig, this.offsets.signatures.gameData.patternOffset, this.offsets.signatures.gameData.addressOffset);

		this.offsets.meetingHud[0] = meetingHud;
		this.offsets.exiledPlayerId[1] = meetingHud;
		this.offsets.allPlayersPtr[0] = gameData;
		this.offsets.gameState[0] = gameClient;
		this.offsets.gameCode[0] = gameClient;
	}

	isX64Version(): boolean {
		if (!this.amongUs || !this.gameAssembly)
			return false;
		const optionalHeader_offset = readMemoryRaw<number>(this.amongUs.handle, this.gameAssembly.modBaseAddr + 0x3C, 'uint32');
		const optionalHeader_magic = readMemoryRaw<number>(this.amongUs.handle, this.gameAssembly.modBaseAddr + optionalHeader_offset + 0x18, 'short');
		console.log(optionalHeader_offset.toString(16), optionalHeader_magic.toString(16), (optionalHeader_offset + 0x18).toString(16))
		return optionalHeader_magic === 0x20B;

	}

	readMemory<T>(dataType: DataType, address: number, offsets: number[], defaultParam?: T): T {
		if (!this.amongUs) return defaultParam as T;
		if (address === 0) return defaultParam as T;
		if (this.is_64bit && (dataType == 'pointer' || dataType == 'ptr')) {
			dataType = 'uint64';
		}
		const { address: addr, last } = this.offsetAddress(address, offsets);
		if (addr === 0) return defaultParam as T;
		return readMemoryRaw<T>(
			this.amongUs.handle,
			addr + last,
			dataType
		);
	}

	offsetAddress(address: number, offsets: number[]): { address: number, last: number } {
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
		if (address === 0 || !this.amongUs) return '';
		const length = readMemoryRaw<number>(this.amongUs.handle, address + (this.is_64bit ? 0x10 : 0x8), 'int');
		const buffer = readBuffer(this.amongUs.handle, address + (this.is_64bit ? 0x14 : 0xC), length << 1);
		return buffer.toString('binary').replace(/\0/g, '');
	}

	findPattern(signature: string, patternOffset: number = 0x1, addressOffset: number = 0x0): number {
		if (!this.amongUs || !this.gameAssembly) return 0x0;
		const signatureTypes = 0x0 | 0x2;
		const gameclient_function = findPatternRaw(this.amongUs.handle, "GameAssembly.dll", signature, signatureTypes, patternOffset, 0x0);
		const offsetAddr = this.readMemory<number>('int', this.gameAssembly.modBaseAddr, [gameclient_function]);
		return this.is_64bit ? offsetAddr + gameclient_function + addressOffset : offsetAddr - this.gameAssembly.modBaseAddr;;
	}

	IntToGameCode(input: number) {
		if (input === 0 || input > -1000)
			return "";

		const V2: string = "QWXRTYLPESDFGHUJKZOCVBINMA";
		const a = input & 0x3FF;
		const b = (input >> 10) & 0xFFFFF;
		return [
			V2[Math.floor(a % 26)],
			V2[Math.floor(a / 26)],
			V2[Math.floor(b % 26)],
			V2[Math.floor(b / 26 % 26)],
			V2[Math.floor(b / (26 * 26) % 26)],
			V2[Math.floor(b / (26 * 26 * 26) % 26)]
		].join("");
	}

	parsePlayer(ptr: number, buffer: Buffer): Player | undefined {
		if (!this.PlayerStruct || !this.offsets)
			return undefined;

		const { data } = this.PlayerStruct.report<PlayerReport>(buffer, 0, {});

		if (this.is_64bit) {
			data.objectPtr = this.readMemory('pointer', ptr, [this.PlayerStruct.getOffsetByName("objectPtr")]);
			data.name = this.readMemory('pointer', ptr, [this.PlayerStruct.getOffsetByName("name")]);
		}

		const isLocal = this.readMemory<number>('int', data.objectPtr, this.offsets.player.isLocal) !== 0;

		const positionOffsets = isLocal ? [
			this.offsets.player.localX,
			this.offsets.player.localY
		] : [
				this.offsets.player.remoteX,
				this.offsets.player.remoteY
			];

		const x = this.readMemory<number>('float', data.objectPtr, positionOffsets[0]);
		const y = this.readMemory<number>('float', data.objectPtr, positionOffsets[1]);
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
			inVent: this.readMemory<number>('byte', data.objectPtr, this.offsets.player.inVent) > 0,
			isLocal,
			x, y
		};
	}
}

