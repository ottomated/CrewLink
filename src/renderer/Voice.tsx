import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import io, { Socket } from 'socket.io-client';
import Avatar from './Avatar';
import { GameStateContext, SettingsContext } from './contexts';
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

type PeerErrorCode = 'ERR_WEBRTC_SUPPORT' | 'ERR_CREATE_OFFER' | 'ERR_CREATE_ANSWER' | 'ERR_SET_LOCAL_DESCRIPTION' | 'ERR_SET_REMOTE_DESCRIPTION' | 'ERR_ADD_ICE_CANDIDATE' | 'ERR_ICE_CONNECTION_FAILURE' | 'ERR_SIGNALING' | 'ERR_DATA_CHANNEL' | 'ERR_CONNECTION_FAILURE';

interface PeerError extends Error {
	code: PeerErrorCode;
}

interface AudioElements {
	[peer: string]: {
		element: HTMLAudioElement;
		gain: GainNode;
		pan: PannerNode;
	};
}

interface SocketIdMap {
	[socketId: string]: number;
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

interface AudioConnected {
	[peer: string]: boolean; // isConnected
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
	const [settings] = useContext(SettingsContext);
	const settingsRef = useRef<ISettings>(settings);
	const gameState = useContext(GameStateContext);
	let { lobbyCode: displayedLobbyCode } = gameState;
	if (displayedLobbyCode !== 'MENU' && settings.hideCode) displayedLobbyCode = 'LOBBY';
	const [talking, setTalking] = useState(false);
	const [socketPlayerIds, setSocketPlayerIds] = useState<SocketIdMap>({});
	const [connect, setConnect] = useState<({ connect: (lobbyCode: string, playerId: number) => void }) | null>(null);
	const [otherTalking, setOtherTalking] = useState<OtherTalking>({});
	const [otherDead, setOtherDead] = useState<OtherDead>({});
	const audioElements = useRef<AudioElements>({});
	const peerConnections = useRef<PeerConnections>({});
	const [audioConnected, setAudioConnected] = useState<AudioConnected>({});

	const [deafenedState, setDeafened] = useState(false);
	const [connected, setConnected] = useState(false);

	let joinedLobby = '';

	// Handle pushToTalk, if set
	useEffect(() => {
		if (!connectionStuff.current.stream) return;
		connectionStuff.current.stream.getAudioTracks()[0].enabled = !settings.pushToTalk;
		connectionStuff.current.pushToTalk = settings.pushToTalk;
	}, [settings.pushToTalk]);

	// Add settings to settingsRef
	useEffect(() => {
		settingsRef.current = settings;
	}, [settings]);

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

	function disconnectPeers() {
		Object.keys(peerConnections.current).forEach(k => {
			disconnectPeer(k);
		});
	}

	function disconnectPeer(peer: string) {
		const connection = peerConnections.current[peer];
		if (!connection) {
			return;
		}
		connection.destroy();
		delete peerConnections.current[peer];
		if (audioElements.current[peer]) {
			document.body.removeChild(audioElements.current[peer].element);
			audioElements.current[peer].pan.disconnect();
			audioElements.current[peer].gain.disconnect();
			delete audioElements.current[peer];
		}

		setAudioConnected(old => ({ ...old, [peer]: false }));
	}

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

			const connect = (lobbyCode: string, playerId: number) => {
				console.log('Connect called', lobbyCode, playerId);
				if (lobbyCode === 'MENU') {
					disconnectPeers();
					setSocketPlayerIds({});
					joinedLobby = lobbyCode;
					return;
				}

				// Only emit join on lobby change, this will keep the current connections alive at the end of the current game
				if (joinedLobby != lobbyCode) {
					socket.emit('join', lobbyCode, playerId);
					joinedLobby = lobbyCode;
				}
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

				let retries = 0;
				let errCode: PeerErrorCode;

				peerConnections.current[peer] = connection;

				connection.on('stream', (stream: MediaStream) => {
					setAudioConnected(old => ({ ...old, [peer]: true }));

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
					pan.maxDistance = 2.66 * 2;
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
						setSocketPlayerIds(socketPlayerIds => {
							setOtherTalking(old => ({
								...old,
								[socketPlayerIds[peer]]: talking && gain.gain.value > 0
							}));
							return socketPlayerIds;
						});
					};
					audioElements.current[peer] = { element: audio, gain, pan };
				});
				connection.on('signal', (data) => {
					socket.emit('signal', {
						data,
						to: peer
					});
				});

