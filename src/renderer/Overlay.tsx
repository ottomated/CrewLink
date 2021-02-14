import React, { useEffect, useMemo, useState } from 'react';
import { ipcRenderer } from 'electron';
import {
	AmongUsState,
	GameState,
	VoiceState,
	OtherTalking,
} from '../common/AmongUsState';
import { IpcOverlayMessages } from '../common/ipc-messages';
import ReactDOM from 'react-dom';
import makeStyles from '@material-ui/core/styles/makeStyles';
import './css/overlay.css';
import Avatar from './Avatar';
import { ISettings } from '../common/ISettings';

interface UseStylesProps {
	hudHeight: number;
}

const useStyles = makeStyles(() => ({
	meetingHud: {
		position: 'absolute',
		top: '50%',
		left: '50%',
		transform: 'translate(-50%, -50%)',
	},
	playerIcons: {
		width: '83.45%',
		height: '63.2%',
		left: '5%',
		top: '18.4703%',
		position: 'absolute',
		display: 'flex',
		'&>*:nth-child(odd)': {
			marginRight: '1.4885%',
		},
		'&>*:nth-child(even)': {
			marginLeft: '1.4885%',
		},
		flexWrap: 'wrap',
	},
	icon: {
		width: '48.51%',
		height: '16.49%',
		borderRadius: ({ hudHeight }: UseStylesProps) => hudHeight / 100,
		transition: 'opacity .1s linear',
		marginBottom: '2.25%',
		boxSizing: 'border-box',
	},
}));

function useWindowSize() {
	const [windowSize, setWindowSize] = useState<[number, number]>([0, 0]);

	useEffect(() => {
		const onResize = () => {
			setWindowSize([window.innerWidth, window.innerHeight]);
		};
		window.addEventListener('resize', onResize);
		onResize();

		return () => window.removeEventListener('resize', onResize);
	}, []);
	return windowSize;
}

const playerColors = [
	['#C51111', '#7A0838'],
	['#132ED1', '#09158E'],
	['#117F2D', '#0A4D2E'],
	['#ED54BA', '#AB2BAD'],
	['#EF7D0D', '#B33E15'],
	['#F5F557', '#C38823'],
	['#3F474E', '#1E1F26'],
	['#8394BF', '#8394BF'],
	['#6B2FBB', '#3B177C'],
	['#71491E', '#5E2615'],
	['#38FEDC', '#24A8BE'],
	['#50EF39', '#15A742'],
];

const iPadRatio = 854 / 579;

const Overlay: React.FC = function () {
	const [gameState, setGameState] = useState<AmongUsState>(
		(undefined as unknown) as AmongUsState
	);
	const [voiceState, setVoiceState] = useState<VoiceState>(
		(undefined as unknown) as VoiceState
	);
	const [settings, setSettings] = useState<ISettings>(
		(undefined as unknown) as ISettings
	);
	useEffect(() => {
		const onState = (_: Electron.IpcRendererEvent, newState: AmongUsState) => {
			setGameState(newState);
		};
		const onVoiceState = (
			_: Electron.IpcRendererEvent,
			newState: VoiceState
		) => {
			setVoiceState(newState);
		};
		const onSettings = (_: Electron.IpcRendererEvent, newState: ISettings) => {
			setSettings(newState);
		};
		ipcRenderer.on(IpcOverlayMessages.NOTIFY_GAME_STATE_CHANGED, onState);
		ipcRenderer.on(IpcOverlayMessages.NOTIFY_VOICE_STATE_CHANGED, onVoiceState);
		ipcRenderer.on(IpcOverlayMessages.NOTIFY_SETTINGS_CHANGED, onSettings);
		return () => {
			ipcRenderer.off(IpcOverlayMessages.NOTIFY_GAME_STATE_CHANGED, onState);
			ipcRenderer.off(
				IpcOverlayMessages.NOTIFY_VOICE_STATE_CHANGED,
				onVoiceState
			);
			ipcRenderer.off(IpcOverlayMessages.NOTIFY_SETTINGS_CHANGED, onSettings);
		};
	}, []);

	if (!settings || !voiceState || !gameState) return null;
	return (
		<>
			{settings.meetingOverlay && (
				<MeetingHud
					gameState={gameState}
					otherTalking={voiceState.otherTalking}
				/>
			)}
			{settings.overlayPosition !== 'hidden' && (
				<AvatarOverlay
					voiceState={voiceState}
					gameState={gameState}
					position={settings.overlayPosition}
				/>
			)}
		</>
	);
};

