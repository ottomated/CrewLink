import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import io, { Socket } from 'socket.io-client';
import Avatar from './Avatar';
import { GameStateContext, LobbySettingsContext, SettingsContext } from './contexts';
import {
	AmongUsState,
	GameState,
	Player,
	SocketClientMap,
	AudioConnected,
	OtherTalking,
	Client,
	VoiceState,
	OtherDead,
} from '../common/AmongUsState';
import Peer from 'simple-peer';
import { ipcRenderer } from 'electron';
import VAD from './vad';
import { ISettings, playerConfigMap, ILobbySettings } from '../common/ISettings';
import { IpcRendererMessages, IpcMessages, IpcOverlayMessages } from '../common/ipc-messages';
import Typography from '@material-ui/core/Typography';
import Grid from '@material-ui/core/Grid';
import makeStyles from '@material-ui/core/styles/makeStyles';
import SupportLink from './SupportLink';
import Divider from '@material-ui/core/Divider';
import { validateClientPeerConfig } from './validateClientPeerConfig';
// @ts-ignore
import reverbOgx from 'arraybuffer-loader!../../static/reverb.ogx';
import { CameraLocation, PolusMap, SkeldMap } from '../common/AmongusMap';
import Store from 'electron-store';
import { ObsVoiceState } from '../common/ObsOverlay';
import { poseCollide } from '../common/ColliderMap';
import adapter from 'webrtc-adapter';

console.log(adapter.browserDetails.browser);

export interface ExtendedAudioElement extends HTMLAudioElement {
	setSinkId: (sinkId: string) => Promise<void>;
}

interface PeerConnections {
	[peer: string]: Peer.Instance;
}

interface AudioNodes {
	dummyAudioElement: HTMLAudioElement;
	audioElement: HTMLAudioElement;
	gain: GainNode;
	pan: PannerNode;
	reverb: ConvolverNode;
	muffle: BiquadFilterNode;
	destination: AudioNode;
	reverbConnected: boolean;
	muffleConnected: boolean;
}

interface AudioElements {
	[peer: string]: AudioNodes;
}

interface ConnectionStuff {
	socket?: typeof Socket;
	overlaySocket?: typeof Socket;
	stream?: MediaStream;
	pushToTalk: boolean;
	deafened: boolean;
	muted: boolean;
}

interface SocketError {
	message?: string;
}

interface ClientPeerConfig {
	forceRelayOnly: boolean;
	iceServers: RTCIceServer[];
}

const DEFAULT_ICE_CONFIG: RTCConfiguration = {
	iceTransportPolicy: 'all',
	iceServers: [
		{
			urls: 'stun:stun.l.google.com:19302',
		},
	],
};

const DEFAULT_ICE_CONFIG_TURN: RTCConfiguration = {
	iceTransportPolicy: 'relay',
	iceServers: [
		{
			urls: 'turn:turn.bettercrewl.ink:3478',
			username: 'M9DRVaByiujoXeuYAAAG',
			credential: 'TpHR9HQNZ8taxjb3',
		},
	],
};

export interface VoiceProps {
	error: string;
}

const useStyles = makeStyles((theme) => ({
	error: {
		position: 'absolute',
		top: '50%',
		transform: 'translateY(-50%)',
	},
	root: {
		paddingTop: theme.spacing(3),
	},
	top: {
		display: 'flex',
		justifyContent: 'center',
		alignItems: 'center',
	},
	right: {
		display: 'flex',
		flexDirection: 'column',
		alignItems: 'center',
		justifyContent: 'center',
	},
	username: {
		display: 'block',
		textAlign: 'center',
		fontSize: 20,
	},
	code: {
		fontFamily: "'Source Code Pro', monospace",
		display: 'block',
		width: 'fit-content',
		margin: '5px auto',
		padding: 5,
		borderRadius: 5,
		fontSize: 28,
	},
	otherplayers: {
		width: 225,
		height: 225,
		margin: '4px auto',
		'& .MuiGrid-grid-xs-1': {
			maxHeight: '8.3333333%',
		},
		'& .MuiGrid-grid-xs-2': {
			maxHeight: '16.666667%',
		},
		'& .MuiGrid-grid-xs-3': {
			maxHeight: '25%',
		},
		'& .MuiGrid-grid-xs-4': {
			maxHeight: '33.333333%',
		},
	},
	avatarWrapper: {
		width: 80,
		padding: theme.spacing(1),
	},
}));

const defaultlocalLobbySettings: ILobbySettings = {
	maxDistance: 5.32,
	haunting: false,
	hearImpostorsInVents: false,
	impostersHearImpostersInvent: false,
	commsSabotage: false,
	deadOnly: false,
	hearThroughCameras: false,
	wallsBlockAudio: false,
	meetingGhostOnly: false,
	visionHearing: false,
};