				connection.on('close', () => {
					console.log('Disconnected from', peer, 'Initiator:', initiator);
					disconnectPeer(peer);

					// Auto reconnect on connection error
					if (initiator && errCode && retries < 10 && (errCode == 'ERR_CONNECTION_FAILURE' || errCode == 'ERR_DATA_CHANNEL')) {
						createPeerConnection(peer, initiator);
						retries++;
					}
				});

				connection.on('error', (err: PeerError) => {
					errCode = err.code;
				});

				return connection;
			}
			socket.on('join', async (peer: string, playerId: number) => {
				createPeerConnection(peer, true);
				setSocketPlayerIds(old => ({ ...old, [peer]: playerId }));
			});
			socket.on('signal', ({ data, from }: { data: Peer.SignalData, from: string }) => {
				let connection: Peer.Instance;
				if (peerConnections.current[from]) {
					connection = peerConnections.current[from];
				} else {
					connection = createPeerConnection(from, false);
				}
				connection.signal(data);
			});
			socket.on('setId', (socketId: string, id: number) => {
				setSocketPlayerIds(old => ({ ...old, [socketId]: id }));
			});
			socket.on('setIds', (ids: SocketIdMap) => {
				setSocketPlayerIds(ids);
			});

		}, (error) => {
			console.error(error);
			remote.dialog.showErrorBox('Error', 'Couldn\'t connect to your microphone:\n' + error);
		});

		return () => {
			socket.emit('leave');
			disconnectPeers();
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
		for (const k of Object.keys(socketPlayerIds)) {
			playerSocketIds[socketPlayerIds[k]] = k;
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
			connect.connect(gameState.lobbyCode, myPlayer.id);
		}
	}, [connect?.connect, gameState?.lobbyCode]);

	// Connect to P2P negotiator, when game mode change
	useEffect(() => {
		if (connect?.connect && gameState.lobbyCode && myPlayer?.id !== undefined && gameState.gameState === GameState.LOBBY && (gameState.oldGameState === GameState.DISCUSSION || gameState.oldGameState === GameState.TASKS)) {
			connect.connect(gameState.lobbyCode, myPlayer.id);
		}
		else if (gameState.oldGameState != GameState.UNKNOWN && gameState.gameState == GameState.MENU) {
			// On change from a game to menu (e.g.: disconnected by the game) exit from the current game properly
			const { socket } = connectionStuff.current;
			socket?.emit('leave');
			disconnectPeers();
			setOtherDead({});
		}

	}, [gameState.gameState]);

	// Emit player id to socket
	useEffect(() => {
		if (connectionStuff.current.socket && myPlayer && myPlayer.id !== undefined) {
			connectionStuff.current.socket.emit('id', myPlayer.id);
		}
	}, [myPlayer?.id]);

	const playerSocketIds: {
		[index: number]: string
	} = {};
	for (const k of Object.keys(socketPlayerIds)) {
		playerSocketIds[socketPlayerIds[k]] = k;
	}

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
						const peer = playerSocketIds[player.id];
						const connected = Object.values(socketPlayerIds).includes(player.id);
						const audio = audioConnected[peer];
						return (
							<Avatar key={player.id} player={player}
								talking={!connected || !audio || otherTalking[player.id]}
								borderColor={connected ? (audio ? '#2ECC71' : '#4fd9e0') : '#C0392B'}
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
