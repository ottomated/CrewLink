import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import io, { Socket } from 'socket.io-client';
import Avatar from './Avatar';
import {
	GameStateContext,
	LobbySettingsContext,
	SettingsContext,
} from './contexts';
import {
	AmongUsState,
	AudioConnected,
	Client,
	GameState,
	OtherTalking,
	Player,
	SocketClientMap,
	VoiceState,
} from '../common/AmongUsState';
import Peer from 'simple-peer';
import { ipcRenderer } from 'electron';
import VAD from './vad';
import { ILobbySettings, ISettings } from '../common/ISettings';
import {
	IpcMessages,
	IpcOverlayMessages,
	IpcRendererMessages,
} from '../common/ipc-messages';
import Typography from '@material-ui/core/Typography';
import Grid from '@material-ui/core/Grid';
import makeStyles from '@material-ui/core/styles/makeStyles';
import SupportLink from './SupportLink';
import Divider from '@material-ui/core/Divider';
// @ts-ignore
import reverbOgx from 'arraybuffer-loader!../../static/reverb.ogx';

export interface ExtendedAudioElement extends HTMLAudioElement {
	setSinkId: (sinkId: string) => Promise<void>;
}

interface PeerConnections {
	[peer: string]: Peer.Instance;
}

type PeerErrorCode =
	| 'ERR_WEBRTC_SUPPORT'
	| 'ERR_CREATE_OFFER'
	| 'ERR_CREATE_ANSWER'
	| 'ERR_SET_LOCAL_DESCRIPTION'
	| 'ERR_SET_REMOTE_DESCRIPTION'
	| 'ERR_ADD_ICE_CANDIDATE'
	| 'ERR_ICE_CONNECTION_FAILURE'
	| 'ERR_SIGNALING'
	| 'ERR_DATA_CHANNEL'
	| 'ERR_CONNECTION_FAILURE';

interface AudioNodes {
	element: HTMLAudioElement;
	gain: GainNode;
	pan: PannerNode;
	reverbGain: GainNode;
	reverb: ConvolverNode;
	compressor: DynamicsCompressorNode;
	muffle: BiquadFilterNode;
}

interface AudioElements {
	[peer: string]: AudioNodes;
}

interface ConnectionStuff {
	socket?: typeof Socket;
	stream?: MediaStream;
	pushToTalk: boolean;
	deafened: boolean;
	muted: boolean;
}

interface SocketError {
	message?: string;
}

function calculateVoiceAudio(
	state: AmongUsState,
	settings: ISettings,
	lobbySettings: ILobbySettings,
	me: Player,
	other: Player,
	audio: AudioNodes
): void {
	const { pan, gain, muffle, reverbGain } = audio;
	const audioContext = pan.context;
	let panPos = [other.x - me.x, other.y - me.y];

	reverbGain.gain.value = 0;

	switch (state.gameState) {
		case GameState.MENU:
			gain.gain.value = 0;
			break;

		case GameState.LOBBY:
			gain.gain.value = 1;
			break;

		case GameState.TASKS:
			gain.gain.value = 1;

			// Mute all alive crewmates when comms is sabotaged
			if (
				!me.isDead &&
				lobbySettings.commsSabotage &&
				state.commsSabotaged &&
				!me.isImpostor
			) {
				gain.gain.value = 0;
			}

			// Mute other players which are in a vent
			if (other.inVent && !lobbySettings.hearImpostorsInVents) {
				gain.gain.value = 0;
			}

			// Mute dead players for still living players
			if (!me.isDead && other.isDead) {
				gain.gain.value = 0;
			}

			// Haunting
			if (
				!me.isDead &&
				me.isImpostor &&
				other.isDead &&
				!other.isImpostor &&
				lobbySettings.haunting
			) {
				gain.gain.value = 0.075;
				reverbGain.gain.value = 1;
			}

			break;
		case GameState.DISCUSSION:
			panPos = [0, 0];
			gain.gain.value = 1;

			// Mute dead players for still living players
			if (!me.isDead && other.isDead) {
				gain.gain.value = 0;
			}

			break;
		case GameState.UNKNOWN:
		default:
			gain.gain.value = 0;
			break;
	}

	// Muffling in vents
	if (me.inVent || other.inVent) {
		muffle.frequency.value = 1200;
		muffle.Q.value = 20;
		if (gain.gain.value === 1) gain.gain.value = 0.7; // Too loud at 1
	} else {
		muffle.frequency.value = 20000;
		muffle.Q.value = 0;
	}

	// Clamp panning position
	if (isNaN(panPos[0])) panPos[0] = 999;
	if (isNaN(panPos[1])) panPos[1] = 999;

	panPos[0] = Math.min(Math.max(panPos[0], -999), 999);
	panPos[1] = Math.min(Math.max(panPos[1], -999), 999);

	// Mute players if distance between two players is too big
	if (
		Math.pow(panPos[0], 2) + Math.pow(panPos[1], 2) >
		pan.maxDistance * pan.maxDistance
	) {
		gain.gain.value = 0;
	}

	// Reset panning position if the setting is disabled
	if (!settings.enableSpatialAudio) {
		panPos = [0, 0];
	}

	// Apply position's to PanNode
	pan.positionX.setValueAtTime(panPos[0], audioContext.currentTime);
	pan.positionY.setValueAtTime(panPos[1], audioContext.currentTime);
	pan.positionZ.setValueAtTime(-0.5, audioContext.currentTime);
}

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

