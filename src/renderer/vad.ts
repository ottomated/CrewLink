import analyserFrequency from 'analyser-frequency-average';

interface VADOptions {
	fftSize?: number;
	bufferLen?: number;
	smoothingTimeConstant?: number;
	minCaptureFreq?: number;
	maxCaptureFreq?: number;
	noiseCaptureDuration?: number;
	minNoiseLevel?: number;
	maxNoiseLevel?: number;
	avgNoiseMultiplier?: number;
	onVoiceStart?: () => void;
	onVoiceStop?: () => void;
	onUpdate?: (val: number) => void;
}

export default function (audioContext: AudioContext, source: AudioNode, destination: AudioNode | undefined, opts: VADOptions) {

	opts = opts || {};

	var defaults = {
		fftSize: 1024,
		bufferLen: 1024,
		smoothingTimeConstant: 0.2,
		minCaptureFreq: 85,         // in Hz
		maxCaptureFreq: 255,        // in Hz
		noiseCaptureDuration: 1000, // in ms
		minNoiseLevel: 0.3,         // from 0 to 1
		maxNoiseLevel: 0.7,         // from 0 to 1
		avgNoiseMultiplier: 1.2,
		onVoiceStart: () => { },
		onVoiceStop: () => { },
		onUpdate: (_: number) => { }
	};

	var options: any = {};
	for (var key in defaults) {
		options[key] = opts.hasOwnProperty(key) ? (opts as any)[key] : (defaults as any)[key];
	}

	var baseLevel = 0;
	var voiceScale = 1;
	var activityCounter = 0;
	var activityCounterMin = 0;
	var activityCounterMax = 30;
	var activityCounterThresh = 5;

	var envFreqRange: number[] = [];
	var isNoiseCapturing = true;
	var prevVadState: boolean | undefined = undefined;
	var vadState = false;
	var captureTimeout: any = null;

	// var source = audioContext.createMediaStreamSource(stream);
	var analyser = audioContext.createAnalyser();
	analyser.smoothingTimeConstant = options.smoothingTimeConstant;
	analyser.fftSize = options.fftSize;

	var scriptProcessorNode = audioContext.createScriptProcessor(options.bufferLen, 1, 1);
	connect();
	scriptProcessorNode.onaudioprocess = monitor;

	if (isNoiseCapturing) {
		//console.log('VAD: start noise capturing');
		captureTimeout = setTimeout(init, options.noiseCaptureDuration);
	}

	function init() {
		//console.log('VAD: stop noise capturing');
		isNoiseCapturing = false;

		envFreqRange = envFreqRange.filter(function (val) {
			return val;
		}).sort();
		var averageEnvFreq = envFreqRange.length ? envFreqRange.reduce(function (p, c) { return Math.min(p, c) }, 1) : (options.minNoiseLevel || 0.1);

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

				var inputData = event.inputBuffer.getChannelData(channel);
				var outputData = event.outputBuffer.getChannelData(channel);
				for (var sample = 0; sample < event.inputBuffer.length; sample++) {
					// make output equal to the same as the input
					outputData[sample] = inputData[sample];
				}
			}
		}
		var frequencies = new Uint8Array(analyser.frequencyBinCount);
		analyser.getByteFrequencyData(frequencies);

		var average = analyserFrequency(analyser, frequencies, options.minCaptureFreq, options.maxCaptureFreq);
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
};