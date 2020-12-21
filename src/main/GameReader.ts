import { DataType, findModule, getProcesses, ModuleObject, openProcess, ProcessObject, readBuffer, readMemory as readMemoryRaw, findPattern} from 'memoryjs';
import Struct from 'structron';
import patcher from '../patcher';
import { GameState, AmongUsState, Player } from '../common/AmongUsState';
import { IOffsets } from './IOffsets';

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
	clientId: number;
}

export default class GameReader {
	reply: (event: string, ...args: unknown[]) => void;
	offsets: IOffsets;
	PlayerStruct: Struct;

	menuUpdateTimer = 20;
	lastPlayerPtr = 0;
	shouldReadLobby = false;
	exileCausesEnd = false;
	oldGameState = GameState.UNKNOWN;
	lastState: AmongUsState = {} as AmongUsState;

	amongUs: ProcessObject | null = null;
	gameAssembly: ModuleObject | null = null;
	updated_offsets = false;

	gameCode = 'MENU';

	checkProcessOpen(): void {
		const processOpen = getProcesses().find(p => p.szExeFile === 'Among Us.exe');
		if (!this.amongUs && processOpen) { // If process just opened
			try {
				this.amongUs = openProcess('Among Us.exe');
				this.gameAssembly = findModule('GameAssembly.dll', this.amongUs.th32ProcessID);
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
 gameClient : number = 0;
 meetinHud : number = 0;
 gameData : number = 0;

	loop(): void {
		this.checkProcessOpen();

		if (this.amongUs !== null && this.gameAssembly !== null) {
			if(!this.updated_offsets) {
			this.gameClient = this.getOffset("74 7F 83 7E 2C 00 A1 ? ? ? ? 8B 40 5C", 0x7);
			this.meetinHud = this.getOffset("A1 ? ? ? ? 6A 00 6A 00 6A 63 8B 40 5C FF 30");
			this.gameData = this.getOffset("8B 0D ? ? ? ? 6A 00 6A 01 6A 9C 8B 49 5C 89 01 A1 ? ? ? ? 8B 40 5C", 0x2)
			this.updated_offsets = true;
			}
			this.offsets.meetingHud[0] = this.meetinHud;
			this.offsets.exiledPlayerId[1] = this.meetinHud;
			this.offsets.allPlayersPtr[0] = this.gameData;
			this.offsets.gameState[0] = this.gameClient;

			let state = GameState.UNKNOWN;
			const meetingHud = this.readMemory<number>('pointer', this.gameAssembly.modBaseAddr, this.offsets.meetingHud);
			const meetingHud_cachePtr = meetingHud === 0 ? 0 : this.readMemory<number>('uint32', meetingHud, this.offsets.meetingHudCachePtr);
			const meetingHudState = meetingHud_cachePtr === 0 ? 4 : this.readMemory('int', meetingHud, this.offsets.meetingHudState, 4);
			const gameState = this.readMemory<number>('int', this.gameAssembly.modBaseAddr, this.offsets.gameState);
			//console.log(this.offsets.meetingHud[0])
		
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

			const allPlayersPtr = this.readMemory<number>('ptr', this.gameAssembly.modBaseAddr, this.offsets.allPlayersPtr) & 0xffffffff;
			const allPlayers = this.readMemory<number>('ptr', allPlayersPtr, this.offsets.allPlayers);
			const playerCount = this.readMemory<number>('int' as const, allPlayersPtr, this.offsets.playerCount);
			let playerAddrPtr = allPlayers + this.offsets.playerAddrPtr;
			const players = [];

			const exiledPlayerId = this.readMemory<number>('byte', this.gameAssembly.modBaseAddr, this.offsets.exiledPlayerId);
			let impostors = 0, crewmates = 0;

			for (let i = 0; i < Math.min(playerCount, 10); i++) {
				const { address, last } = this.offsetAddress(playerAddrPtr, this.offsets.player.offsets);
				const playerData = readBuffer(this.amongUs.handle, address + last, this.offsets.player.bufferLength);
				const player = this.parsePlayer(address + last, playerData);
				playerAddrPtr += 4;
				players.push(player);

				if (player.name === '' || player.id === exiledPlayerId || player.isDead || player.disconnected) continue;

				if (player.isImpostor)
					impostors++;
				else
					crewmates++;
			}

			if (this.oldGameState === GameState.DISCUSSION && state === GameState.TASKS) {
				if (impostors === 0 || impostors >= crewmates) {
					this.exileCausesEnd = true;
					state = GameState.LOBBY;
				}
			}
			if (this.oldGameState === GameState.MENU && state === GameState.LOBBY && this.menuUpdateTimer > 0 &&
				(this.lastPlayerPtr === allPlayers || players.length === 1 || !players.find(p => p.isLocal && p.disconnected === false))) {
				state = GameState.MENU;
				this.menuUpdateTimer--;
			} else {
				this.menuUpdateTimer = 20;
			}
			this.lastPlayerPtr = allPlayers;

			this.gameCode  = this.IntToGameCode(this.readMemory<number>('int32', this.gameAssembly.modBaseAddr, [this.gameClient, 0x5C, 0x0, 0x40]))
			const hostId = this.readMemory<number>('uint32', this.gameAssembly.modBaseAddr, [this.gameClient, 0x5C, 0x0, 0x44]);
			const clientId = this.readMemory<number>('uint32', this.gameAssembly.modBaseAddr, [this.gameClient, 0x5C, 0x0, 0x48]);

			const newState = {
				lobbyCode: this.gameCode || 'MENU',
				players,
				gameState: state,
				oldGameState: this.oldGameState,
				isHost: (hostId && clientId && hostId === clientId) as boolean,
				hostId: hostId,
				clientId: clientId
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

	constructor(reply: (event: string, ...args: unknown[]) => void, offsets: IOffsets) {
		this.reply = reply;
		this.offsets = offsets;


		this.PlayerStruct = new Struct();
		for (const member of offsets.player.struct) {
			if (member.type === 'SKIP' && member.skip) {
				this.PlayerStruct = this.PlayerStruct.addMember(Struct.TYPES.SKIP(member.skip), member.name);
			} else {
				this.PlayerStruct = this.PlayerStruct.addMember<unknown>(Struct.TYPES[member.type] as ValueType<unknown>, member.name);
			}
		}

	}

	getOffset(signature: string, patternOffset: number = 0x1) : number{
		if (!this.amongUs || !this.gameAssembly) return 0x0;
			const signatureTypes = 0x0 | 0x2;
			const gameclient_function = findPattern(this.amongUs.handle, "GameAssembly.dll", signature, signatureTypes, patternOffset, 0x0);
			return this.readMemory<number>('int', this.gameAssembly.modBaseAddr,[gameclient_function]) -  this.gameAssembly.modBaseAddr;
	}

	readMemory<T>(dataType: DataType, address: number, offsets: number[], defaultParam?: T): T {
		if (!this.amongUs) return defaultParam as T;
		if (address === 0) return defaultParam as T;
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
		address = address & 0xffffffff;
		for (let i = 0; i < offsets.length - 1; i++) {
			address = readMemoryRaw<number>(this.amongUs.handle, address + offsets[i], 'uint32');

			if (address == 0) break;
		}
		const last = offsets.length > 0 ? offsets[offsets.length - 1] : 0;
		return { address, last };
	}
	readString(address: number): string {
		if (address === 0 || !this.amongUs) return '';
		const length = readMemoryRaw<number>(this.amongUs.handle, address + 0x8, 'int');
		const buffer = readBuffer(this.amongUs.handle, address + 0xC, length << 1);
		return buffer.toString('binary').replace(/\0/g, '');
	}
	
	IntToGameCode(input: number) {
		if (input === 0)
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
	
	parsePlayer(ptr: number, buffer: Buffer): Player {
		const { data } = this.PlayerStruct.report<PlayerReport>(buffer, 0, {});

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
       	const clientId = this.readMemory<number>('int', data.objectPtr, [0x1C]  ); //playerdata.ownerId

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
			clientId,
			x, y
		};
	}
}