const Voice: React.FC<VoiceProps> = function ({
	error: initialError,
}: VoiceProps) {
	const [error, setError] = useState(initialError);
	const [settings, setSettings] = useContext(SettingsContext);
	const settingsRef = useRef<ISettings>(settings);
	const [lobbySettings, setLobbySettings] = useContext(LobbySettingsContext);
	const lobbySettingsRef = useRef(lobbySettings);
	const gameState = useContext(GameStateContext);
	let displayedLobbyCode = '';
	if (gameState) displayedLobbyCode = gameState.lobbyCode;
	if (displayedLobbyCode !== 'MENU' && settings.hideCode)
		displayedLobbyCode = 'LOBBY';
	const [talking, setTalking] = useState(false);
	const [socketClients, setSocketClients] = useState<SocketClientMap>({});
	const socketClientsRef = useRef(socketClients);
	const [peerConnections, setPeerConnections] = useState<PeerConnections>({});
	const [connect, setConnect] = useState<{
		connect: (lobbyCode: string, playerId: number, clientId: number) => void;
	} | null>(null);
	const [otherTalking, setOtherTalking] = useState<OtherTalking>({});
	const [otherDead, setOtherDead] = useState<OtherTalking>({});
	const audioElements = useRef<AudioElements>({});
	const [audioConnected, setAudioConnected] = useState<AudioConnected>({});
	const classes = useStyles();
	const convolverBuffer = useRef<AudioBuffer | null>(null);

	const [deafenedState, setDeafened] = useState(false);
	const [mutedState, setMuted] = useState(false);
	const [connected, setConnected] = useState(false);
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
		const audio = audioElements.current[peer];
		if (audio) {
			document.body.removeChild(audio.element);
			audio.pan.disconnect();
			audio.muffle.disconnect();
			audio.gain.disconnect();
			audio.reverb?.disconnect();
			audio.reverbGain?.disconnect();
			audio.compressor.disconnect();
			delete audioElements.current[peer];
		}
	}

	useEffect(() => {
		(async () => {
			const context = new AudioContext();
			convolverBuffer.current = await context.decodeAudioData(reverbOgx);
			await context.close();
		})();
	}, []);

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
				peer.send(JSON.stringify(settings.localLobbySettings));
			} catch (e) {
				console.warn('failed to update lobby settings: ', e);
			}
		});
	}, [settings.localLobbySettings]);

	useEffect(() => {
		for (const peer in audioElements.current) {
			audioElements.current[peer].pan.maxDistance = lobbySettings.maxDistance;
		}
	}, [lobbySettings.maxDistance]);

	useEffect(() => {
		for (const peer in audioElements.current) {
			const audio = audioElements.current[peer];
			if (lobbySettings.haunting) {
				audio.gain.disconnect();
				audio.gain.connect(audio.compressor);
				audio.gain.connect(audio.reverbGain);
				audio.reverbGain.connect(audio.reverb);
				audio.reverb.connect(audio.compressor);
			} else {
				audio.gain.disconnect();
				audio.gain.connect(audio.compressor);
				audio.reverbGain.disconnect();
				audio.reverb.disconnect();
			}
		}
	}, [lobbySettings.haunting]);

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
					old[player.id] = player.isDead || player.disconnected;
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

		// Initialize variables
		let audioListener: {
			connect: () => void;
			destroy: () => void;
		};
		const audio = {
			deviceId: (undefined as unknown) as string,
			autoGainControl: false,
			googAutoGainControl: false,
			googAutoGainControl2: false,
		};

		// Get microphone settings
		if (settingsRef.current.microphone.toLowerCase() !== 'default')
			audio.deviceId = settingsRef.current.microphone;
		navigator.getUserMedia(
			{ video: false, audio },
			async (stream) => {
				connectionStuff.current.stream = stream;

				stream.getAudioTracks()[0].enabled = !settings.pushToTalk;

				ipcRenderer.on(IpcRendererMessages.TOGGLE_DEAFEN, () => {
					connectionStuff.current.deafened = !connectionStuff.current.deafened;
					stream.getAudioTracks()[0].enabled =
						!connectionStuff.current.deafened && !connectionStuff.current.muted;
					setDeafened(connectionStuff.current.deafened);
				});
				ipcRenderer.on(IpcRendererMessages.TOGGLE_MUTE, () => {
					connectionStuff.current.muted = !connectionStuff.current.muted;
					if (connectionStuff.current.deafened) {
						connectionStuff.current.deafened = false;
						connectionStuff.current.muted = false;
					}
					stream.getAudioTracks()[0].enabled =
						!connectionStuff.current.muted && !connectionStuff.current.deafened;
					setMuted(connectionStuff.current.muted);
					setDeafened(connectionStuff.current.deafened);
				});
				ipcRenderer.on(
					IpcRendererMessages.PUSH_TO_TALK,
					(_: unknown, pressing: boolean) => {
						if (!connectionStuff.current.pushToTalk) return;
						if (!connectionStuff.current.deafened) {
							stream.getAudioTracks()[0].enabled = pressing;
						}
					}
				);

				const ac = new AudioContext();
				ac.createMediaStreamSource(stream);
				audioListener = VAD(ac, ac.createMediaStreamSource(stream), undefined, {
					onVoiceStart: () => setTalking(true),
					onVoiceStop: () => setTalking(false),
					noiseCaptureDuration: 1,
					stereo: false,
				});

				audioElements.current = {};

				const connect = (
					lobbyCode: string,
					playerId: number,
					clientId: number
				) => {
					console.log('Connect called', lobbyCode, playerId, clientId);
					if (lobbyCode === 'MENU') {
						Object.keys(peerConnections).forEach((k) => {
							disconnectPeer(k);
						});
						setSocketClients({});
						currentLobby = lobbyCode;
					} else if (currentLobby !== lobbyCode) {
						socket.emit('join', lobbyCode, playerId, clientId);
						currentLobby = lobbyCode;
					}
				};
				setConnect({ connect });
				function createPeerConnection(peer: string, initiator: boolean) {
					const connection = new Peer({
						stream,
						initiator,
						config: {
							iceServers: [
								{
									urls: 'stun:stun.l.google.com:19302',
								},
							],
						},
					});
					setPeerConnections((connections) => {
						connections[peer] = connection;
						return connections;
					});
					let retries = 0;
					let errCode: PeerErrorCode;

					connection.on('connect', () => {
						if (gameState.isHost) {
							try {
								connection.send(JSON.stringify(lobbySettingsRef.current));
							} catch (e) {
								console.warn('failed to update lobby settings: ', e);
							}
						}
					});
					connection.on('stream', async (stream: MediaStream) => {
						setAudioConnected((old) => ({ ...old, [peer]: true }));
						const audio = document.createElement(
							'audio'
						) as ExtendedAudioElement;
						document.body.appendChild(audio);
						audio.srcObject = stream;
						if (settingsRef.current.speaker.toLowerCase() !== 'default')
							audio.setSinkId(settingsRef.current.speaker);

						const context = new AudioContext();
						const source = context.createMediaStreamSource(stream);
						const gain = context.createGain();
						gain.gain.value = 0; // Mute to start, workaround to address duplicate sources aka "can be heard anywhere"
						const pan = context.createPanner();
						pan.refDistance = 0.1;
						pan.panningModel = 'equalpower';
						pan.distanceModel = 'linear';
						pan.maxDistance = lobbySettingsRef.current.maxDistance;
						pan.rolloffFactor = 1;

						const muffle = context.createBiquadFilter();
						muffle.type = 'lowpass';

						const compressor = context.createDynamicsCompressor();

						source.connect(pan);
						pan.connect(muffle);
						muffle.connect(gain);

						const reverb = context.createConvolver();
						const reverbGain = context.createGain();
						reverbGain.gain.value = 0;
						reverb.buffer = convolverBuffer.current;

						if (lobbySettingsRef.current.haunting) {
							gain.connect(compressor);
							gain.connect(reverbGain);
							reverbGain.connect(reverb);
							reverb.connect(compressor);
						} else {
							gain.connect(compressor);
						}

						// Source -> pan -> muffle -> gain -> VAD -> destination
						VAD(context, compressor, context.destination, {
							onVoiceStart: () => setTalking(true),
							onVoiceStop: () => setTalking(false),
							stereo: settingsRef.current.enableSpatialAudio,
						});

						const setTalking = (talking: boolean) => {
							if (!socketClientsRef.current[peer]) return;
							setOtherTalking((old) => ({
								...old,
								[socketClientsRef.current[peer].playerId]:
									talking && gain.gain.value > 0,
							}));
						};
						audioElements.current[peer] = {
							element: audio,
							gain,
							pan,
							muffle,
							reverb,
							reverbGain,
							compressor,
						};
					});
					connection.on('signal', (data) => {
						socket.emit('signal', {
							data,
							to: peer,
						});
					});
					connection.on('data', (data) => {
						if (gameState.hostId !== socketClientsRef.current[peer]?.clientId)
							return;
						const settings = JSON.parse(data);
						Object.keys(lobbySettings).forEach((field: string) => {
							if (field in settings) {
								setLobbySettings({
									type: 'setOne',
									action: [field, settings[field]],
								});
							}
						});
					});
					connection.on('close', () => {
						console.log('Disconnected from', peer, 'Initiator:', initiator);
						disconnectPeer(peer);

						// Auto reconnect on connection error
						if (
							initiator &&
							errCode &&
							retries < 10 &&
							(errCode == 'ERR_CONNECTION_FAILURE' ||
								errCode == 'ERR_DATA_CHANNEL')
						) {
							createPeerConnection(peer, initiator);
							retries++;
						}
					});
					return connection;
				}
				socket.on('join', async (peer: string, client: Client) => {
					createPeerConnection(peer, true);
					setSocketClients((old) => ({ ...old, [peer]: client }));
				});
				socket.on(
					'signal',
					({ data, from }: { data: Peer.SignalData; from: string }) => {
						let connection: Peer.Instance;
						if (peerConnections[from]) {
							connection = peerConnections[from];
						} else {
							connection = createPeerConnection(from, false);
						}
						connection.signal(data);
					}
				);
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
			socket.emit('leave');
			Object.keys(peerConnections).forEach((k) => {
				disconnectPeer(k);
			});
			connectionStuff.current.socket?.close();
			audioListener?.destroy();
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
		if (
			!gameState ||
			!gameState.players ||
			gameState.lobbyCode === 'MENU' ||
			!myPlayer
		)
			return [];
		else otherPlayers = gameState.players.filter((p) => !p.isLocal);

		const playerSocketIds: {
			[index: number]: string;
		} = {};
		for (const k of Object.keys(socketClients)) {
			playerSocketIds[socketClients[k].playerId] = k;
		}
		for (const player of otherPlayers) {
			const audio = audioElements.current[playerSocketIds[player.id]];
			if (audio) {
				calculateVoiceAudio(
					gameState,
					settingsRef.current,
					lobbySettingsRef.current,
					myPlayer,
					player,
					audio
				);
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
		if (
			connect?.connect &&
			gameState.lobbyCode &&
			myPlayer?.id !== undefined &&
			gameState.gameState === GameState.LOBBY &&
			(gameState.oldGameState === GameState.DISCUSSION ||
				gameState.oldGameState === GameState.TASKS)
		) {
			connect.connect(gameState.lobbyCode, myPlayer.id, gameState.clientId);
		} else if (
			gameState.oldGameState !== GameState.UNKNOWN &&
			gameState.oldGameState !== GameState.MENU &&
			gameState.gameState === GameState.MENU
		) {
			// On change from a game to menu, exit from the current game properly
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
		if (
			connectionStuff.current.socket &&
			myPlayer &&
			myPlayer.id !== undefined
		) {
			connectionStuff.current.socket.emit(
				'id',
				myPlayer.id,
				gameState.clientId
			);
		}
	}, [myPlayer?.id]);

	const playerSocketIds: {
		[index: number]: string;
	} = {};

	for (const k of Object.keys(socketClients)) {
		if (socketClients[k].playerId !== undefined)
			playerSocketIds[socketClients[k].playerId] = k;
	}

	// Pass voice state to overlay
	useEffect(() => {
		ipcRenderer.send(
			IpcMessages.SEND_TO_OVERLAY,
			IpcOverlayMessages.NOTIFY_VOICE_STATE_CHANGED,
			{
				otherTalking,
				playerSocketIds,
				otherDead,
				socketClients,
				audioConnected,
			} as VoiceState
		);
	}, [otherTalking, playerSocketIds, otherDead, socketClients, audioConnected]);

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
								background:
									gameState.lobbyCode === 'MENU' ? 'transparent' : '#3e4346',
							}}
						>
							{displayedLobbyCode}
						</span>
					)}
				</div>
			</div>
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
					const peer = playerSocketIds[player.id];
					const connected = Object.values(socketClients)
						.map(({ playerId }) => playerId)
						.includes(player.id);
					const audio = audioConnected[peer];
					return (
						<Grid
							item
							key={player.id}
							xs={getPlayersPerRow(otherPlayers.length)}
						>
							<Avatar
								connectionState={
									!connected ? 'disconnected' : audio ? 'connected' : 'novoice'
								}
								player={player}
								talking={otherTalking[player.id]}
								borderColor="#2ecc71"
								isAlive={!otherDead[player.id]}
								size={50}
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
	else
		return Math.min(
			12,
			Math.floor(12 / Math.ceil(Math.sqrt(playerCount)))
		) as ValidPlayersPerRow;
}

export default Voice;
