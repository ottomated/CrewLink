import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import io, { Socket } from 'socket.io-client';
import Avatar from './Avatar';
import { GameStateContext, LobbySettingsContext, SettingsContext } from './contexts';
import { AmongUsState, GameState, Player } from '../common/AmongUsState';
import Peer from 'simple-peer';
import { ipcRenderer, remote } from 'electron';
import VAD from './vad';
import fs from 'fs';
import { ILobbySettings, ISettings } from '../common/ISettings';
import { validatePeerConfig } from './validatePeerConfig';

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
		reverbGain: GainNode;
		reverb: ConvolverNode;
		compressor: DynamicsCompressorNode;
	};
}

interface SocketIdMap {
	[socketId: string]: number;
}

interface playerConfigMap {
	[socketId: number]: SocketConfig;
}

export interface SocketConfig{
volume : number
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

interface ICEServer {
	url: string,
	username: string | undefined,
	credential: string | undefined,
}

interface PeerConfig {
	forceRelayOnly: Boolean,
	stunServers: ICEServer[],
	turnServers: ICEServer[]
}

const DEFAULT_ICE_CONFIG: RTCConfiguration = {
	iceServers: [
		{
			urls: 'stun:stun.l.google.com:19302'
		}
	]
}


function calculateVoiceAudio(state: AmongUsState, settings: ISettings, lobbySettings: ILobbySettings,  me: Player, other: Player, gain: GainNode, pan: PannerNode, reverbGain: GainNode): void {
	const audioContext = pan.context;
	pan.positionZ.setValueAtTime(-0.5, audioContext.currentTime);
	if (reverbGain != null) reverbGain.gain.value = 0;
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
	// Don't hear people inside vents
	if (other.inVent) {
		gain.gain.value = 0;
		return;
	}
	// Ghosts can hear other ghosts
	if (me.isDead && other.isDead) {
		gain.gain.value = 1;
		pan.positionX.setValueAtTime(panPos[0], audioContext.currentTime);
		pan.positionY.setValueAtTime(panPos[1], audioContext.currentTime);
		return;
	}
	// Living crewmates cannot hear ghosts
	if (!me.isDead && other.isDead && (!me.isImpostor || !lobbySettings.haunting || state.gameState !== GameState.TASKS)) {
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
	// Living impostors hear ghosts at a faint volume
	if (gain.gain.value > 0 && !me.isDead && me.isImpostor && other.isDead && lobbySettings.haunting) {
		gain.gain.value = gain.gain.value * 0.015;
		if (reverbGain != null) reverbGain.gain.value = 1;
	}
}

function toArrayBuffer(buf: Buffer) {
    var ab = new ArrayBuffer(buf.length);
    var view = new Uint8Array(ab);
    for (var i = 0; i < buf.length; ++i) {
        view[i] = buf[i];
    }
    return ab;
}

const Voice: React.FC = function () {
	const [settings, setSettings] = useContext(SettingsContext);
	const settingsRef = useRef<ISettings>(settings);
	const [lobbySettings, setLobbySettings] = useContext(LobbySettingsContext);
	const gameState = useContext(GameStateContext);
	let { lobbyCode: displayedLobbyCode } = gameState;
	if (displayedLobbyCode !== 'MENU' && settings.hideCode) displayedLobbyCode = 'LOBBY';
	const [talking, setTalking] = useState(false);
	const [socketPlayerIds, setSocketPlayerIds] = useState<SocketIdMap>({});
	const [playerConfigs] = useState<playerConfigMap>({});



	const [connect, setConnect] = useState<({ connect: (lobbyCode: string, playerId: number) => void }) | null>(null);
	const [otherTalking, setOtherTalking] = useState<OtherTalking>({});
	const [otherDead, setOtherDead] = useState<OtherDead>({});
	const audioElements = useRef<AudioElements>({});
	const peerConnections = useRef<PeerConnections>({});
	const [audioConnected, setAudioConnected] = useState<AudioConnected>({});

	const [deafenedState, setDeafened] = useState(false);
	const [connected, setConnected] = useState(false);
	const [inRoom, setInRoom] = useState(false);

	let joinedLobby = '';

	var reverbFile:any = null;
	if (fs.existsSync("static/reverb.ogx"))
		reverbFile = fs.readFileSync('static/reverb.ogx');
	else if (fs.existsSync("resources/static/reverb.ogx"))
		reverbFile = fs.readFileSync('resources/static/reverb.ogx');
	

	// Handle pushToTalk, if set
	useEffect(() => {
		if (!connectionStuff.current.stream) return;
		connectionStuff.current.stream.getAudioTracks()[0].enabled = !settings.pushToTalk;
		connectionStuff.current.pushToTalk = settings.pushToTalk;
	}, [settings.pushToTalk]);

	// Add settings to settingsRef
	useEffect(() => {
		if (connectionStuff.current.socket && gameState.isHost === true && inRoom === true) {
			connectionStuff.current.socket.emit('config', settings.localLobbySettings);
			console.log("emit shit");
		}
	}, [settings.localLobbySettings]);

	useEffect(() => {
		for (let peer in audioElements.current) {
			audioElements.current[peer].pan.maxDistance = lobbySettings.maxDistance;
		}
		console.log("Maxdistance change",lobbySettings.maxDistance )
	}, [lobbySettings.maxDistance]);

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
			audioElements.current[peer].pan?.disconnect();
			audioElements.current[peer].gain?.disconnect();
            audioElements.current[peer].reverbGain?.disconnect();
			audioElements.current[peer].reverb?.disconnect();
			audioElements.current[peer].compressor?.disconnect();
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
			setInRoom(false);
		});

