import analyserFrequency from 'analyser-frequency-average';

interface VADOptions {
	fftSize: number;
	bufferLen: number;
	smoothingTimeConstant: number;
	minCaptureFreq: number;
	maxCaptureFreq: number;
	noiseCaptureDuration: number;
	minNoiseLevel: number;
	maxNoiseLevel: number;
	avgNoiseMultiplier: number;
	onVoiceStart: () => void;
	onVoiceStop: () => void;
	onUpdate: (val: number) => void;
	stereo: boolean;
}

export default function (audioContext: AudioContext, source: AudioNode, destination: AudioNode | undefined, opts: Partial<VADOptions>): {
	connect: () => void,
	destroy: () => void
} {

	opts = opts || {};

	const defaults: VADOptions = {
		fftSize: 1024,
		bufferLen: 1024,
		smoothingTimeConstant: 0.2,
		minCaptureFreq: 85,         // in Hz
		maxCaptureFreq: 255,        // in Hz
		noiseCaptureDuration: 1000, // in ms
		minNoiseLevel: 0.3,         // from 0 to 1
		maxNoiseLevel: 0.7,         // from 0 to 1
		avgNoiseMultiplier: 1.2,
		onVoiceStart: function () { /* DO NOTHING */ },
		onVoiceStop: function () { /* DO NOTHING */ },
		onUpdate: function () { /* DO NOTHING */ },
		stereo: true
	};

	const options: VADOptions = Object.assign({}, defaults, opts);

	let baseLevel = 0;
	let voiceScale = 1;
	let activityCounter = 0;
	const activityCounterMin = 0;
	const activityCounterMax = 30;
	const activityCounterThresh = 5;

	let envFreqRange: number[] = [];
	let isNoiseCapturing = true;
	let prevVadState: boolean | undefined = undefined;
	let vadState = false;
	let captureTimeout: number | null = null;

	// var source = audioContext.createMediaStreamSource(stream);
	const analyser = audioContext.createAnalyser();
	analyser.smoothingTimeConstant = options.smoothingTimeConstant;
	analyser.fftSize = options.fftSize;

	const channels = options.stereo ? 2 : 1;
	const scriptProcessorNode = audioContext.createScriptProcessor(options.bufferLen, channels, channels);
	connect();
	scriptProcessorNode.onaudioprocess = monitor;

	if (isNoiseCapturing) {
		//console.log('VAD: start noise capturing');
		captureTimeout = setTimeout(init, options.noiseCaptureDuration) as unknown as number;
	}

	function init() {
		//console.log('VAD: stop noise capturing');
		isNoiseCapturing = false;

		envFreqRange = envFreqRange.filter(function (val) {
			return val;
		}).sort();
		const averageEnvFreq = envFreqRange.length ? envFreqRange.reduce(function (p, c) { return Math.min(p, c); }, 1) : (options.minNoiseLevel || 0.1);

		baseLevel = averageEnvFreq * options.avgNoiseMultiplier;
		if (options.minNoiseLevel && baseLevel < options.minNoiseLevel) baseLevel = options.minNoiseLevel;
		if (options.maxNoiseLevel && baseLevel > options.maxNoiseLevel) baseLevel = options.maxNoiseLevel;

		voiceScale = 1 - baseLevel;

		//console.log('VAD: base level:', baseLevel);
	}

	function connect() {
		source.connect(analyser);
		analyser.connect(scriptProcessorNode);
		if (destination)
			scriptProcessorNode.connect(destination);
		else
			scriptProcessorNode.connect(audioContext.destination);
	}

	function disconnect() {
		scriptProcessorNode.disconnect();
		analyser.disconnect();
		source.disconnect();
		if (destination) {
			destination.disconnect();
			source.connect(destination);
		}
	}

	function destroy() {
		captureTimeout && clearTimeout(captureTimeout);
		disconnect();
		scriptProcessorNode.onaudioprocess = null;
	}

	function monitor(event: AudioProcessingEvent) {
		if (destination) {
			for (let channel = 0; channel < event.outputBuffer.numberOfChannels; channel++) {

				const inputData = event.inputBuffer.getChannelData(channel);
				const outputData = event.outputBuffer.getChannelData(channel);
				for (let sample = 0; sample < event.inputBuffer.length; sample++) {
					// make output equal to the same as the input
					outputData[sample] = inputData[sample];
				}
			}
		}
		const frequencies = new Uint8Array(analyser.frequencyBinCount);
		analyser.getByteFrequencyData(frequencies);

		const average = analyserFrequency(analyser, frequencies, options.minCaptureFreq, options.maxCaptureFreq);
		if (isNoiseCapturing) {
			envFreqRange.push(average);
			return;
		}

		if (average >= baseLevel && activityCounter < activityCounterMax) {
			activityCounter++;
		} else if (average < baseLevel && activityCounter > activityCounterMin) {
			activityCounter--;
		}
		vadState = activityCounter > activityCounterThresh;

		if (prevVadState !== vadState) {
			vadState ? onVoiceStart() : onVoiceStop();
			prevVadState = vadState;
		}

		options.onUpdate(Math.max(0, average - baseLevel) / voiceScale);
	}

	function onVoiceStart() {
		options.onVoiceStart();
	}

	function onVoiceStop() {
		options.onVoiceStop();
	}

	return { connect, destroy };
}
