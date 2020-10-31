import { DataType, findModule, getProcesses, ModuleObject, openProcess, ProcessObject, readBuffer, readMemory as readMemoryRaw } from "memoryjs";
import * as Struct from 'structron';
import patcher from '../patcher';

export interface AmongUsState {
	gameState: GameState;
	lobbyCode: string;
	players: Player[];
}
export interface Player {
	ptr: number;
	id: number;
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
	LOBBY, TASKS, DISCUSSION, MENU, UNKNOWN
}

export default class GameReader {
	reply: Function;

	shouldReadLobby = false;
	exileCausesEnd = false;
	oldGameState = GameState.UNKNOWN;
	lastState: AmongUsState = {} as AmongUsState;

	amongUs: ProcessObject | null = null;
	gameAssembly: ModuleObject | null = null;

	gameCode: string = 'MENU';

	checkProcessOpen(): void {
		let processOpen = getProcesses().find(p => p.szExeFile === 'Among Us.exe');
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

	loop(): void {
		this.checkProcessOpen();
		if (this.amongUs !== null && this.gameAssembly !== null) {
			let state = GameState.UNKNOWN;
			let meetingHud = this.readMemory<number>('pointer', this.gameAssembly.modBaseAddr, [0x14686A0, 0x5c, 0]);
			let meetingHud_cachePtr = meetingHud === 0 ? 0 : this.readMemory<number>('uint32', meetingHud, [0x8]);
			let meetingHudState = meetingHud_cachePtr === 0 ? 4 : this.readMemory('int', meetingHud, [0x84], 4);
			let gameState = this.readMemory<number>('int', this.gameAssembly.modBaseAddr, [0x1468840, 0x5C, 0, 0x64]);

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

			let allPlayersPtr = this.readMemory<number>('ptr', this.gameAssembly.modBaseAddr, [0x1468864, 0x5c, 0, 0x24]) & 0xffffffff;
			let allPlayers = this.readMemory<number>('ptr', allPlayersPtr, [0x08]);
			let playerCount = this.readMemory<number>('int' as 'int', allPlayersPtr, [0x0C]);
			let playerAddrPtr = allPlayers + 0x10;
			let players = [];

			let exiledPlayerId = this.readMemory<number>('byte', this.gameAssembly.modBaseAddr, [0xff, 0x14686A0, 0x5c, 0, 0x94, 0x08]);
			let impostors = 0, crewmates = 0;

			for (let i = 0; i < Math.min(playerCount, 10); i++) {
				let { address, last } = this.offsetAddress(playerAddrPtr, [0, 0]);
				let playerData = readBuffer(this.amongUs.handle, address + last, 56);
				let player = this.parsePlayer(address + last, playerData);
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
			this.oldGameState = state;


			let inGame = state === GameState.TASKS || state === GameState.DISCUSSION || state === GameState.LOBBY;
			let newGameCode = 'MENU';
			if (inGame) {
				newGameCode = this.readString(
					this.readMemory<number>('int32', this.gameAssembly.modBaseAddr, [0x13FB424, 0x5c, 0, 0x20, 0x28])
				);
				if (newGameCode) {
					let split = newGameCode.split('\n');
					if (split.length === 2) {
						newGameCode = split[1];
					}
				}
				if (!/^[A-Z]+$/.test(newGameCode)) {
					newGameCode = '';
				}
			}
			if (newGameCode) this.gameCode = newGameCode;

			let newState = {
				lobbyCode: this.gameCode,
				players,
				gameState: state
			};
			let patch = patcher.diff(this.lastState, newState);
			if (patch) this.reply('gameState', newState);
			this.lastState = newState;
		}
	}

	constructor(reply: Function) {
		this.reply = reply;
	}

	readMemory<T>(dataType: DataType, address: number, offsets: number[], defaultParam?: T): T {
		if (address === 0) return defaultParam as T;
		let { address: addr, last } = this.offsetAddress(address, offsets);
		if (addr === 0) return defaultParam as T;
		return readMemoryRaw<T>(
			this.amongUs!.handle,
			addr + last,
			dataType
		);
	}
	offsetAddress(address: number, offsets: number[]): { address: number, last: number } {
		address = address & 0xffffffff;
		for (let i = 0; i < offsets.length - 1; i++) {
			address = readMemoryRaw<number>(this.amongUs!.handle, address + offsets[i], 'uint32');

			if (address == 0) break;
		}
		let last = offsets.length > 0 ? offsets[offsets.length - 1] : 0;
		return { address, last };
	}
	readString(address: number): string {
		if (address === 0) return '';
		let length = readMemoryRaw<number>(this.amongUs!.handle, address + 0x8, 'int');
		// console.log(length);
		// console.log("reading string", length, length << 1);
		let buffer = readBuffer(this.amongUs!.handle, address + 0xC, length << 1);
		return buffer.toString('utf8').replace(/\0/g, '');
	}

	parsePlayer(ptr: number, buffer: Buffer): Player {
		let { data } = PlayerStruct.report(buffer, 0, {});

		let isLocal = this.readMemory<number>('int', data.objectPtr, [0x54]) !== 0;

		let positionOffset = isLocal ? 80 : 60;

		let x = this.readMemory<number>('float', data.objectPtr, [0x60, positionOffset]);
		let y = this.readMemory<number>('float', data.objectPtr, [0x60, positionOffset + 4]);
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
			inVent: this.readMemory<number>('byte', data.objectPtr, [0x31]) > 0,
			isLocal,
			x, y
		};
	}
}


const PlayerStruct = new Struct()
	.addMember(Struct.TYPES.SKIP(8), "unused")
	.addMember(Struct.TYPES.UINT, "id")
	.addMember(Struct.TYPES.UINT, 'name')
	.addMember(Struct.TYPES.UINT, 'color')
	.addMember(Struct.TYPES.UINT, 'hat')
	.addMember(Struct.TYPES.UINT, 'pet')
	.addMember(Struct.TYPES.UINT, 'skin')
	.addMember(Struct.TYPES.UINT, 'disconnected')
	.addMember(Struct.TYPES.UINT, 'taskPtr')
	.addMember(Struct.TYPES.BYTE, 'impostor')
	.addMember(Struct.TYPES.BYTE, 'dead')
	.addMember(Struct.TYPES.SKIP(2), "unused")
	.addMember(Struct.TYPES.UINT, 'objectPtr');