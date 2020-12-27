declare module 'memoryjs' {
	type Callback<T> = (error: unknown, value: T) => void;

	// Processes

	export interface ProcessObject {
		dwSize: number;
		th32ProcessID: number;
		cntThreads: number;
		th32ParentProcessID: number;
		pcPriClassBase: number;
		szExeFile: string;
		modBaseAddr: number;
		handle: number;
	}

	export function openProcess(
		identifier: string,
		callback?: Callback<ProcessObject>
	): ProcessObject;

	export function getProcesses(
		callback?: Callback<ProcessObject[]>
	): ProcessObject[];
	export function getProcesses(
		processId: number,
		callback?: Callback<ModuleObject[]>
	): ModuleObject[];

	// Modules

	export interface ModuleObject {
		modBaseAddr: number;
		modBaseSize: number;
		szExePath: string;
		szModule: string;
		th32ProcessID: number;
	}

	export function findModule(
		identifier: string,
		processId: number,
		callback?: Callback<ModuleObject>
	): ModuleObject;

	// Memory

	export type Vector3 = { x: number; y: number; z: number };
	export type Vector4 = { x: number; y: number; z: number; w: number };
	export type DataType =
		| 'byte'
		| 'int'
		| 'int32'
		| 'uint32'
		| 'int64'
		| 'uint64'
		| 'dword'
		| 'short'
		| 'long'
		| 'float'
		| 'double'
		| 'bool'
		| 'boolean'
		| 'ptr'
		| 'pointer'
		| 'str'
		| 'string'
		| 'vec3'
		| 'vector3'
		| 'vec4'
		| 'vector4';

	export function readMemory<T>(
		handle: number,
		address: number,
		dataType: DataType,
		callback?: Callback<T>
	): T;

	export function readBuffer(
		handle: number,
		address: number,
		size: number,
		callback?: Callback<Buffer>
	): Buffer;

	export function writeMemory<T>(
		handle: number,
		address: number,
		value: T,
		dataType: DataType
	): void;

	export function writeBuffer(
		handle: number,
		address: number,
		buffer: Buffer
	): void;

	export function findPattern(
		handle: number,
		moduleName: string,
		signature: string,
		signatureType: number,
		patternOffset: number,
		addressOffset: number
	): number;

	// Functions

	// export enum ArgType { T_VOID, T_STRING, T_CHAR, T_BOOL, T_INT, T_DOUBLE, T_FLOAT }
	export const T_VOID = 0x0;
	export const T_STRING = 0x1;
	export const T_CHAR = 0x2;
	export const T_BOOL = 0x3;
	export const T_INT = 0x4;
	export const T_DOUBLE = 0x5;
	export const T_FLOAT = 0x6;

	export type FunctionArg = { type: number; value: unknown };

	export interface FunctionResult<T> {
		returnValue: T;
		exitCode: number;
	}

	export function callFunction<T>(
		handle: number,
		args: FunctionArg[],
		returnType: number,
		address: number
	): FunctionResult<T>;
}
