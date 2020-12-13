import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import io, { Socket } from 'socket.io-client';
import Avatar from './Avatar';
import { GameStateContext, LobbySettingsContext, SettingsContext } from './contexts';
import { AmongUsState, GameState, Player } from '../common/AmongUsState';
import Peer from 'simple-peer';
import { ipcRenderer, remote } from 'electron';
import VAD from './vad';
import { ISettings } from '../common/ISettings';

export interface ExtendedAudioElement extends HTMLAudioElement {
	setSinkId: (sinkId: string) => Promise<void>;
}

interface PeerConnections {
	[peer: string]: Peer.Instance;
}

interface AudioElements {
	[peer: string]: {
		element: HTMLAudioElement;
		gain: GainNode;
		pan: PannerNode;
	};
}

interface SocketClientMap {
	[socketId: string]: Client;
}

interface ConnectionStuff {
	socket: typeof Socket;
	stream?: MediaStream;
	pushToTalk: boolean;
	deafened: boolean;
}

interface OtherTalking {
	[playerId: number]: boolean; // isTalking
}

interface OtherDead {
	[playerId: number]: boolean; // isTalking
}

interface Client {
	playerId: number;
	clientId: number;
}

function calculateVoiceAudio(state: AmongUsState, settings: ISettings, me: Player, other: Player, gain: GainNode, pan: PannerNode): void {
	const audioContext = pan.context;
	pan.positionZ.setValueAtTime(-0.5, audioContext.currentTime);
	let panPos = [
		(other.x - me.x),
		(other.y - me.y)
	];
	if (state.gameState === GameState.DISCUSSION || (state.gameState === GameState.LOBBY && !settings.enableSpatialAudio)) {
		panPos = [0, 0];
	}
	if (isNaN(panPos[0])) panPos[0] = 999;
	if (isNaN(panPos[1])) panPos[1] = 999;
	panPos[0] = Math.min(999, Math.max(-999, panPos[0]));
	panPos[1] = Math.min(999, Math.max(-999, panPos[1]));
	if (other.inVent) {
		gain.gain.value = 0;
		return;
	}
	if (me.isDead && other.isDead) {
		gain.gain.value = 1;
		pan.positionX.setValueAtTime(panPos[0], audioContext.currentTime);
		pan.positionY.setValueAtTime(panPos[1], audioContext.currentTime);
		return;
	}
	if (!me.isDead && other.isDead) {
		gain.gain.value = 0;
		return;
	}
	if (state.gameState === GameState.LOBBY || state.gameState === GameState.DISCUSSION) {
		gain.gain.value = 1;
		pan.positionX.setValueAtTime(panPos[0], audioContext.currentTime);
		pan.positionY.setValueAtTime(panPos[1], audioContext.currentTime);
	} else if (state.gameState === GameState.TASKS) {
		gain.gain.value = 1;
		pan.positionX.setValueAtTime(panPos[0], audioContext.currentTime);
		pan.positionY.setValueAtTime(panPos[1], audioContext.currentTime);
	} else {
		gain.gain.value = 0;
	}
	if (gain.gain.value === 1 && Math.sqrt(Math.pow(panPos[0], 2) + Math.pow(panPos[1], 2)) > 7) {
		gain.gain.value = 0;
	}
}


