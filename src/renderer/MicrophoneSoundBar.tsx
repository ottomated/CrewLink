import React, { useEffect, useState } from 'react';

interface TestMicProps {
	microphone: string
}

const TestMicrophoneButton: React.FC<TestMicProps> = function ({ microphone } : TestMicProps) {
	const [error, setError] = useState<boolean>(false);
	const [rms, setRms] = useState<number>(0);

	useEffect(() => {
		setError(false);

		const ctx = new AudioContext();
		const processor = ctx.createScriptProcessor(2048, 1, 1);
		processor.connect(ctx.destination);

		const minUpdateRate = 50;
		let lastRefreshTime = 0;

		const handleProcess = (event: AudioProcessingEvent) => {
			// limit update frequency
			if (event.timeStamp - lastRefreshTime < minUpdateRate) {
				return;
			}

			// update last refresh time
			lastRefreshTime = event.timeStamp;

			const input = event.inputBuffer.getChannelData(0);
			const total = input.reduce((acc, val) => acc + Math.abs(val), 0);
			const rms = Math.min(50, Math.sqrt(total / input.length));
			setRms(rms);
		};

		navigator.mediaDevices.getUserMedia({ audio: { deviceId: microphone ?? 'default' } })
			.then((stream) => {
				const src = ctx.createMediaStreamSource(stream);
				src.connect(processor);
				processor.addEventListener('audioprocess', handleProcess);
			})
			.catch(() => setError(true));

		return () => {
			processor.removeEventListener('audioprocess', handleProcess);
		};
	}, [microphone]);

	if (error) return <p style={{ fontSize: 14, color: '#e74c3c' }}>Could not connect to microphone</p>;

	return <div className="microphone-bar"><div className="microphone-bar-inner" style={{ width: `${rms * 2 * 100}%` }}></div></div>;
};

export default TestMicrophoneButton;
