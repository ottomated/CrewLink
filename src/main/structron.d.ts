declare module 'structron' {
	type ReportOptions = {
		monitorUsage: boolean;
	}
	
	class Report<T> {
		constructor(buffer: BufferSource, options: ReportOptions);
		toString(): string;
		getUsage(): number;
		data: T;
	}
	interface ValueType<T> {
		read(buffer: BufferSource, offset: number): T;
		SIZE: number;
	}

	type Rule = (...params: unknown[]) => (dataObj: unknown, buffer: BufferSource) => boolean;
	class Struct implements ValueType<Struct> {

		constructor(name?: string);

		addMember<T>(type: ValueType<T>, name: string): this;
		addArray<T>(type: ValueType<T>, name: string, offsetMemberName: string, countMemberName: string, relative?: boolean): this;
		addReference<T>(type: ValueType<T>, name: string, memberName: string, relative?: boolean): this;
		addRule(rule: Rule): this;
		read<T>(buffer: BufferSource, offset: number, report?: Report<T>): T;
		report<T>(buffer: BufferSource, offset: number, options: Partial<ReportOptions>): Report<T>;
		validate(buffer: BufferSource, offset?: number): boolean;
		getOffsetByName(name: string): number;

		get SIZE(): number;

		static RULES: {
			EQUAL: Rule;
		}

		static TYPES: {
			INT: ValueType<number>;
			INT_BE: ValueType<number>;
			UINT: ValueType<number>;
			UINT_BE: ValueType<number>;
			SHORT: ValueType<number>;
			SHORT_BE: ValueType<number>;
			USHORT: ValueType<number>;
			USHORT_BE: ValueType<number>;
			FLOAT: ValueType<number>;
			CHAR: ValueType<number>;
			BYTE: ValueType<number>;
			STRING(length: number, encoding: string | 'ascii'): ValueType<string>;
			NULL_TERMINATED_STRING(encoding: string | 'ascii'): ValueType<string>;
			SKIP(length: number): ValueType<void>;
		}
	}
	export = Struct;
}