		let iceConfig: RTCConfiguration = DEFAULT_ICE_CONFIG;
		socket.on('peerConfig', (peerConfig: PeerConfig) => {
			if (!validatePeerConfig(peerConfig)) {
				alert(`Server sent a malformed peer config. Default config will be used.${validatePeerConfig.errors ?
					` See errors below:\n${validatePeerConfig.errors.map(error => error.dataPath + ' ' + error.message).join('\n')}` : ``
					}`);
				return;
			}

			if (peerConfig.forceRelayOnly && !peerConfig.turnServers) {
				alert(`Server has forced relay mode enabled but provides no relay servers. Default config will be used.`);
				return;
			}

			iceConfig = {
				iceTransportPolicy: peerConfig.forceRelayOnly ? 'relay' : 'all',
				iceServers: [...(peerConfig.stunServers || []), ...(peerConfig.turnServers || [])]
					.map((server) => {
						return {
							urls: server.url,
							username: server.username,
							credential: server.credential
						}
					})
			};
		})

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
				onVoiceStart: () => {
					setTalking(true)
					let overlay = remote.getGlobal("overlay");
					if (overlay) {
						overlay.webContents.send('overlayTalkingSelf', true);
					}
				},
				onVoiceStop: () => {
					setTalking(false)
					let overlay = remote.getGlobal("overlay");
					if (overlay) {
						overlay.webContents.send('overlayTalkingSelf', false);
					}
				},
				noiseCaptureDuration: 1,
				stereo: false
			});

			audioElements.current = {};

			const connect = (lobbyCode: string, playerId: number) => {
				console.log('Connect called', lobbyCode, playerId);
                const overlay = remote.getGlobal("overlay");
				overlay?.webContents?.send('overlayState', (lobbyCode === 'MENU' ? "MENU" : "VOICE"));
                
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
					stream,
					initiator, // @ts-ignore-line
					iceRestartEnabled: true,
					config: iceConfig
				});

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
					const compressor = context.createDynamicsCompressor();


					pan.refDistance = 0.1;
					pan.panningModel = 'equalpower';
					pan.distanceModel = 'linear';
					pan.maxDistance = lobbySettings.maxDistance;
					pan.rolloffFactor = 1;

					source.connect(pan);
					pan.connect(gain);
					gain.connect(compressor);
					
					var reverb:any = null;
					var reverbGain:any = null;
					if (lobbySettings.haunting) {
						reverb = context.createConvolver();
						reverbGain = context.createGain();					
						reverbGain.gain.value = 0;
						
						context.decodeAudioData(toArrayBuffer(reverbFile), 
							function(buffer) {
								reverb.buffer = buffer;
							},
							function(e) {
							  alert("Error when decoding audio data" + e);
							}
						);
						
						gain.connect(reverbGain);
						reverbGain.connect(reverb);
						reverb.connect(compressor);
					}
					
					// Source -> pan -> gain -> VAD -> destination
					VAD(context, compressor, context.destination, {
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
							
							let overlay = remote.getGlobal("overlay");
							if (overlay) {
								var reallyTalking = talking && gain.gain.value > 0;
								overlay.webContents.send(reallyTalking ? 'overlayTalking' : 'overlayNotTalking', socketPlayerIds[peer]);
						
							}
							
							return socketPlayerIds;
						});
						// let overlay = remote.getGlobal("overlay");
						// if (overlay) overlay.webContents.send('overlaySocketIds', socketPlayerIds);
						// console.log("socketPlayerIds2", socketPlayerIds);

					};
					audioElements.current[peer] = { element: audio, gain, pan, reverbGain, reverb, compressor };
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
				});

				// We have to have a listener here otherwise the ICE restart won't work
				connection.on('error', () => {});

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
				setInRoom(true);
			});
			socket.on('setSettings', (settings: { [key: string]: any }) => {
				Object.keys(lobbySettings).forEach((field: string) => {
					if (field in settings) {
						setLobbySettings({
							type: 'setOne',
							action: [field, settings[field]]
						});
					}
				});
			})

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
			return gameState.players.find((p) => p.isLocal && p.disconnected === false);
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
		let overlay = remote.getGlobal("overlay");
		if (overlay) overlay.webContents.send('overlaySocketIds', socketPlayerIds);
		console.log("socketPlayerIds3", socketPlayerIds);

		for (const player of otherPlayers) {
			const audio = audioElements.current[playerSocketIds[player.id]];
			if (audio) {
				calculateVoiceAudio(gameState, settingsRef.current, lobbySettings, myPlayer!, player, audio.gain, audio.pan, audio.reverbGain);
				if (connectionStuff.current.deafened) {
					audio.gain.gain.value = 0;
				}
				if(audio.gain.gain.value > 0){
					let playerVolume = playerConfigs[player.clientId]?.volume;
					audio.gain.gain.value = playerVolume === undefined? audio.gain.gain.value  : audio.gain.gain.value * playerVolume;
				}
			}
		}

		return otherPlayers;
	}, [gameState]);

	// Connect to P2P negotiator, when lobby and connect code change
	useEffect(() => {
		if(!gameState.players)
			return;
   		 for (let player of gameState.players) {
     		 if (playerConfigs[player.clientId] === undefined) {
        		playerConfigs[player.clientId] = { volume: 1 };
      		}
 	 	}
 	 }, [gameState?.players]);

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
		if (connectionStuff.current.socket && gameState.isHost === true && inRoom === true) {
			connectionStuff.current.socket.emit('host');
			setSettings({
				type: 'setOne',
				action: ['localLobbySettings', lobbySettings]
			});
		}
	}, [gameState.isHost]);

	useEffect(() => {
		if (connectionStuff.current.socket && gameState.isHost === true && inRoom === true) {
			connectionStuff.current.socket.emit('host');
			connectionStuff.current.socket.emit('config', settings.localLobbySettings);
		}
	}, [inRoom]);

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
						const peer = playerSocketIds[player.id];
						const connected = Object.values(socketPlayerIds).includes(player.id);
						let socketConfig = playerConfigs[player.clientId];
						const audio = audioConnected[peer];
						let borderColor = '#C0392B';
						if (connected) {
							if (audio)
								borderColor = '#2ECC71';
							else
								borderColor = '#FFFF00';
						}
						return (
							<div>
							<Avatar key={player.id} player={player}
								talking={!connected || !audio || otherTalking[player.id]}
								borderColor={borderColor}
								isAlive={!otherDead[player.id]}
								size={50} socketConfig={socketConfig}/>
								</div>
						);
					})
				}
			</div>
		</div>
	);
};

export default Voice;