interface AvatarOverlayProps {
	voiceState: VoiceState;
	gameState: AmongUsState;
	position: ISettings['overlayPosition'];
}

const useOverlayStyles = makeStyles((theme) => ({
	root: {
		width: '5%',
		position: 'absolute',
		background: '#25232ac0',
		padding: theme.spacing(2),
		'&>*': {
			marginTop: 4,
			marginBottom: 4,
		},
	},
}));
const AvatarOverlay: React.FC<AvatarOverlayProps> = ({
	voiceState,
	gameState,
	position,
}: AvatarOverlayProps) => {
	if (!gameState.players) return null;
	const classes = useOverlayStyles({ position });
	const avatars: JSX.Element[] = [];

	gameState.players.forEach((player) => {
		if (!voiceState.otherTalking[player.id]) return;
		const peer = voiceState.playerSocketIds[player.id];
		const connected = Object.values(voiceState.socketClients)
			.map(({ playerId }) => playerId)
			.includes(player.id);
		const audio = voiceState.audioConnected[peer];
		avatars.push(
			<Avatar
				key={player.id}
				connectionState={
					!connected ? 'disconnected' : audio ? 'connected' : 'novoice'
				}
				player={player}
				talking={voiceState.otherTalking[player.id]}
				borderColor="#2ecc71"
				isAlive={!voiceState.otherDead[player.id]}
				size={50}
			/>
		);
	});
	if (avatars.length === 0) return null;
	return (
		<div
			className={classes.root}
			style={{
				top: '50%',
				left: position === 'left' ? 0 : undefined,
				right: position === 'right' ? 0 : undefined,
				transform: 'translateY(-50%)',
				borderTopLeftRadius: position === 'right' ? 20 : undefined,
				borderBottomLeftRadius: position === 'right' ? 20 : undefined,
				borderTopRightRadius: position === 'left' ? 20 : undefined,
				borderBottomRightRadius: position === 'left' ? 20 : undefined,
			}}
		>
			{avatars}
		</div>
	);
};

interface MeetingHudProps {
	otherTalking: OtherTalking;
	gameState: AmongUsState;
}

const MeetingHud: React.FC<MeetingHudProps> = ({
	otherTalking,
	gameState,
}: MeetingHudProps) => {
	const [width, height] = useWindowSize();

	let hudWidth = 0,
		hudHeight = 0;
	if (width / (height * 0.96) > iPadRatio) {
		hudHeight = height * 0.96;
		hudWidth = hudHeight * iPadRatio;
	} else {
		hudWidth = width;
		hudHeight = width * (1 / iPadRatio);
	}
	const classes = useStyles({ hudHeight });
	const players = useMemo(() => {
		if (!gameState.players) return null;
		return gameState.players.sort((a, b) => {
			if ((a.disconnected || a.isDead) && (b.disconnected || b.isDead)) {
				return a.id - b.id;
			} else if (a.disconnected || a.isDead) {
				return 1000;
			} else if (b.disconnected || b.isDead) {
				return -1000;
			}
			return a.id - b.id;
		});
	}, [gameState.players]);
	if (!players || gameState.gameState !== GameState.DISCUSSION) return null;
	const overlays = gameState.players.map((player) => {
		return (
			<div
				key={player.id}
				className={classes.icon}
				style={{
					opacity: otherTalking[player.id] ? 1 : 0,
					boxShadow: `0 0 ${hudHeight / 100}px ${hudHeight / 100}px ${
						playerColors[player.colorId][0]
					}`,
				}}
			/>
		);
	});

	while (overlays.length < 10) {
		overlays.push(
			<div
				key={`spacer-${overlays.length}`}
				className={classes.icon}
				style={{
					opacity: 0,
				}}
			/>
		);
	}

	return (
		<div
			className={classes.meetingHud}
			style={{ width: hudWidth, height: hudHeight }}
		>
			<div className={classes.playerIcons}>{overlays}</div>
		</div>
	);
};

ReactDOM.render(<Overlay />, document.getElementById('app'));

export default Overlay;
