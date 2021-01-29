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
import { CameraLocation, MapType, PolusMap, SkeldMap, Vector2 } from '../common/AmongusMap';
import Store from 'electron-store';
import { ObsVoiceState } from '../common/ObsOverlay';
import intersect from 'path-intersection';

export interface ExtendedAudioElement extends HTMLAudioElement {
	setSinkId: (sinkId: string) => Promise<void>;
}

export const colliderMaps: { [key in MapType]: string[] | undefined } = {
	[MapType.THE_SKELD]: [
		'M 38.575423,44.398703 36.353734,44.375313 33.898182,41.943051 33.886492,39.604333 H 31.793427 L 31.781747,40.317644 33.196613,40.352684 33.184933,42.808334 34.892127,44.562373 34.927187,45.720038 29.875767,45.708378 29.09233,44.702733 V 40.32933 L 30.285027,40.36437 30.296707,39.615982 25.420686,39.604312 V 41.568832 L 24.111058,41.557172 24.122738,44.153146 25.759773,44.082956 25.771453,42.92529 26.695208,42.036581 27.618966,42.059971 28.320549,42.77328 28.297169,47.158371 25.748074,47.193411 25.771454,45.88373 24.111035,45.95394 24.134405,48.70193 25.432337,48.67854 25.444017,50.292253 28.835015,50.257213 28.870075,53.063671 29.957531,53.122101 V 46.912812 L 34.927097,46.877772 34.938787,48.035435 33.687629,49.22818 33.722689,51.297943 32.693695,52.210046 H 31.325603 L 31.372343,53.098753 35.008902,53.063713 34.985522,49.672573 36.552402,48.222572 38.540225,48.199182 Z',
		'M 40.067838,44.383854 40.084378,45.814257 46.84779,45.789467 46.83949,49.320001 45.979594,50.171628 41.986039,50.179928 V 47.600241 L 40.092615,47.575451 40.067825,48.23691 40.93599,48.2617 40.92769,50.849656 H 46.938692 L 46.946992,50.64295 47.947448,49.56808 47.997058,49.57638 48.600639,49.53504 48.608939,45.020587 50.899238,45.061927 50.932308,43.871302 47.60848,43.854762 47.62502,44.970973 44.044876,44.962673 44.061416,43.598415 45.591038,42.019183 V 41.61404 L 47.600218,41.65538 47.616758,42.02745 48.575873,42.01915 48.608943,40.828525 H 48.054958 L 46.980089,39.82807 V 39.563486 L 44.830349,39.522146 V 41.903396 L 42.39121,44.41694 Z',
		'M 35.892382,33.436718 33.908007,35.338411 33.899707,37.686588 H 25.433041 L 25.424741,36.471158 H 22.076095 L 20.88547,37.562565 20.87717,41.564387 22.60523,41.556087 22.64657,44.144043 21.158289,44.094433 21.141749,42.672297 19.636931,42.721907 19.595591,41.02692 18.669549,41.03522 16.974562,42.11009 16.982862,47.823436 18.644777,48.840428 19.645232,48.865218 19.612162,47.195035 21.166589,47.261185 21.141789,45.913464 22.646606,45.921764 22.663146,48.658548 H 20.827599 L 20.811059,52.80093 22.084366,53.702167 25.432999,53.718707 25.416459,52.040256 27.409102,52.073326 27.450442,54.917597 34.999336,54.867987 35.024126,55.165643 37.107813,57.224414 40.952539,57.199604 V 52.61901 L 44.243294,52.63555 44.259834,53.495446 C 44.259834,53.495446 41.481709,53.429296 41.489977,53.462376 41.498277,53.495446 41.523047,56.19916 41.523047,56.19916 L 42.506966,57.166543 C 42.506966,57.166543 45.342969,57.133473 45.376042,57.150003 45.409112,57.166543 46.417839,56.18262 46.417839,56.18262 L 46.426139,53.495446 45.797753,53.454106 V 52.643819 H 46.971842 L 46.988382,54.677804 49.295218,54.636464 51.453226,52.577675 51.428416,49.559772 H 50.113768 L 50.097228,46.880865 52.428868,46.864325 V 45.218947 L 55.36409,45.177607 55.37239,46.525329 57.158327,46.550129 58.721023,45.260286 58.754093,43.391666 57.141788,42.077017 55.380655,42.043947 55.364115,43.399937 52.420625,43.383397 V 42.052213 L 50.105521,42.060513 50.080711,40.836815 51.428432,40.820275 51.453242,37.827176 49.295234,35.735314 46.98013,35.760124 46.95532,37.69489 44.879995,37.73623 44.855185,36.272753 41.977842,33.445019 Z',
	],
	[MapType.MIRA_HQ]: [
		'M 62.718433,18.48407 62.696841,23.385803 58.950362,23.375006 58.928767,21.906645 58.810003,21.885052 58.799205,23.806877 58.810003,27.639729 62.740029,31.526567 64.132811,31.537365 64.175996,33.739904 H 68.883389 L 68.948169,39.494584 68.906834,40.28329 66.627632,40.235087 66.562083,40.352 H 68.899199 L 68.894187,42.323337 60.224381,42.312539 60.235176,43.327436 57.827497,43.424607 57.773514,40.401512 57.881482,40.304341 60.699438,40.325934 60.65625,40.185575 57.816702,40.271951 57.805904,38.274548 58.820801,38.242157 58.766815,38.188175 57.751921,38.220565 57.784311,33.772295 60.915372,33.750702 60.92617,38.134189 59.878883,38.177377 59.911273,38.242157 61.012545,38.29614 V 33.739904 L 62.005847,33.729107 57.741123,29.475181 53.379229,33.772295 53.50879,33.869466 53.4764,35.337826 53.551976,35.327029 53.562773,33.761497 57.05013,33.772295 V 37.4324 L 53.551976,37.389212 V 36.406706 L 53.50879,36.395911 53.465602,39.030322 53.551976,38.997932 V 37.464791 L 57.060927,37.497181 57.039332,41.902263 53.551976,41.891465 53.541181,40.109999 53.454805,40.163982 V 41.880668 L 43.651339,41.826685 43.672931,42.312539 33.966636,42.334132 33.945044,39.624145 M 33.945044,39.624145 H 33.232457 L 33.25405,35.607746 37.864272,35.569956 37.891262,39.624145 37.232658,39.63494 37.243456,40.423105 43.818688,40.40691 43.81329,39.726713 51.219875,39.721316 51.23607,36.363521 51.117306,36.385113 51.106509,39.543169 48.283153,39.553964 43.824088,39.521574 43.851078,37.011326 44.979341,37.016724 45.011731,36.854772 45.017131,30.203962 40.099202,30.187767 40.061414,30.085199 40.056014,23.434388 44.871375,23.407396 44.898365,29.081097 44.963146,29.0757 44.984741,24.800179 47.149493,24.794781 47.219671,25.512766 47.257459,24.762391 52.06742,24.767789 52.09981,30.144579 47.322239,30.160775 47.268256,30.133784 47.273654,26.565452 47.187281,26.57085 47.171086,30.80858 47.192678,36.995131 48.315543,36.989731 48.288551,33.772295 51.084916,33.7561 51.122704,35.337826 51.176687,35.316234 V 31.515769 L 52.688235,31.526567 56.499495,27.823276 56.531885,23.321022 52.763814,23.375006 52.709828,20.006414 52.699033,18.527256 53.50879,18.494866 56.402324,18.538053 56.445512,22.446484 56.510292,22.42489 56.521087,18.473273 57.179691,18.51646 57.147301,18.376102 52.688235,18.386898 52.677438,17.350409 54.404921,15.914438 56.002843,15.029103 56.942161,14.813168 58.45371,14.888745 59.706136,15.234242 61.120511,16.054796 62.470109,17.188457 62.767299,17.7466 62.696841,18.397695 H 58.313351 L 58.345741,18.451679 58.78841,18.484069 58.810003,20.826968 58.874784,20.816172 58.896376,18.462476 62.718435,18.48407',
	],
	[MapType.POLUS]: [
		'M 54.122079,60.018712 V 61.455286 L 54.50628,61.421877 54.439462,63.77719 53.403793,64.979904 49.728836,65.096834 49.778948,61.388468 52.384827,61.338356 52.401532,60.068827',
		'M 51.349158,48.225445 51.315749,47.674201 41.677341,47.807837 41.643932,49.996105 41.994724,50.079626 H 41.627229 V 52.585278 L 44.600603,52.668802 44.567194,57.663399 H 44.299922 L 44.283219,55.057521 43.314368,54.038558 40.274176,54.071966 40.286706,57.717689 42.545968,57.730217 42.537617,60.494786 42.537615,57.742746 40.286706,57.755273 40.274177,60.39456 40.875534,60.419617 40.265825,60.457201 40.274176,62.181926 42.813237,62.206983 40.274176,62.240389 40.257473,64.812859 44.500376,64.796156 44.508729,61.739261 45.268776,61.755965',
		'M 46.7054 61.7894 L 47.0478 61.781 V 57.772 L 46.4798 57.7636 L 46.4882 53.4873 L 47.908 53.466 M 48.4259 50.0963 L 51.3742 50.0963',
		'M 46.4882 53.4873 V 52.6521 H 46.6803 V 50.51 H 46.9599',
		'M 43.456354,50.096332 H 44.608953 L 44.600603,52.668802',
		'M 50.179853,59.267018 50.196557,54.62321 53.370384,54.639915 53.387088,57.529764 51.783469,57.546468 51.766765,59.267018',
		'M 54.357701,46.278458 54.334076,43.46726 54.168711,43.278274 V 39.474888 L 55.727864,38.718937 57.664992,38.695312 59.365885,39.380395 59.436756,43.490885 59.129649,43.656249 59.20052,46.254836',
		'M 57.357885,49.774739 H 62.862166 V 52.751301 H 58.562686 V 51.452009 H 57.263392',
		'M 68.796846,57.490092 V 57.746923 L 65.62021,57.717394 65.153738,57.723299 65.555338,57.771299 65.55049,59.619057 61.911784,59.642763 61.955475,62.179145 61.969662,59.642763 65.556387,59.646642 65.558291,63.157459 H 66.972655 V 59.271391 H 73.669921 V 58.928849 L 74.851098,57.747675 H 78.193825 V 50.885044 L 72.616904,50.872642 72.604502,50.487328 72.624999,48.383945 75.516876,48.379798 75.53266,49.500238 75.571889,48.372036 75.659456,48.365698 72.626033,48.35914 72.629892,48.079308 72.601523,48.355887 72.236471,48.370193 72.604226,48.381551 72.571429,50.486987 64.893787,50.495255 V 50.129093',
		'M 57.446243,60.553253 57.454595,59.667921 57.955726,59.634512 55.809218,59.651217 55.814173,57.73119 56.654127,57.724188 55.820079,57.689849 55.788337,55.170276 63.485236,55.176677 63.50602,57.659222 62.98827,57.721917 63.769865,57.721365 63.533164,57.66131 63.529531,55.176648 68.796846,55.166101 68.821902,55.934501',
		'M 57.437892,62.19863 V 62.632944 H 59.584399 V 59.65957 H 59.392301 60.327743 59.601105 V 65.43092 L 60.528195,65.447624 60.603365,63.418048 60.595012,65.447624 62.808339,65.455976 V 62.850101 H 63.292764',
		'M 57.997486,57.74024 61.58725,57.716853',
		'M 62.93776,65.385155 65.480239,65.372752 65.455434,64.930403 65.889517,64.934536 68.688312,64.926267 V 60.854166 H 73.711262 L 75.087921,62.230825 H 78.217447 L 79.397737,61.050537 V 58.886327 L 79.986848,58.142187 V 50.866145 L 81.227082,50.849609 81.196481,48.426732 H 77.13315 L 81.202328,48.36242 81.254946,45.84257 H 77.103916 L 77.086377,44.907125 75.753369,44.895433 75.741677,45.655481 75.045942,44.901281 73.210133,44.91882 72.648867,45.509317 72.566111,45.921744 68.78753,45.888671 68.795799,48.302994 70.788442,48.294726 V 48.410481 L 67.435676,48.439419 67.415004,48.327799 68.692447,48.294726 68.688312,45.901072 64.967609,45.917609 64.95934,48.327799 66.083819,48.319531 66.096223,48.422882 64.963476,48.435286 64.95934,48.637856 64.851853,48.65026 64.860122,46.012695 64.649283,45.979622 64.624478,46.293815 64.516991,46.343424 64.558333,43.46608 64.938671,42.978255 64.905598,42.498697 64.566601,42.1597 63.921679,42.134895 63.54134,42.523502 63.483463,42.969986 63.640559,43.292447 63.847265,43.457812 63.888606,46.35996',
	],
	[MapType.UNKNOWN]: undefined,
};

