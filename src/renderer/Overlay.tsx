import React, { useEffect, useMemo, useState } from 'react';
import { ipcRenderer } from 'electron';
import { AmongUsState, GameState, VoiceState } from '../common/AmongUsState';
import { IpcOverlayMessages } from '../common/ipc-messages';
import ReactDOM from 'react-dom';
import makeStyles from '@material-ui/core/styles/makeStyles';
import './css/overlay.css';
import Avatar from './Avatar';
import { ISettings } from '../common/ISettings';
import VolumeOff from '@material-ui/icons/VolumeOff';
import MicOff from '@material-ui/icons/MicOff';

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
	['#FFFFFF', '#8394BF'],
	['#6B2FBB', '#3B177C'],
	['#71491E', '#5E2615'],
	['#38FEDC', '#24A8BE'],
	['#50EF39', '#15A742'],
];

const iPadRatio = 854 / 579;

const Overlay: React.FC = function () {
	const [gameState, setGameState] = useState<AmongUsState>((undefined as unknown) as AmongUsState);
	const [voiceState, setVoiceState] = useState<VoiceState>((undefined as unknown) as VoiceState);
	const [settings, setSettings] = useState<ISettings>((undefined as unknown) as ISettings);
	useEffect(() => {
		const onState = (_: Electron.IpcRendererEvent, newState: AmongUsState) => {
			setGameState(newState);
		};
		const onVoiceState = (_: Electron.IpcRendererEvent, newState: VoiceState) => {
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
			ipcRenderer.off(IpcOverlayMessages.NOTIFY_VOICE_STATE_CHANGED, onVoiceState);
			ipcRenderer.off(IpcOverlayMessages.NOTIFY_SETTINGS_CHANGED, onSettings);
		};
	}, []);

	if (!settings || !voiceState || !gameState || !settings.enableOverlay || gameState.gameState == GameState.MENU)
		return null;
	return (
		<>
			{settings.meetingOverlay && gameState.gameState === GameState.DISCUSSION && (
				<MeetingHud gameState={gameState} voiceState={voiceState} />
			)}
			{settings.overlayPosition !== 'hidden' && (
				<AvatarOverlay
					voiceState={voiceState}
					gameState={gameState}
					position={settings.overlayPosition}
					compactOverlay={settings.compactOverlay}
				/>
			)}
		</>
	);
};

interface AvatarOverlayProps {
	voiceState: VoiceState;
	gameState: AmongUsState;
	position: ISettings['overlayPosition'];
	compactOverlay: boolean;
}

const AvatarOverlay: React.FC<AvatarOverlayProps> = ({
	voiceState,
	gameState,
	position,
	compactOverlay,
}: AvatarOverlayProps) => {
	if (!gameState.players) return null;

	const positionParse = position.replace('1', '');

	const avatars: JSX.Element[] = [];
	const isOnSide = positionParse == 'right' || positionParse == 'left';
	const showName = isOnSide && !compactOverlay;
	const classnames: string[] = ['overlay-wrapper'];
	if (gameState.gameState == GameState.UNKNOWN || gameState.gameState == GameState.MENU) {
		classnames.push('gamestate_menu');
	} else {
		classnames.push('gamestate_game');
		classnames.push('overlay_postion_' + positionParse);
		if (compactOverlay || position === 'right1' || position === 'left1') {
			classnames.push('compactoverlay');
		}
		if (position === 'left1' || position === 'right1') {
			classnames.push('overlay_postion_' + position);
		}
	}

	const players = useMemo(() => {
		if (!gameState.players) return null;
		const playerss = gameState.players
			.filter((o) => !voiceState.localIsAlive || !voiceState.otherDead[o.clientId])
			.slice()
			.sort((a, b) => {
				if (
					(a.disconnected || voiceState.otherDead[a.clientId]) &&
					(b.disconnected || voiceState.otherDead[a.clientId])
				) {
					return a.id - b.id;
				} else if (a.disconnected || voiceState.otherDead[a.clientId]) {
					return 1000;
				} else if (b.disconnected || voiceState.otherDead[b.clientId]) {
					return -1000;
				}
				return a.id - b.id;
			});
		return playerss;
	}, [gameState.players]);

	players?.forEach((player) => {
		if (!voiceState.otherTalking[player.clientId] && !(player.isLocal && voiceState.localTalking) && compactOverlay)
			return;
		const peer = voiceState.playerSocketIds[player.clientId];
		const connected = voiceState.socketClients[peer]?.clientId === player.clientId || false;
		if (!connected && !player.isLocal) return;
		const talking =
			!player.inVent && (voiceState.otherTalking[player.clientId] || (player.isLocal && voiceState.localTalking));
		// const audio = voiceState.audioConnected[peer];
		avatars.push(
			<div key={player.id} className="player_wrapper">
				<div>
					<Avatar
						key={player.id}
						// connectionState={!connected ? 'disconnected' : audio ? 'connected' : 'novoice'}
						player={player}
						showborder={isOnSide && !compactOverlay}
						muted={voiceState.muted && player.isLocal}
						deafened={voiceState.deafened && player.isLocal}
						connectionState={'connected'}
						talking={talking}
						borderColor="#2ecc71"
						isAlive={!voiceState.otherDead[player.clientId] || (player.isLocal && !player.isDead)}
						size={100}
						lookLeft={!(positionParse === 'left' || positionParse === 'bottom_left')}
						overflow={isOnSide && !showName}
						showHat={true}
					/>
				</div>
				{showName && (
					<span
						className="playername"
						style={{
							opacity: (position === 'right1' || position === 'left1') && !talking ? 0 : 1,
						}}
					>
						<small>{player.name}</small>
					</span>
				)}
			</div>
		);
	});
	if (avatars.length === 0) return null;
	return (
		<div>
			<div className={classnames.join(' ')}>
				<div className="otherplayers">
					<div className="players_container playerContainerBack">{avatars}</div>
				</div>
			</div>
			{(voiceState.muted || voiceState.deafened) && (
			<div className="volumeicons">
			{voiceState.deafened ?  (<VolumeOff />) : (<MicOff />)}
			</div>)}

		</div>
	);
};

interface MeetingHudProps {
	gameState: AmongUsState;
	voiceState: VoiceState;
}

const MeetingHud: React.FC<MeetingHudProps> = ({ voiceState, gameState }: MeetingHudProps) => {
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
		return gameState.players.slice().sort((a, b) => {
			if ((a.disconnected || a.isDead) && (b.disconnected || b.isDead)) {
				return a.id - b.id;
			} else if (a.disconnected || a.isDead) {
				return 1000;
			} else if (b.disconnected || b.isDead) {
				return -1000;
			}
			return a.id - b.id;
		});
	}, [gameState.gameState]);
	if (!players || gameState.gameState !== GameState.DISCUSSION) return null;
	const overlays = players.map((player) => {
		return (
			<div
				key={player.id}
				className={classes.icon}
				style={{
					opacity: voiceState.otherTalking[player.clientId] || (player.isLocal && voiceState.localTalking) ? 1 : 0,
					border: 'solid',
					borderWidth: '2px',
					borderColor: '#00000037',
					boxShadow: `0 0 ${hudHeight / 100}px ${hudHeight / 100}px ${playerColors[player.colorId][0]}`,
					transition: 'opacity 400ms',
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
		<div className={classes.meetingHud} style={{ width: hudWidth, height: hudHeight }}>
			<div className={classes.playerIcons}>{overlays}</div>
		</div>
	);
};

ReactDOM.render(<Overlay />, document.getElementById('app'));

export default Overlay;
