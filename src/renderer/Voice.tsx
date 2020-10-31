import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import io, { Socket } from 'socket.io-client';
import Avatar from './Avatar';
import audioActivity from 'audio-activity';
import { GameStateContext } from './App';
import { AmongUsState, GameState, Player } from '../main/GameReader';
import ReactTooltip from 'react-tooltip';
import Peer from 'simple-peer';

interface PeerConnections {
	[peer: string]: Peer.Instance;
}
interface InCall {
	[peer: string]: boolean;
}
interface AudioElements {
	[peer: string]: {
		element: HTMLAudioElement;
		gain: GainNode;
		pan: PannerNode;
	};
}
interface AudioListeners {
	[peer: string]: any;
}

interface SocketIdMap {
	[socketId: string]: number;
}

interface ConnectionStuff {
	socket: typeof Socket;
	stream: MediaStream;
}

interface OtherTalking {
	[playerId: number]: number; // volume level
}

// function clamp(number: number, min: number, max: number): number {
// 	if (min > max) {
// 		let tmp = max;
// 		max = min;
// 		min = tmp;
// 	}
// 	return Math.max(min, Math.min(number, max));
// }

// function mapNumber(n: number, oldLow: number, oldHigh: number, newLow: number, newHigh: number): number {
// 	return clamp((n - oldLow) / (oldHigh - oldLow) * (newHigh - newLow) + newLow, newLow, newHigh);
// }

function calculateVoiceAudio(state: AmongUsState, me: Player, other: Player, gain: GainNode, pan: PannerNode): void {
	const audioContext = pan.context;
	const panPos = [
		other.x - me.x,
		other.y - me.y
	];
	if (other.inVent) {
		gain.gain.value = 0;
		return;
	}
	if (me.isDead && other.isDead) {
		gain.gain.value = 1;
		pan.positionX.setValueAtTime(panPos[0], audioContext.currentTime);
		pan.positionY.setValueAtTime(panPos[1], audioContext.currentTime);
		pan.positionZ.setValueAtTime(-0.5, audioContext.currentTime);
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
		pan.positionZ.setValueAtTime(-0.5, audioContext.currentTime);
	} else if (state.gameState === GameState.TASKS) {
		// const distance = Math.sqrt(Math.pow(me.x - other.x, 2) + Math.pow(me.y - other.y, 2));
		gain.gain.value = 1;
		// gain.gain.value = mapNumber(distance, 0, 2.66, 1, 0);
		pan.positionX.setValueAtTime(panPos[0], audioContext.currentTime);
		pan.positionY.setValueAtTime(panPos[1], audioContext.currentTime);
		pan.positionZ.setValueAtTime(-0.5, audioContext.currentTime);
	} else {
		gain.gain.value = 0;
	}
}


