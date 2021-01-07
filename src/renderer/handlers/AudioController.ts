// import { EventEmitter as EventEmitterO } from 'events';
// import * as io from 'socket.io-client';
// import { AmongUsState, GameState, Player } from './AmongUsState';
// import { SocketElementMap, SocketElement, Client, AudioElement, IDeviceInfo } from './smallInterfaces';

// export default class AudioController extends EventEmitterO {
// 	audioDeviceId = 'default';
// 	stream: MediaStream;

// 	async startAudio() {
// 		const audio: MediaTrackConstraintSet = {
// 			deviceId: this.audioDeviceId,
// 			autoGainControl: false,
// 			echoCancellation: true,
// 			latency: 0,
// 			noiseSuppression: true,
// 		};

// 		this.stream = await navigator.mediaDevices.getUserMedia({ video: false, audio });

// 		console.log('connected to microphone');
// 	}

// 	createAudioElement(stream: MediaStream): AudioElement {
// 		console.log('[createAudioElement]');
// 		const htmlAudioElement = document.createElement('audio');
// 		document.body.appendChild(htmlAudioElement);
// 		htmlAudioElement.srcObject = stream;

// 		const context = new AudioContext();
// 		const source = context.createMediaStreamSource(stream);
// 		const gain = context.createGain();
// 		const pan = context.createPanner();
// 		const compressor = context.createDynamicsCompressor();

// 		pan.refDistance = 0.1;
// 		pan.panningModel = 'equalpower';
// 		pan.distanceModel = 'linear';
// 		pan.maxDistance = 6;
// 		pan.rolloffFactor = 1;

// 		source.connect(pan);
// 		pan.connect(gain);
// 		gain.connect(compressor);
// 		gain.gain.value = 0;
// 		htmlAudioElement.volume = 1;
// 		const audioContext = pan.context;
// 		const panPos = [3, 0];
// 		pan.positionZ.setValueAtTime(-0.5, audioContext.currentTime);
// 		pan.positionX.setValueAtTime(panPos[0], audioContext.currentTime);
// 		pan.positionY.setValueAtTime(panPos[1], audioContext.currentTime);
// 		compressor.connect(context.destination);

// 		return {
// 			htmlAudioElement,
// 			audioContext: context,
// 			mediaStreamAudioSource: source,
// 			gain,
// 			pan,
// 			compressor,
// 		};
// 	}

// 	// move to different controller
// 	updateAudioLocation(currentGameState: AmongUsState, element: SocketElement, localPLayer: Player) {
// 		//		console.log('updateAudioLocation ->', { element });
// 		if (!element.audioElement || !element.client) {
// 			return;
// 		}
// 		//	console.log('[updateAudioLocation]');
// 		const pan = element.audioElement.pan;
// 		const gain = element.audioElement.gain;
// 		const audioContext = pan.context;

// 		const other = element.player; // this.getPlayer(element.client?.clientId);
// 		let panPos = [other.x - localPLayer.x, other.y - localPLayer.y];
// 		switch (currentGameState.gameState) {
// 			case GameState.MENU:
// 				gain.gain.value = 0;
// 				break;

// 			case GameState.LOBBY:
// 				gain.gain.value = 1;
// 				break;

// 			case GameState.TASKS:
// 				gain.gain.value = 1;

// 				// Mute other players which are in a vent
// 				if (other.inVent) {
// 					gain.gain.value = 0;
// 				}

// 				// Mute dead players for still living players
// 				if (!localPLayer.isDead && other.isDead) {
// 					gain.gain.value = 0;
// 				}

// 				break;

// 			case GameState.DISCUSSION:
// 				panPos = [0, 0];
// 				gain.gain.value = 1;

// 				// Mute dead players for still living players
// 				if (!localPLayer.isDead && other.isDead) {
// 					gain.gain.value = 0;
// 				}
// 				break;

// 			case GameState.UNKNOWN:
// 			default:
// 				gain.gain.value = 0;
// 				break;
// 		}

// 		pan.positionX.setValueAtTime(panPos[0], audioContext.currentTime);
// 		pan.positionY.setValueAtTime(panPos[1], audioContext.currentTime);
// 		pan.positionZ.setValueAtTime(-0.5, audioContext.currentTime);
// 	}

// 	disconnect(socketElementmap: SocketElementMap) {
// 		this.stream.getTracks().forEach((track) => track.stop());
// 		socketElementmap.forEach((value) => this.disconnectElement(value));
// 	}

// 	disconnectElement(socketElement: SocketElement) {
// 		if (!socketElement.audioElement) {
// 			return;
// 		}
// 		socketElement?.audioElement?.compressor?.disconnect();
// 		socketElement?.audioElement?.pan?.disconnect();
// 		socketElement?.audioElement?.gain?.disconnect();
// 		socketElement?.audioElement?.mediaStreamAudioSource?.disconnect();
// 		socketElement?.audioElement?.audioContext
// 			?.close()
// 			.then(() => {})
// 			.catch(() => {});
// 		socketElement?.audioElement?.htmlAudioElement.remove();
// 		socketElement.peer?.destroy();
// 		socketElement.audioElement = undefined;
// 		socketElement.peer = undefined;
// 	}

// 	async getDevices(): Promise<IDeviceInfo[]> {
// 		let deviceId = 0;
// 		return (await navigator.mediaDevices.enumerateDevices())
// 			.filter((o) => o.kind === 'audiooutput')
// 			.map((o) => {
// 				return {
// 					label: o.label || `Microphone ${deviceId++}`,
// 					deviceId: o.deviceId,
// 				};
// 			});
// 	}
// }

// export const audioController = new AudioController();
