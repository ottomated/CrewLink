import React, { useRef } from 'react';
import { Player } from '../common/AmongUsState';
import { backLayerHats, hatOffsets, hats, skins, players } from './cosmetics';
import makeStyles from '@material-ui/core/styles/makeStyles';
import MicOff from '@material-ui/icons/MicOff';
import VolumeOff from '@material-ui/icons/VolumeOff';
import WifiOff from '@material-ui/icons/WifiOff';
import LinkOff from '@material-ui/icons/LinkOff';
import Tooltip from '@material-ui/core/Tooltip';

interface UseStylesParams {
	size: number;
	borderColor: string;
}
const useStyles = makeStyles(() => ({
	avatar: {
		borderRadius: '50%',
		overflow: 'hidden',
		position: 'relative',
		borderStyle: 'solid',
		transition: 'border-color .2s ease-out',
		borderColor: ({ borderColor }: UseStylesParams) => borderColor,
		borderWidth: ({ size }: UseStylesParams) => Math.max(2, size / 40),
		width: '100%',
		paddingBottom: '100%',
	},
	canvas: {
		position: 'absolute',
		width: '100%',
	},
	icon: {
		background: '#ea3c2a',
		position: 'absolute',
		left: '50%',
		top: '50%',
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
	style?: React.CSSProperties;
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
	style,
}: AvatarProps) {
	const status = isAlive ? 'alive' : 'dead';
	let image = players[status][player.colorId];
	if (!image) image = players[status][0];
	const classes = useStyles({
		borderColor: talking ? borderColor : 'transparent',
		size,
	});

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
			icon = (
				<LinkOff
					className={classes.icon}
					style={{ background: '#e67e22', borderColor: '#694900' }}
				/>
			);
			break;
		case 'disconnected':
			icon = <WifiOff className={classes.icon} />;
			break;
	}

	return (
		<Tooltip title={player.name} arrow placement="top">
			<div className={classes.avatar} style={style}>
				<Canvas
					className={classes.canvas}
					src={image}
					hat={player.hatId - 1}
					skin={player.skinId - 1}
					isAlive={isAlive}
				/>
				{icon}
			</div>
		</Tooltip>
	);
};

interface UseCanvasStylesParams {
	backLayerHat: boolean;
	isAlive: boolean;
}
const useCanvasStyles = makeStyles(() => ({
	base: {
		width: '100%',
		position: 'absolute',
		top: 0,
		left: 0,
		zIndex: 2,
	},
	hat: {
		position: 'absolute',
		left: '50%',
		transform: 'translateX(calc(-50% + 4px)) scale(0.7)',
		zIndex: ({ backLayerHat }: UseCanvasStylesParams) => (backLayerHat ? 1 : 4),
		display: ({ isAlive }: UseCanvasStylesParams) =>
			isAlive ? 'block' : 'none',
	},
	skin: {
		position: 'absolute',
		top: '38%',
		left: '17%',
		width: '73.5%',
		transform: 'scale(0.8)',
		zIndex: 3,
		display: ({ isAlive }: UseCanvasStylesParams) =>
			isAlive ? 'block' : 'none',
	},
}));

function Canvas({ src, hat, skin, isAlive }: CanvasProps) {
	const hatImg = useRef<HTMLImageElement>(null);
	const skinImg = useRef<HTMLImageElement>(null);
	const image = useRef<HTMLImageElement>(null);
	const hatY = 11 - hatOffsets[hat];
	const classes = useCanvasStyles({
		backLayerHat: backLayerHats.has(hat),
		isAlive,
	});

	return (
		<>
			<img src={src} ref={image} className={classes.base} />
			<img
				src={hats[hat]}
				ref={hatImg}
				className={classes.hat}
				style={{ top: `${hatY}%` }}
			/>
			<img src={skins[skin]} ref={skinImg} className={classes.skin} />
		</>
	);
}

export default Avatar;