export default function Voice() {
	const gameState = useContext(GameStateContext);
	console.log(gameState);
	const [talking, setTalking] = useState(false);
	const [socketPlayerIds, setSocketPlayerIds] = useState<SocketIdMap>({});
	const [connect, setConnect] = useState<({ connect: (lobbyCode: string, playerId: number) => void }) | null>(null);
	const [otherTalking, setOtherTalking] = useState<OtherTalking>({});
	const audioElements = useRef<AudioElements>({});

	// const [audioContext] = useState<AudioContext>(() => new AudioContext());
	const connectionStuff = useRef<ConnectionStuff>({} as any);
	useEffect(() => {
		connectionStuff.current.socket = io('ws://ottomated.net:5679', { transports: ['websocket'] });
		const { socket } = connectionStuff.current;
		let audioListener: any;
		navigator.getUserMedia({ video: false, audio: true }, async (stream) => {
			connectionStuff.current.stream = stream;

			audioListener = audioActivity(stream, (level) => {
				setTalking(level > 0.1);
			});
			const peerConnections: PeerConnections = {};
			const inCall: InCall = {};
			audioElements.current = {};
			const audioListeners: AudioListeners = {};

			const connect = (lobbyCode: string, playerId: number) => {
				socket.emit('leave');
				Object.keys(peerConnections).forEach(k => {
					disconnectPeer(k);
				});
				setSocketPlayerIds({});

				if (lobbyCode === 'MENU') return;

				function disconnectPeer(peer: string) {
					const connection = peerConnections[peer];
					if (!connection) return;
					delete inCall[peer];
					connection.destroy();
					delete peerConnections[peer];
					if (audioElements.current[peer]) {
						document.body.removeChild(audioElements.current[peer].element);
						audioElements.current[peer].pan.disconnect();
						audioElements.current[peer].gain.disconnect();
						delete audioElements.current[peer];
					}
					if (audioListeners[peer]) {
						audioListeners[peer].destroy();
					}
				}

				socket.emit('join', lobbyCode, playerId);
			};
			setConnect({ connect });
			function createPeerConnection(peer: string, initiator: boolean) {
				// console.log("Opening connection to ", peer, "Initiator: ", initiator);
				const connection = new Peer({
					stream, initiator, config: {
						iceServers: [
							{
								'urls': 'stun:stun.l.google.com:19302'
							}
						]
					}
				});
				peerConnections[peer] = connection;

				connection.on('stream', (stream: MediaStream) => {
					let audio = document.createElement('audio');
					document.body.appendChild(audio);
					audio.srcObject = stream;

					const context = new AudioContext();
					var source = context.createMediaStreamSource(stream);
					let gain = context.createGain();
					let pan = context.createPanner();
					let analyzer = context.createAnalyser();
					let processor = context.createScriptProcessor(2048, 1, 1);
					analyzer.smoothingTimeConstant = 0.3;
					analyzer.fftSize = 1024;
					processor.addEventListener('audioprocess', () => {
						var sum = 0;
						var data = new Uint8Array(analyzer.frequencyBinCount);
						analyzer.getByteFrequencyData(data);
				
						for(var i = 0; i < data.length; i++) {
							sum += data[i];
						}
				
						const volume = (sum / data.length) / 255;
						console.log(volume);
						setSocketPlayerIds(socketPlayerIds => {
							setOtherTalking(old => ({
								...old,
								[socketPlayerIds[peer]]: volume
							}));
							return socketPlayerIds;
						});
					});
					// let compressor = context.createDynamicsCompressor();
					pan.refDistance = 0.1;
					pan.panningModel = 'equalpower';
					pan.distanceModel = 'linear';
					pan.maxDistance = 2.66;
					pan.rolloffFactor = 1;
					source.connect(pan);
					pan.connect(gain);
					gain.connect(analyzer);
					analyzer.connect(processor);
					// gain.connect(compressor);
					// compressor.connect();

					analyzer.connect(context.destination);

					// console.log(pan, audio);
					// pan.pan.setValueAtTime(-1, audioContext.currentTime);
					// source.connect(pan);
					// pan.connect(audioContext.destination);
					audioElements.current[peer] = { element: audio, gain, pan };

					// audioListeners[peer] = audioActivity(stream, (level) => {
					// 	setSocketPlayerIds(socketPlayerIds => {
					// 		setOtherTalking(old => ({
					// 			...old,
					// 			[socketPlayerIds[peer]]: level
					// 		}));
					// 		return socketPlayerIds;
					// 	});
					// });
				});
				connection.on('signal', (data) => {
					socket.emit('signal', {
						data,
						to: peer
					});
				});
				return connection;
			}
			socket.on('join', async (peer: string, playerId: number) => {
				createPeerConnection(peer, true);
				setSocketPlayerIds(old => ({ ...old, [peer]: playerId }));
			});
			socket.on('signal', ({ data, from }: any) => {
				let connection: Peer.Instance;
				if (peerConnections[from]) connection = peerConnections[from];
				else connection = createPeerConnection(from, false);
				connection.signal(data);
			});
			socket.on('setId', (socketId: string, id: number) => {
				setSocketPlayerIds(old => ({ ...old, [socketId]: id }));
			})
			socket.on('setIds', (ids: SocketIdMap) => {
				setSocketPlayerIds(ids);
			});

		}, (error) => {
			console.error(error);
		});

		return () => {
			connectionStuff.current.socket.close();
			audioListener.destroy();
		}
	}, []);


	const myPlayer = useMemo(() => {
		if (!gameState || !gameState.players) return undefined;
		else return gameState.players.find(p => p.isLocal);
	}, [gameState]);

	const otherPlayers = useMemo(() => {
		let otherPlayers: Player[];
		if (!gameState || !gameState.players || gameState.lobbyCode === 'MENU' || !myPlayer) otherPlayers = [];
		else otherPlayers = gameState.players.filter(p => !p.isLocal);

		let playerSocketIds = {} as any;
		for (let k of Object.keys(socketPlayerIds)) {
			playerSocketIds[socketPlayerIds[k]] = k;
		}
		for (let player of otherPlayers) {
			const audio = audioElements.current[playerSocketIds[player.id]];
			if (audio) {
				calculateVoiceAudio(gameState, myPlayer!, player, audio.gain, audio.pan);
			}
		}

		return otherPlayers;
	}, [gameState]);

	useEffect(() => {
		if (connect && gameState.lobbyCode && myPlayer?.id !== undefined) {
			connect.connect(gameState.lobbyCode, myPlayer.id);
		}
	}, [connect?.connect, gameState?.lobbyCode]);

	useEffect(() => {
		if (connectionStuff.current.socket && myPlayer && myPlayer.id !== undefined) {
			connectionStuff.current.socket.emit('id', myPlayer.id);
		}
	}, [myPlayer?.id]);
	return (
		<div className="root">
			<div className="top">
				{myPlayer &&
					<Avatar player={myPlayer} borderColor='#2ecc71' talking={talking} isAlive={!myPlayer.isDead} size={100} />
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
							{gameState.lobbyCode}
						</span>
					}
				</div>
			</div>
			<hr />
			<ReactTooltip effect="solid" />
			<div className="otherplayers">
				{
					otherPlayers.map(player => {
						let connected = Object.values(socketPlayerIds).includes(player.id);
						return (
							<Avatar key={player.id}
								player={player} talking={!connected || otherTalking[player.id] > 0.1} borderColor={connected ? '#2ecc71' : '#c0392b'} isAlive size={50} />
						);
					})
				}
			</div>
		</div>
	)
}