declare module 'audio-activity' {
	export default function audioActivity(stream: MediaStream, callback: (level: number) => void): any;
}
declare module 'analyser-frequency-average';