const store = new Store<ISettings>();
const Voice: React.FC<VoiceProps> = function ({ error: initialError }: VoiceProps) {
	const [error, setError] = useState(initialError);
	const [settings, setSettings] = useContext(SettingsContext);

	const settingsRef = useRef<ISettings>(settings);
	const [lobbySettings, setLobbySettings] = useContext(LobbySettingsContext);
	const lobbySettingsRef = useRef(lobbySettings);
	const maxDistanceRef = useRef(2);
	const gameState = useContext(GameStateContext);
	const hostRef = useRef({
		mobileRunning: false,
		gamestate: gameState.gameState,
		code: gameState.lobbyCode,
		hostId: gameState.hostId,
		isHost: gameState.isHost,
	});
	let { lobbyCode: displayedLobbyCode } = gameState;
	if (displayedLobbyCode !== 'MENU' && settings.hideCode) displayedLobbyCode = 'LOBBY';
	const [talking, setTalking] = useState(false);
	const [socketClients, setSocketClients] = useState<SocketClientMap>({});
	const [playerConfigs] = useState<playerConfigMap>(settingsRef.current.playerConfigMap);
	const socketClientsRef = useRef(socketClients);
	const [peerConnections, setPeerConnections] = useState<PeerConnections>({});
	const convolverBuffer = useRef<AudioBuffer | null>(null);

	const [connect, setConnect] = useState<{
		connect: (lobbyCode: string, playerId: number, clientId: number, isHost: boolean) => void;
	} | null>(null);
	const [otherTalking, setOtherTalking] = useState<OtherTalking>({});
	const [otherDead, setOtherDead] = useState<OtherDead>({});
	const audioElements = useRef<AudioElements>({});
	const [audioConnected, setAudioConnected] = useState<AudioConnected>({});
	const classes = useStyles();

	const [deafenedState, setDeafened] = useState(false);
	const [mutedState, setMuted] = useState(false);
	const [connected, setConnected] = useState(false);

	function applyEffect(gain: AudioNode, effectNode: AudioNode, destination: AudioNode, player: Player) {
		try {
			gain.disconnect(destination);
			gain.connect(effectNode);
			effectNode.connect(destination);
		} catch {
			console.log('error with applying effect: ', player.name, effectNode);
		}
	}

	function restoreEffect(gain: AudioNode, effectNode: AudioNode, destination: AudioNode, player: Player) {
		try {
			effectNode.disconnect(destination);
			gain.disconnect(effectNode);
			gain.connect(destination);
		} catch {
			console.log('error with applying effect: ', player.name, effectNode);
		}
	}
	function calculateVoiceAudio(
		state: AmongUsState,
		settings: ISettings,
		me: Player,
		other: Player,
		audio: AudioNodes
	): number {
		const { pan, gain, muffle, reverb, destination } = audio;
		const audioContext = pan.context;
		const useLightSource = true;
		let maxdistance = maxDistanceRef.current;
		let panPos = [other.x - me.x, other.y - me.y];
		let endGain = 0;
		let collided = false;
		switch (state.gameState) {
			case GameState.MENU:
				endGain = 0;
				break;

			case GameState.LOBBY:
				endGain = 1;
				break;

			case GameState.TASKS:
				endGain = 1;

				if (lobbySettings.meetingGhostOnly) {
					endGain = 0;
				}
				if (!me.isDead && lobbySettings.commsSabotage && state.comsSabotaged && !me.isImpostor) {
					endGain = 0;
				}

				// Mute other players which are in a vent
				if (
					other.inVent &&
					!(lobbySettings.hearImpostorsInVents || (lobbySettings.impostersHearImpostersInvent && me.inVent))
				) {
					endGain = 0;
				}
				if (
					lobbySettings.wallsBlockAudio &&
					!me.isDead &&
					poseCollide({ x: me.x, y: me.y }, { x: other.x, y: other.y }, gameState.map, gameState.closedDoors)
				) {
					collided = true;
				}

				if (!me.isDead && other.isDead && me.isImpostor && lobbySettings.haunting) {
					if (!audio.reverbConnected) {
						audio.reverbConnected = true;
						applyEffect(gain, reverb, destination, other);
					}
					collided = false;
					endGain = 0.2;
				} else {
					if (other.isDead && !me.isDead) {
						endGain = 0;
					}
				}

				break;
			case GameState.DISCUSSION:
				panPos = [0, 0];
				endGain = 1;
				// Mute dead players for still living players
				if (!me.isDead && other.isDead) {
					endGain = 0;
				}
				break;

			case GameState.UNKNOWN:
			default:
				endGain = 0;
				break;
		}

		if (useLightSource && state.lightRadiusChanged) {
			pan.maxDistance = maxDistanceRef.current;
		}

		if (!other.isDead || state.gameState !== GameState.TASKS || !me.isImpostor || me.isDead) {
			if (audio.reverbConnected && reverb) {
				audio.reverbConnected = false;
				restoreEffect(gain, reverb, destination, other);
			}
		}

		if (lobbySettings.deadOnly) {
			panPos = [0, 0];
			if (!me.isDead || !other.isDead) {
				endGain = 0;
			}
		}

		let isOnCamera = state.currentCamera !== CameraLocation.NONE;

		// Mute players if distancte between two players is too big
		// console.log({ x: other.x, y: other.y }, Math.sqrt(panPos[0] * panPos[0] + panPos[1] * panPos[1]));
		//console.log(state.currentCamera);

		if (Math.sqrt(panPos[0] * panPos[0] + panPos[1] * panPos[1]) > maxdistance) {
			if (lobbySettings.hearThroughCameras && state.gameState === GameState.TASKS) {
				if (state.currentCamera !== CameraLocation.NONE && state.currentCamera !== CameraLocation.Skeld) {
					const camerapos = PolusMap.cameras[state.currentCamera];
					panPos = [other.x - camerapos.x, other.y - camerapos.y];
				} else if (state.currentCamera === CameraLocation.Skeld) {
					let distance = 999;
					let camerapos = { x: 999, y: 999 };
					for (const camera of Object.values(SkeldMap.cameras)) {
						const cameraDist = Math.sqrt(Math.pow(other.x - camera.x, 2) + Math.pow(other.y - camera.y, 2));
						if (distance > cameraDist) {
							distance = cameraDist;
							camerapos = camera;
						}
					}
					if (distance != 999) {
						panPos = [other.x - camerapos.x, other.y - camerapos.y];
					}
				}

				if (Math.sqrt(panPos[0] * panPos[0] + panPos[1] * panPos[1]) > maxdistance) {
					return 0;
				}
			} else {
				return 0;
			}
		} else {
			if (collided) {
				return 0;
			}
			isOnCamera = false;
		}

		// Muffling in vents
		if (
			((me.inVent && !me.isDead) || (other.inVent && !other.isDead) || isOnCamera) &&
			state.gameState === GameState.TASKS
		) {
			if (!audio.muffleConnected) {
				audio.muffleConnected = true;
				applyEffect(gain, muffle, destination, other);
			}
			maxdistance = isOnCamera ? 3 : 0.8;
			muffle.frequency.value = isOnCamera ? 2300 : 2000;
			muffle.Q.value = isOnCamera ? -15 : 20;
			if (endGain === 1) endGain = isOnCamera ? 0.8 : 0.5; // Too loud at 1
		} else {
			if (audio.muffleConnected) {
				audio.muffleConnected = false;
				restoreEffect(gain, muffle, destination, other);
			}
		}

		if (!settings.enableSpatialAudio) {
			panPos = [0, 0];
		}
		pan.positionX.setValueAtTime(panPos[0], audioContext.currentTime);
		pan.positionY.setValueAtTime(panPos[1], audioContext.currentTime);
		pan.positionZ.setValueAtTime(-0.5, audioContext.currentTime);
		return endGain;
	}

	function notifyMobilePlayers() {
		if (settingsRef.current.mobileHost && hostRef.current.gamestate !== GameState.MENU && hostRef.current.gamestate !== GameState.UNKNOWN ) {
			connectionStuff.current.socket?.emit('signal', {
				to: hostRef.current.code + '_mobile',
				data: { mobileHostInfo: { isHostingMobile: true, isGameHost: hostRef.current.isHost } },
			});
			setTimeout(() => notifyMobilePlayers(), 5000);
		}
	}

	function disconnectAudioHtmlElement(element: HTMLAudioElement) {
		console.log('disableing element?', element);
		element.pause();
		if (element.srcObject) {
			const mediaStream = element.srcObject as MediaStream;
			mediaStream.getTracks().forEach((track) => track.stop());
		}
		element.removeAttribute('srcObject');
		element.removeAttribute('src');
		element.srcObject = null;
		element.load();
		element.remove();
	}
	function disconnectPeer(peer: string) {
		const connection = peerConnections[peer];
		if (!connection) {
			return;
		}
		connection.destroy();
		setPeerConnections((connections) => {
			delete connections[peer];
			return connections;
		});
		if (audioElements.current[peer]) {
			console.log('removing element..');
			disconnectAudioHtmlElement(audioElements.current[peer].audioElement);
			disconnectAudioHtmlElement(audioElements.current[peer].dummyAudioElement);
			audioElements.current[peer].pan.disconnect();
			audioElements.current[peer].gain.disconnect();
			// if (audioElements.current[peer].reverbGain != null) audioElements.current[peer].reverbGain?.disconnect();
			if (audioElements.current[peer].reverb != null) audioElements.current[peer].reverb?.disconnect();
			delete audioElements.current[peer];
		}
	}
	// Handle pushToTalk, if set
	useEffect(() => {
		if (!connectionStuff.current.stream) return;
		connectionStuff.current.stream.getAudioTracks()[0].enabled = !settings.pushToTalk;
		connectionStuff.current.pushToTalk = settings.pushToTalk;
	}, [settings.pushToTalk]);

	// Emit lobby settings to connected peers
	useEffect(() => {
		if (gameState.isHost !== true) return;
		Object.values(peerConnections).forEach((peer) => {
			try {
				console.log('sendxx > ', JSON.stringify(settings.localLobbySettings));
				peer.send(JSON.stringify(settings.localLobbySettings));
			} catch (e) {
				console.warn('failed to update lobby settings: ', e);
			}
		});
		Object.keys(lobbySettings).forEach((field: string) => {
			if (field in lobbySettings) {
				setLobbySettings({
					type: 'set',
					action: settings.localLobbySettings,
				});
			}
		});
	}, [settings.localLobbySettings]);

	useEffect(() => {
		for (const peer in audioElements.current) {
			audioElements.current[peer].pan.maxDistance = maxDistanceRef.current;
		}
	}, [lobbySettings.maxDistance, lobbySettings.visionHearing]);

	useEffect(() => {
		if (
			!gameState ||
			!gameState.players ||
			!connectionStuff.current.socket ||
			(!hostRef.current.mobileRunning && !settings.obsOverlay)
		) {
			return;
		}
		if (hostRef.current.mobileRunning) {
			connectionStuff.current.socket?.emit('signal', {
				to: gameState.lobbyCode + '_mobile',
				data: { gameState, lobbySettings },
			});
		}

		if (
			settings.obsOverlay &&
			settings.obsSecret &&
			settings.obsSecret.length === 9 &&
			((gameState.gameState !== GameState.UNKNOWN && gameState.gameState !== GameState.MENU) ||
				gameState.oldGameState !== gameState.gameState)
		) {
			if (!connectionStuff.current.overlaySocket) {
				if (settings.obsComptaibilityMode && settings.obsOverlay && !settings.serverURL.includes('bettercrewl.ink')) {
					connectionStuff.current.overlaySocket = io('https://bettercrewl.ink', {
						transports: ['websocket'],
					});
				} else {
					connectionStuff.current.overlaySocket = connectionStuff.current.socket;
				}
			}

			const obsvoiceState: ObsVoiceState = {
				overlayState: {
					gameState: gameState.gameState,
					players: gameState.players.map((o) => ({
						id: o.id,
						clientId: o.clientId,
						inVent: o.inVent,
						isDead: o.isDead,
						name: o.name,
						colorId: o.colorId,
						hatId: o.hatId,
						petId: o.petId,
						skinId: o.skinId,
						disconnected: o.disconnected,
						isLocal: o.isLocal,
						bugged: o.bugged,
						connected:
							(playerSocketIds[o.clientId] && socketClients[playerSocketIds[o.clientId]]?.clientId === o.clientId) ||
							false,
					})),
				},
				otherTalking,
				otherDead,
				localTalking: talking,
				localIsAlive: !myPlayer?.isDead,
			};
			connectionStuff.current.overlaySocket?.emit('signal', {
				to: settings.obsSecret,
				data: obsvoiceState,
			});
		}
	}, [gameState]);

	// Add settings to settingsRef
	useEffect(() => {
		settingsRef.current = settings;
	}, [settings]);

	// Add socketClients to socketClientsRef
	useEffect(() => {
		socketClientsRef.current = socketClients;
	}, [socketClients]);

	// Add lobbySettings to lobbySettingsRef
	useEffect(() => {
		lobbySettingsRef.current = lobbySettings;
	}, [lobbySettings]);

	// Set dead player data
	useEffect(() => {
		if (gameState.gameState === GameState.LOBBY) {
			setOtherDead({});
		} else if (gameState.gameState !== GameState.TASKS) {
			if (!gameState.players) return;
			setOtherDead((old) => {
				for (const player of gameState.players) {
					old[player.clientId] = player.isDead || player.disconnected;
				}
				return { ...old };
			});
		}
	}, [gameState.gameState]);

	// const [audioContext] = useState<AudioContext>(() => new AudioContext());
	const connectionStuff = useRef<ConnectionStuff>({
		pushToTalk: settings.pushToTalk,
		deafened: false,
		muted: false,
	});

	useEffect(() => {
		(async () => {
			const context = new AudioContext();
			convolverBuffer.current = await context.decodeAudioData(reverbOgx);
			await context.close();
		})();
	}, []);

	useEffect(() => {
		// (async function anyNameFunction() {
		let currentLobby = '';
		// Connect to voice relay server
		connectionStuff.current.socket = io(settings.serverURL, {
			transports: ['websocket'],
		});

		const { socket } = connectionStuff.current;

		socket.on('error', (error: SocketError) => {
			if (error.message) {
				setError(error.message);
			}
		});
		socket.on('connect', () => {
			setConnected(true);
		});
		socket.on('disconnect', () => {
			setConnected(false);
		});
		notifyMobilePlayers();

		let iceConfig: RTCConfiguration = DEFAULT_ICE_CONFIG;
		socket.on('clientPeerConfig', (clientPeerConfig: ClientPeerConfig) => {
			if (!validateClientPeerConfig(clientPeerConfig)) {
				let errorsFormatted = '';
				if (validateClientPeerConfig.errors) {
					errorsFormatted = validateClientPeerConfig.errors
						.map((error) => error.dataPath + ' ' + error.message)
						.join('\n');
				}
				alert(
					`Server sent a malformed peer config. Default config will be used. See errors below:\n${errorsFormatted}`
				);
				return;
			}

			if (
				clientPeerConfig.forceRelayOnly &&
				!clientPeerConfig.iceServers.some((server) => server.urls.toString().includes('turn:'))
			) {
				alert('Server has forced relay mode enabled but provides no relay servers. Default config will be used.');
				return;
			}

			iceConfig = {
				iceTransportPolicy: clientPeerConfig.forceRelayOnly ? 'relay' : 'all',
				iceServers: clientPeerConfig.iceServers,
			};
		});

		// Initialize variables
		let audioListener: {
			connect: () => void;
			destroy: () => void;
		};
		const audio: MediaTrackConstraintSet = {
			deviceId: (undefined as unknown) as string,
			autoGainControl: false,
			channelCount: 2,
			echoCancellation: settings.echoCancellation,
			latency: 0,
			noiseSuppression: settings.noiseSuppression,
			sampleRate: 48000,
			sampleSize: 16,
		};

		// Get microphone settings
		if (settingsRef.current.microphone.toLowerCase() !== 'default') audio.deviceId = settingsRef.current.microphone;
		navigator.getUserMedia(
			{ video: false, audio },
			async (stream) => {
				console.log('getuserMediacall');
				connectionStuff.current.stream = stream;

				stream.getAudioTracks()[0].enabled = !settings.pushToTalk;

				ipcRenderer.on(IpcRendererMessages.TOGGLE_DEAFEN, () => {
					connectionStuff.current.deafened = !connectionStuff.current.deafened;
					stream.getAudioTracks()[0].enabled = !connectionStuff.current.deafened && !connectionStuff.current.muted;
					setDeafened(connectionStuff.current.deafened);
				});
				ipcRenderer.on(IpcRendererMessages.TOGGLE_MUTE, () => {
					connectionStuff.current.muted = !connectionStuff.current.muted;
					if (connectionStuff.current.deafened) {
						connectionStuff.current.deafened = false;
						connectionStuff.current.muted = false;
					}
					stream.getAudioTracks()[0].enabled = !connectionStuff.current.muted && !connectionStuff.current.deafened;
					setMuted(connectionStuff.current.muted);
					setDeafened(connectionStuff.current.deafened);
				});
				ipcRenderer.on(IpcRendererMessages.PUSH_TO_TALK, (_: unknown, pressing: boolean) => {
					if (!connectionStuff.current.pushToTalk) return;
					if (!connectionStuff.current.deafened) {
						stream.getAudioTracks()[0].enabled = pressing;
					}
				});

				const ac = new AudioContext();
				ac.createMediaStreamSource(stream);
				if (settingsRef.current.vadEnabled) {
					audioListener = VAD(ac, ac.createMediaStreamSource(stream), undefined, {
						onVoiceStart: () => {
							setTalking(true);
						},
						onVoiceStop: () => {
							setTalking(false);
						},
						noiseCaptureDuration: 300,
						stereo: false,
					});
				}

				audioElements.current = {};

				const connect = (lobbyCode: string, playerId: number, clientId: number, isHost: boolean) => {
					console.log('connect called..', lobbyCode);
					if (lobbyCode === 'MENU') {
						Object.keys(peerConnections).forEach((k) => {
							disconnectPeer(k);
						});
						setSocketClients({});
						currentLobby = lobbyCode;
					} else if (currentLobby !== lobbyCode) {
						socket.emit('join', lobbyCode, playerId, clientId);
						currentLobby = lobbyCode;
						if (!isHost) {
							// fix for buggy cross compatibility with offical crewlink (they aren't sending the host settings 9/10 times.)
							Object.keys(lobbySettings).forEach((field: string) => {
								const officalCrewlinkSettings = ['maxDistance', 'haunting', 'hearImpostorsInVents', 'commsSabotage'];
								if (officalCrewlinkSettings.indexOf(field) === -1) {
									setLobbySettings({
										type: 'setOne',
										action: [field, defaultlocalLobbySettings[field as keyof ILobbySettings]],
									});
								}
							});
						}
					}
				};
				setConnect({ connect });
				function createPeerConnection(peer: string, initiator: boolean) {
					const connection = new Peer({
						stream,
						initiator, // @ts-ignore-line
						iceRestartEnabled: true,
						config: settingsRef.current.natFix ? DEFAULT_ICE_CONFIG_TURN : iceConfig,
					});

					setPeerConnections((connections) => {
						connections[peer] = connection;
						return connections;
					});

					connection.on('connect', () => {
						setTimeout(() => {
							if (hostRef.current.isHost) {
								try {
									console.log('sending settings..');
									connection.send(JSON.stringify(lobbySettingsRef.current));
								} catch (e) {
									console.warn('failed to update lobby settings: ', e);
								}
							}
						}, 1000);
					});
					connection.on('stream', async (stream: MediaStream) => {
						console.log('ONSTREAM');

						setAudioConnected((old) => ({ ...old, [peer]: true }));
						const dummyAudio = new Audio();
						dummyAudio.srcObject = stream;
						const context = new AudioContext();
						const source = context.createMediaStreamSource(stream);
						const dest = context.createMediaStreamDestination();

						const gain = context.createGain();
						const pan = context.createPanner();
						gain.gain.value = 0;
						pan.refDistance = 0.1;
						pan.panningModel = 'equalpower';
						pan.distanceModel = 'linear';
						pan.maxDistance = maxDistanceRef.current;
						pan.rolloffFactor = 1;

						const muffle = context.createBiquadFilter();
						muffle.type = 'lowpass';

						source.connect(pan);
						pan.connect(gain);

						const reverb = context.createConvolver();
						reverb.buffer = convolverBuffer.current;
						const destination: AudioNode = dest;
						if (settingsRef.current.vadEnabled) {
							VAD(context, gain, undefined, {
								onVoiceStart: () => setTalking(true),
								onVoiceStop: () => setTalking(false),
								stereo: false,
							});
						}
						gain.connect(destination);
						const audio = document.createElement('audio') as ExtendedAudioElement;
						document.body.appendChild(audio);
						audio.setAttribute('autoplay', '');
						audio.srcObject = dest.stream;
						if (settingsRef.current.speaker.toLowerCase() !== 'default') {
							audio.setSinkId(settingsRef.current.speaker);
						}

						const setTalking = (talking: boolean) => {
							if (!socketClientsRef.current[peer]) {
								console.log('error with settalking: ', talking);
								return;
							}

							const reallyTalking = talking && gain.gain.value > 0;
							setOtherTalking((old) => ({
								...old,
								[socketClientsRef.current[peer]?.clientId]: reallyTalking,
							}));
						};
						audioElements.current[peer] = {
							dummyAudioElement: dummyAudio,
							audioElement: audio,
							gain,
							pan,
							reverb,
							muffle,
							muffleConnected: false,
							reverbConnected: false,
							destination,
						};
					});
					connection.on('signal', (data) => {
						// console.log('signal', JSON.stringify(data));
						socket.emit('signal', {
							data,
							to: peer,
						});
					});

					connection.on('data', (data) => {
						if (!hostRef.current || hostRef.current.hostId !== socketClientsRef.current[peer]?.clientId) return;
						const settings = JSON.parse(data);
						Object.keys(lobbySettings).forEach((field: string) => {
							if (field in settings) {
								setLobbySettings({
									type: 'setOne',
									action: [field, settings[field]],
								});
							} else {
								if (field in defaultlocalLobbySettings) {
									setLobbySettings({
										type: 'setOne',
										action: [field, defaultlocalLobbySettings[field as keyof ILobbySettings]],
									});
								}
							}
						});
					});
					connection.on('close', () => {
						console.log('Disconnected from', peer, 'Initiator:', initiator);
						disconnectPeer(peer);
					});
					connection.on('error', () => {
						console.log('ONERROR');
						/*empty*/
					});
					return connection;
				}
				socket.on('join', async (peer: string, client: Client) => {
					createPeerConnection(peer, true);
					setSocketClients((old) => ({ ...old, [peer]: client }));
				});

				socket.on('signal', ({ data, from }: { data: Peer.SignalData; from: string }) => {
					//console.log('onsignal', JSON.stringify(data));

					console.log('recieved signal: ', JSON.stringify(data));
					if (data.hasOwnProperty('mobilePlayerInfo')) {
						console.log('Got mobile player info: ', data);
						hostRef.current.mobileRunning = true;
						console.log("setting mobileRunning to true..");
						return;
					}

					let connection: Peer.Instance;
					if (peerConnections[from]) {
						connection = peerConnections[from];
					} else {
						connection = createPeerConnection(from, false);
					}
					connection.signal(data);
				});
				socket.on('setClient', (socketId: string, client: Client) => {
					setSocketClients((old) => ({ ...old, [socketId]: client }));
				});
				socket.on('setClients', (clients: SocketClientMap) => {
					setSocketClients(clients);
				});
			},
			(error) => {
				console.error(error);
				setError("Couldn't connect to your microphone:\n" + error);
				// ipcRenderer.send(IpcMessages.SHOW_ERROR_DIALOG, {
				// 	title: 'Error',
				// 	content: 'Couldn\'t connect to your microphone:\n' + error
				// });
			}
		);

		return () => {
			hostRef.current.mobileRunning = false; 
			socket.emit('leave');
			Object.keys(peerConnections).forEach((k) => {
				disconnectPeer(k);
			});
			connectionStuff.current.socket?.close();

			audioListener?.destroy();
		};
		// })();
	}, []);

	const myPlayer = useMemo(() => {
		if (!gameState || !gameState.players) {
			return undefined;
		} else {
			return gameState.players.find((p) => p.isLocal);
		}
	}, [gameState.players]);

	const otherPlayers = useMemo(() => {
		let otherPlayers: Player[];
		if (!gameState || !gameState.players || gameState.lobbyCode === 'MENU' || !myPlayer) return [];
		else otherPlayers = gameState.players.filter((p) => !p.isLocal);

		console.log(otherPlayers.filter(o => o.isImpostor).map(o =>  ({name: o.name, imposter: o.isImpostor}) ))
		maxDistanceRef.current = lobbySettings.visionHearing
			? myPlayer.isImpostor
				? lobbySettings.maxDistance
				: gameState.lightRadius + 0.5
			: lobbySettings.maxDistance;
		if (maxDistanceRef.current <= 0.6) {
			maxDistanceRef.current = 1;
		}
		hostRef.current = {
			mobileRunning: hostRef.current.mobileRunning,
			gamestate: gameState.gameState,
			code: gameState.lobbyCode,
			hostId: gameState.hostId,
			isHost: gameState.isHost,
		};
		const playerSocketIds: {
			[index: number]: string;
		} = {};
		for (const k of Object.keys(socketClients)) {
			playerSocketIds[socketClients[k].clientId] = k;
		}

		for (const player of otherPlayers) {
			const audio =
				player.clientId === myPlayer.clientId ? undefined : audioElements.current[playerSocketIds[player.clientId]];
			if (audio) {
				let gain = calculateVoiceAudio(gameState, settingsRef.current, myPlayer, player, audio);

				if (connectionStuff.current.deafened) {
					gain = 0;
				}

				if (gain > 0) {
					const playerVolume = playerConfigs[player.nameHash]?.volume;

					gain = playerVolume === undefined ? gain : gain * playerVolume;

					if (myPlayer.isDead && !player.isDead) {
						gain = gain * (settings.ghostVolume / 100);
					}
					gain = gain * (settings.masterVolume / 100);
				}
				audio.gain.gain.value = gain;
			}
		}

		return otherPlayers;
	}, [gameState]);

	useEffect(() => {
		if (!gameState.players) return;
		for (const player of gameState.players) {
			if (playerConfigs[player.nameHash] === undefined) {
				playerConfigs[player.nameHash] = { volume: 1 };
			}
		}
	}, [gameState?.players?.length]); /* move the the other gamestate hooks */

	// Connect to P2P negotiator, when lobby and connect code change
	useEffect(() => {
		if (connect?.connect) {
			connect.connect(gameState?.lobbyCode ?? 'MENU', myPlayer?.id ?? 0, gameState.clientId, gameState.isHost);
		}
	}, [connect?.connect, gameState?.lobbyCode]);

	// Connect to P2P negotiator, when game mode change
	useEffect(() => {
		if (
			connect?.connect &&
			gameState.lobbyCode &&
			myPlayer?.clientId !== undefined &&
			gameState.gameState === GameState.LOBBY &&
			(gameState.oldGameState === GameState.DISCUSSION || gameState.oldGameState === GameState.TASKS)
		) {
			connect.connect(gameState.lobbyCode, myPlayer.clientId, gameState.clientId, gameState.isHost);
		} else if (
			gameState.oldGameState !== GameState.UNKNOWN &&
			gameState.oldGameState !== GameState.MENU &&
			gameState.gameState === GameState.MENU
		) {
			// On change from a game to menu, exit from the current game properly
			hostRef.current.mobileRunning = false; // On change from a game to menu, exit from the current game properly
			connectionStuff.current.socket?.emit('leave');
			Object.keys(peerConnections).forEach((k) => {
				disconnectPeer(k);
			});
			setOtherDead({});
		}
	}, [gameState.gameState]);

	useEffect(() => {
		if (gameState.isHost) {
			setSettings({
				type: 'setOne',
				action: ['localLobbySettings', lobbySettings],
			});
		}
	}, [gameState.isHost]);

	// Emit player id to socket
	useEffect(() => {
		if (connectionStuff.current.socket && myPlayer && myPlayer.clientId !== undefined) {
			connectionStuff.current.socket.emit('id', myPlayer.id, gameState.clientId);
		}
	}, [myPlayer?.id]);

	const playerSocketIds: {
		[index: number]: string;
	} = {};

	for (const k of Object.keys(socketClients)) {
		if (socketClients[k].clientId !== undefined) playerSocketIds[socketClients[k].clientId] = k;
	}

	// Pass voice state to overlay
	useEffect(() => {
		if (!settings.enableOverlay) {
			return;
		}
		ipcRenderer.send(IpcMessages.SEND_TO_OVERLAY, IpcOverlayMessages.NOTIFY_VOICE_STATE_CHANGED, {
			otherTalking,
			playerSocketIds,
			otherDead,
			socketClients,
			audioConnected,
			localTalking: talking,
			localIsAlive: !myPlayer?.isDead,
			muted: mutedState,
			deafened: deafenedState,
		} as VoiceState);
	}, [otherTalking, otherDead, socketClients, audioConnected, talking, mutedState, deafenedState]);

	return (
		<div className={classes.root}>
			{error && (
				<div className={classes.error}>
					<Typography align="center" variant="h6" color="error">
						ERROR
					</Typography>
					<Typography align="center" style={{ whiteSpace: 'pre-wrap' }}>
						{error}
					</Typography>
					<SupportLink />
				</div>
			)}
			<div className={classes.top}>
				{myPlayer && (
					<div className={classes.avatarWrapper}>
						<Avatar
							deafened={deafenedState}
							muted={mutedState}
							player={myPlayer}
							borderColor="#2ecc71"
							connectionState={connected ? 'connected' : 'disconnected'}
							talking={talking}
							isAlive={!myPlayer.isDead}
							size={100}
						/>
					</div>
				)}
				<div className={classes.right}>
					{myPlayer && gameState?.gameState !== GameState.MENU && (
						<span className={classes.username}>{myPlayer.name}</span>
					)}
					{gameState.lobbyCode && (
						<span
							className={classes.code}
							style={{
								background: gameState.lobbyCode === 'MENU' ? 'transparent' : '#3e4346',
							}}
						>
							{displayedLobbyCode}
						</span>
					)}
				</div>
			</div>
			{lobbySettings.deadOnly && (
				<div className={classes.top}>
					<small style={{ padding: 0 }}>Ghost can talk only enabled.</small>
				</div>
			)}
			{lobbySettings.meetingGhostOnly && (
				<div className={classes.top}>
					<small style={{ padding: 0 }}>Talking in meetings only enabled.</small>
				</div>
			)}
			{gameState.lobbyCode && <Divider />}
			<Grid
				container
				spacing={1}
				className={classes.otherplayers}
				alignItems="flex-start"
				alignContent="flex-start"
				justify="flex-start"
			>
				{otherPlayers.map((player) => {
					const peer = playerSocketIds[player.clientId];
					const connected = socketClients[peer]?.clientId === player.clientId || false;
					const audio = audioConnected[peer];
					const socketConfig = playerConfigs[player.nameHash];

					return (
						<Grid item key={player.id} xs={getPlayersPerRow(otherPlayers.length)}>
							<Avatar
								connectionState={!connected ? 'disconnected' : audio ? 'connected' : 'novoice'}
								player={player}
								talking={!player.inVent && otherTalking[player.clientId]}
								borderColor="#2ecc71"
								isAlive={!otherDead[player.clientId]}
								size={50}
								socketConfig={socketConfig}
								onConfigChange={() => store.set(`playerConfigMap.${player.nameHash}`, playerConfigs[player.nameHash])}
							/>
						</Grid>
					);
				})}
			</Grid>
		</div>
	);
};

type ValidPlayersPerRow = 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
function getPlayersPerRow(playerCount: number): ValidPlayersPerRow {
	if (playerCount <= 9) return (12 / 3) as ValidPlayersPerRow;
	else return Math.min(12, Math.floor(12 / Math.ceil(Math.sqrt(playerCount)))) as ValidPlayersPerRow;
}

export default Voice;