export function poseCollide(p1: Vector2, p2: Vector2, map: MapType): boolean {
	console.log(p1.x + 40, 40 - p1.y);
	const colliderMap = colliderMaps[map];
	if (!colliderMap || map === MapType.UNKNOWN) {
		return false;
	}
	for (const collider of colliderMap) {
		const intersections = intersect(collider, `M ${p1.x + 40} ${40 - p1.y} L ${p2.x + 40} ${40 - p2.y}`);
		if (intersections.length > 0){
			console.log(intersections)
			return true;
		} 
	}

	return false;
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
	const hostRef = useRef({ hostId: gameState.hostId, isHost: gameState.isHost });
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
					poseCollide({ x: me.x, y: me.y }, { x: other.x, y: other.y }, gameState.map)
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
			(!settingsRef.current.mobileHost && !settings.obsOverlay)
		) {
			return;
		}
		if (settingsRef.current.mobileHost) {
			connectionStuff.current.socket?.emit('signal', {
				to: gameState.lobbyCode + '_mobile',
				data: { gameState, lobbySettings },
			});
		}
		
		if (
			settings.obsOverlay &&
			settings.obsSecret &&
			settings.obsSecret.length === 9 &&
			(gameState.gameState !== GameState.UNKNOWN && gameState.gameState !== GameState.MENU ||  gameState.oldGameState !== gameState.gameState) 
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
						const audio = new Audio() as ExtendedAudioElement;
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
		maxDistanceRef.current = lobbySettings.visionHearing
			? myPlayer.isImpostor
				? lobbySettings.maxDistance
				: gameState.lightRadius + 0.5
			: lobbySettings.maxDistance;
		if (maxDistanceRef.current <= 0.6) {
			maxDistanceRef.current = 1;
		}
		hostRef.current = { hostId: gameState.hostId, isHost: gameState.isHost };
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
		} as VoiceState);
	}, [otherTalking, otherDead, socketClients, audioConnected, talking]);

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