const Voice: React.FC = function () {
	const [settings, setSettings] = useContext(SettingsContext);
	const settingsRef = useRef<ISettings>(settings);
	const [lobbySettings, setLobbySettings] = useContext(LobbySettingsContext);
	const gameState = useContext(GameStateContext);
	let { lobbyCode: displayedLobbyCode } = gameState;
	if (displayedLobbyCode !== 'MENU' && settings.hideCode) displayedLobbyCode = 'LOBBY';
	const [talking, setTalking] = useState(false);
	const [socketClients, setSocketClients] = useState<SocketClientMap>({});
	const socketClientsRef = useRef(socketClients);
	const [peerConnections, setPeerConnections] = useState<PeerConnections>({});
	const [connect, setConnect] = useState<({ connect: (lobbyCode: string, playerId: number, clientId: number) => void }) | null>(null);
	const [otherTalking, setOtherTalking] = useState<OtherTalking>({});
	const [otherDead, setOtherDead] = useState<OtherDead>({});
	const audioElements = useRef<AudioElements>({});

	const [deafenedState, setDeafened] = useState(false);
	const [connected, setConnected] = useState(false);

	// Handle pushToTalk, if set
	useEffect(() => {
		if (!connectionStuff.current.stream) return;
		connectionStuff.current.stream.getAudioTracks()[0].enabled = !settings.pushToTalk;
		connectionStuff.current.pushToTalk = settings.pushToTalk;
	}, [settings.pushToTalk]);

	// Emit lobby settings to connected peers
	useEffect(() => {
		if (gameState.isHost !== true) return;
		Object.values(peerConnections).forEach(peer => peer.send(JSON.stringify(settings.localLobbySettings)));
	}, [settings.localLobbySettings]);

	useEffect(() => {
		for (let peer in audioElements.current) {
			audioElements.current[peer].pan.maxDistance = lobbySettings.maxDistance;
		}
	}, [lobbySettings.maxDistance]);

	// Add settings to settingsRef
	useEffect(() => {
		settingsRef.current = settings;
	}, [settings]);

	// Add socketClients to socketClientsRef
	useEffect(() => {
		socketClientsRef.current = socketClients;
	}, [socketClients]);

	// Set dead player data
	useEffect(() => {
		if (gameState.gameState === GameState.LOBBY) {
			setOtherDead({});
		} else if (gameState.gameState !== GameState.TASKS) {
			if (!gameState.players) return;
			setOtherDead(old => {
				for (const player of gameState.players) {
					old[player.id] = player.isDead || player.disconnected;
				}
				return { ...old };
			});
		}
	}, [gameState.gameState]);

	const connectionStuff = useRef<Partial<ConnectionStuff>>({
		pushToTalk: settings.pushToTalk,
		deafened: false,
	});

	// BIG ASS BLOB - Handle audio
	useEffect(() => {
		// Connect to voice relay server
		connectionStuff.current.socket = io(settings.serverURL, { transports: ['websocket'] });
		const { socket } = connectionStuff.current;

		socket.on('connect', () => {
			setConnected(true);
		});
		socket.on('disconnect', () => {
			setConnected(false);
		});

		// Initialize variables
		let audioListener: {
			connect: () => void;
			destroy: () => void;
		};
		const audio = {
			deviceId: undefined as unknown as string,
			autoGainControl: false,
			channelCount: 2,
			echoCancellation: false,
			latency: 0,
			noiseSuppression: false,
			sampleRate: 48000,
			sampleSize: 16,
			googEchoCancellation: false,
			googAutoGainControl: false,
			googAutoGainControl2: false,
			googNoiseSuppression: false,
			googHighpassFilter: false,
			googTypingNoiseDetection: false
		};

		// Get microphone settings
		if (settings.microphone.toLowerCase() !== 'default')
			audio.deviceId = settings.microphone;

		navigator.getUserMedia({ video: false, audio }, async (stream) => {
			connectionStuff.current.stream = stream;

			stream.getAudioTracks()[0].enabled = !settings.pushToTalk;

			ipcRenderer.on('toggleDeafen', () => {
				connectionStuff.current.deafened = !connectionStuff.current.deafened;
				stream.getAudioTracks()[0].enabled = !connectionStuff.current.deafened;
				setDeafened(connectionStuff.current.deafened);
			});
			ipcRenderer.on('pushToTalk', (_: unknown, pressing: boolean) => {
				if (!connectionStuff.current.pushToTalk) return;
				if (!connectionStuff.current.deafened) {
					stream.getAudioTracks()[0].enabled = pressing;
				}
			});

			const ac = new AudioContext();
			ac.createMediaStreamSource(stream);
			audioListener = VAD(ac, ac.createMediaStreamSource(stream), undefined, {
				onVoiceStart: () => setTalking(true),
				onVoiceStop: () => setTalking(false),
				noiseCaptureDuration: 1,
				stereo: false
			});

			audioElements.current = {};

			const connect = (lobbyCode: string, playerId: number, clientId: number) => {
				console.log("Connect called", lobbyCode, playerId, clientId);
				socket.emit('leave');
				Object.keys(peerConnections).forEach(k => {
					disconnectPeer(k);
				});
				setSocketClients({});

				if (lobbyCode === 'MENU') return;

				function disconnectPeer(peer: string) {
					const connection = peerConnections[peer];
					if (!connection) {
						return;
					}
					connection.destroy();
					setPeerConnections(connections => {
						delete connections[peer];
						return connections;
					});
					if (audioElements.current[peer]) {
						document.body.removeChild(audioElements.current[peer].element);
						audioElements.current[peer].pan.disconnect();
						audioElements.current[peer].gain.disconnect();
						delete audioElements.current[peer];
					}
				}

				socket.emit('join', lobbyCode, playerId, clientId);
			};
			setConnect({ connect });
			function createPeerConnection(peer: string, initiator: boolean) {
				const connection = new Peer({
					stream, initiator, config: {
						iceServers: [
							{
								'urls': 'stun:stun.l.google.com:19302'
							}
						]
					}
				});
				setPeerConnections(connections => {
					connections[peer] = connection;
					return connections;
				});

				connection.on('stream', (stream: MediaStream) => {
					const audio = document.createElement('audio') as ExtendedAudioElement;
					document.body.appendChild(audio);
					audio.srcObject = stream;
					if (settings.speaker.toLowerCase() !== 'default')
						audio.setSinkId(settings.speaker);

					const context = new AudioContext();
					const source = context.createMediaStreamSource(stream);
					const gain = context.createGain();
					const pan = context.createPanner();
					pan.refDistance = 0.1;
					pan.panningModel = 'equalpower';
					pan.distanceModel = 'linear';
					pan.maxDistance = lobbySettings.maxDistance;
					pan.rolloffFactor = 1;

					source.connect(pan);
					pan.connect(gain);
					// Source -> pan -> gain -> VAD -> destination
					VAD(context, gain, context.destination, {
						onVoiceStart: () => setTalking(true),
						onVoiceStop: () => setTalking(false),
						stereo: settingsRef.current.enableSpatialAudio
					});

					const setTalking = (talking: boolean) => {
						setOtherTalking(old => ({
							...old,
							[socketClientsRef.current[peer].playerId]: talking && gain.gain.value > 0
						}));
					};
					audioElements.current[peer] = { element: audio, gain, pan };
				});
				connection.on('signal', (data) => {
					socket.emit('signal', {
						data,
						to: peer
					});
				});
				connection.on('data', data => {
					if (gameState.hostId !== socketClientsRef.current[peer].clientId) return;
					const settings = JSON.parse(data);
					Object.keys(lobbySettings).forEach((field: string) => {
						if (field in settings) {
							setLobbySettings({
								type: 'setOne',
								action: [field, settings[field]]
							});
						}
					});
				});
				return connection;
			}
			socket.on('join', async (peer: string, client: Client) => {
				createPeerConnection(peer, true);
				setSocketClients(old => ({ ...old, [peer]: client }));
			});
			socket.on('signal', ({ data, from }: { data: Peer.SignalData, from: string }) => {
				let connection: Peer.Instance;
				if (peerConnections[from]) {
					connection = peerConnections[from];
				} else {
					connection = createPeerConnection(from, false);
				}
				connection.signal(data);
			});
			socket.on('setClient', (socketId: string, client: Client) => {
				setSocketClients(old => ({ ...old, [socketId]: client }));
			})
			socket.on('setClients', (clients: SocketClientMap) => {
				setSocketClients(clients);
			});

		}, (error) => {
			console.error(error);
			remote.dialog.showErrorBox('Error', 'Couldn\'t connect to your microphone:\n' + error);
		});

		return () => {
			connectionStuff.current.socket?.close();
			audioListener.destroy();
		};
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
		else otherPlayers = gameState.players.filter(p => !p.isLocal);

		const playerSocketIds: {
			[index: number]: string
		} = {};
		for (const k of Object.keys(socketClients)) {
			playerSocketIds[socketClients[k].playerId] = k;
		}
		for (const player of otherPlayers) {
			const audio = audioElements.current[playerSocketIds[player.id]];
			if (audio) {
				calculateVoiceAudio(gameState, settingsRef.current, myPlayer, player, audio.gain, audio.pan);
				if (connectionStuff.current.deafened) {
					audio.gain.gain.value = 0;
				}
			}
		}

		return otherPlayers;
	}, [gameState]);

	// Connect to P2P negotiator, when lobby and connect code change
	useEffect(() => {
		if (connect?.connect && gameState.lobbyCode && myPlayer?.id !== undefined) {
			connect.connect(gameState.lobbyCode, myPlayer.id, gameState.clientId);
		}
	}, [connect?.connect, gameState?.lobbyCode]);

	// Connect to P2P negotiator, when game mode change
	useEffect(() => {
		if (connect?.connect && gameState.lobbyCode && myPlayer?.id !== undefined && gameState.gameState === GameState.LOBBY && (gameState.oldGameState === GameState.DISCUSSION || gameState.oldGameState === GameState.TASKS)) {
			connect.connect(gameState.lobbyCode, myPlayer.id, gameState.clientId);
		}
	}, [gameState.gameState]);

	useEffect(() => {
		if (gameState.isHost === true) {
			setSettings({
				type: 'setOne',
				action: ['localLobbySettings', lobbySettings]
			});
		}
	}, [gameState.isHost]);

	// Emit player id to socket
	useEffect(() => {
		if (connectionStuff.current.socket && myPlayer && myPlayer.id !== undefined) {
			connectionStuff.current.socket.emit('id', myPlayer.id, gameState.clientId);
		}
	}, [myPlayer?.id]);

	return (
		<div className="root">
			<div className="top">
				{myPlayer &&
					<Avatar deafened={deafenedState} player={myPlayer} borderColor={connected ? '#2ecc71' : '#c0392b'} talking={talking} isAlive={!myPlayer.isDead} size={100} />
					// <div className="avatar" style={{ borderColor: talking ? '#2ecc71' : 'transparent' }}>
					// 	<Canvas src={alive} color={playerColors[myPlayer.colorId][0]} shadow={playerColors[myPlayer.colorId][1]} />
					// </div>
				}
				<div className="right">
					{myPlayer && gameState?.gameState !== GameState.MENU &&
						<span className="username">
							{gameState.isHost === true &&
								<svg viewBox="0 0 48 36">
									<path fill="#fcdb03" d="M39.67,36H8.33a5,5,0,0,1-5-4.34L0,6.63a3,3,0,0,1,5-2.6l5.6,5.19A3,3,0,0,0,15,9l6.7-7.9a3,3,0,0,1,4.6,0L33,9a3,3,0,0,0,4.34.26L42.94,4a3,3,0,0,1,5,2.6l-3.33,25A5,5,0,0,1,39.67,36Z"/>
								</svg>
							}
							{myPlayer.name}
						</span>
					}
					{gameState.lobbyCode &&
						<span className="code" style={{ background: gameState.lobbyCode === 'MENU' ? 'transparent' : '#3e4346' }}>
							{displayedLobbyCode}
						</span>
					}
				</div>
			</div>
			<hr />
			<div className="otherplayers">
				{
					otherPlayers.map(player => {
						const connected = Object.values(socketClients).map(({playerId}) => playerId).includes(player.id);
						return (
							<Avatar key={player.id} player={player}
								talking={!connected || otherTalking[player.id]}
								borderColor={connected ? '#2ecc71' : '#c0392b'}
								isAlive={!otherDead[player.id]}
								size={50} />
						);
					})
				}
			</div>
		</div>
	);
};

export default Voice;
