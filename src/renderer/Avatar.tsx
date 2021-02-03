import React, { useRef } from 'react';
import { Player } from '../common/AmongUsState';
import { backLayerHats, hatOffsets, hats, skins, players, coloredHats } from './cosmetics';
import makeStyles from '@material-ui/core/styles/makeStyles';
import MicOff from '@material-ui/icons/MicOff';
import VolumeOff from '@material-ui/icons/VolumeOff';
import WifiOff from '@material-ui/icons/WifiOff';
import LinkOff from '@material-ui/icons/LinkOff';
import ErrorOutlIne from '@material-ui/icons/ErrorOutlIne';

// import Tooltip from '@material-ui/core/Tooltip';
import Tooltip from 'react-tooltip-lite';
import { SocketConfig } from '../common/ISettings';

const useStyles = makeStyles(() => ({
	canvas: {
		position: 'absolute',
		width: '100%',
	},
	icon: {
		background: '#ea3c2a',
		position: 'absolute',
		left: '50%',
		top: '62%',
		transform: 'translate(-50%, -50%)',
		border: '2px solid #690a00',
		borderRadius: '50%',
		padding: 2,
		zIndex: 10,
	},
}));

export interface CanvasProps {
	src: string;
	hat: number;
	skin: number;
	isAlive: boolean;
	className: string;
	lookLeft: boolean;
	size: number;
	borderColor: string;
	color: number;
	overflow: boolean;
}

export interface AvatarProps {
	talking: boolean;
	borderColor: string;
	isAlive: boolean;
	player: Player;
	size: number;
	deafened?: boolean;
	muted?: boolean;
	connectionState?: 'disconnected' | 'novoice' | 'connected';
	socketConfig?: SocketConfig;
	showborder?: boolean;
	showHat?: boolean;
	lookLeft?: boolean;
	overflow?: boolean;
	onConfigChange?: () => void;
}

const Avatar: React.FC<AvatarProps> = function ({
	talking,
	deafened,
	muted,
	borderColor,
	isAlive,
	player,
	size,
	connectionState,
	socketConfig,
	showborder,
	showHat,
	lookLeft = false,
	overflow = false,
	onConfigChange,
}: AvatarProps) {
	const status = isAlive ? 'alive' : 'dead';
	let image = players[status][player.colorId];
	if (!image) image = players[status][0];
	const classes = useStyles();
	let icon;

	switch (connectionState) {
		case 'connected':
			if (deafened) {
				icon = <VolumeOff className={classes.icon} />;
			} else if (muted) {
				icon = <MicOff className={classes.icon} />;
			}
			break;
		case 'novoice':
			icon = <LinkOff className={classes.icon} style={{ background: '#e67e22', borderColor: '#694900' }} />;
			break;
		case 'disconnected':
			icon = <WifiOff className={classes.icon} />;
			break;
	}
	if (player.bugged) {
		icon = <ErrorOutlIne className={classes.icon} style={{ background: 'red', borderColor: '' }} />;
	}

	return (
		<Tooltip
			useHover={!player.isLocal}
			content={
				<div>
					<b>{player?.name}</b>
					<div className="slidecontainer" style={{ minWidth: '55px' }}>
						<input
							type="range"
							min="0"
							max="2"
							value={socketConfig?.volume}
							className="relativeGainSlider"
							style={{ width: '50px' }}
							step="any"
							onMouseLeave={() => {
								console.log('onmouseleave');
								if (onConfigChange) {
									onConfigChange();
								}
							}}
							onChange={(ev): void => {
								if (socketConfig) {
									socketConfig.volume = parseFloat(ev.target.value.substr(0, 6));
								}
							}}
						></input>
					</div>{' '}
				</div>
			}
			padding={5}
		>
			<Canvas
				className={classes.canvas}
				src={image}
				color={player.colorId}
				hat={showHat === false ? -1 : player.hatId}
				skin={player.skinId - 1}
				isAlive={isAlive}
				lookLeft={lookLeft === true}
				borderColor={talking ? borderColor : showborder === true ? '#ccbdcc86' : 'transparent'}
				size={size}
				overflow={overflow}
			/>
			{icon}
		</Tooltip>
	);
};

interface UseCanvasStylesParams {
	backLayerHat: boolean;
	isAlive: boolean;
	hatY: string;
	lookLeft: boolean;
	size: number;
	borderColor: string;
	paddingLeft: number;
}
const useCanvasStyles = makeStyles(() => ({
	base: {
		width: '105%',
		position: 'absolute',
		top: '22%',
		left: ({ paddingLeft }: UseCanvasStylesParams) => paddingLeft,
		zIndex: 2,
	},
	hat: {
		width: '105%',
		position: 'absolute',
		top: ({ hatY }: UseCanvasStylesParams) => `calc(22% + ${hatY})`,
		left: ({ size, paddingLeft }: UseCanvasStylesParams) => Math.max(2, size / 40) / 2 + paddingLeft,
		zIndex: ({ backLayerHat }: UseCanvasStylesParams) => (backLayerHat ? 1 : 4),
		display: ({ isAlive }: UseCanvasStylesParams) => (isAlive ? 'block' : 'none'),
	},
	skin: {
		position: 'absolute',
		top: 'calc(33% + 22%)',
		left: ({ paddingLeft }: UseCanvasStylesParams) => paddingLeft,
		width: '105%',
		zIndex: 3,
		display: ({ isAlive }: UseCanvasStylesParams) => (isAlive ? 'block' : 'none'),
	},
	avatar: {
		// overflow: 'hidden',
		borderRadius: '50%',
		position: 'relative',
		borderStyle: 'solid',
		transition: 'border-color .2s ease-out',
		borderColor: ({ borderColor }: UseCanvasStylesParams) => borderColor,
		borderWidth: ({ size }: UseCanvasStylesParams) => Math.max(2, size / 40),
		transform: ({ lookLeft }: UseCanvasStylesParams) => (lookLeft ? 'scaleX(-1)' : 'scaleX(1)'),
		width: '100%',
		paddingBottom: '100%',
	},
}));

function Canvas({ src, hat, skin, isAlive, lookLeft, size, borderColor, color, overflow }: CanvasProps) {
	const hatImg = useRef<HTMLImageElement>(null);
	const skinImg = useRef<HTMLImageElement>(null);
	const image = useRef<HTMLImageElement>(null);
	const hatY = hatOffsets[hat] || '-33%';
	const classes = useCanvasStyles({
		backLayerHat: backLayerHats.has(hat),
		isAlive,
		hatY,
		lookLeft,
		size,
		borderColor,
		paddingLeft: -7,
	});

	return (
		<>
			<div className={classes.avatar}>
				<div
					className={classes.avatar}
					style={{
						overflow: 'hidden',
						position: 'absolute',
						top: Math.max(2, size / 40) * -1,
						left: Math.max(2, size / 40) * -1,
						transform: 'unset',
					}}
				>
					<img src={src} ref={image} className={classes.base} />
					<img src={skins[skin]} ref={skinImg} className={classes.skin} />

					{overflow && <img src={coloredHats[`${hat}${color}`] || hats[hat]} ref={hatImg} className={classes.hat} />}
				</div>
				{!overflow && <img src={coloredHats[`${hat}${color}`] || hats[hat]} ref={hatImg} className={classes.hat} />}
			</div>
		</>
	);
}

export default Avatar;
