import React, { useEffect, useMemo, useState } from 'react';
import { ipcRenderer } from 'electron';
import { GameState, AmongUsState, Player } from '../common/AmongUsState';
import Avatar from './Avatar';
import { ISettings } from '../common/ISettings';

interface OtherTalking {
	[playerId: number]: boolean;
}

interface OtherDead {
	[playerId: number]: boolean;
}

interface Client {
	playerId: number;
	clientId: number;
}

interface SocketClientMap {
	[socketId: string]: Client;
}

export default function Overlay(): JSX.Element {
	const [status, setStatus] = useState('WAITING');
	const [gameState, setGameState] = useState<AmongUsState>({} as AmongUsState);
	const [settings, setSettings] = useState<ISettings>({} as ISettings);
	const [socketPlayerIds, setSocketPlayerIds] = useState<SocketClientMap>({});
	const [talking, setTalking] = useState(false);
	const [otherTalking, setOtherTalking] = useState<OtherTalking>({});
	const [otherDead, setOtherDead] = useState<OtherDead>({});
	const myPlayer = useMemo(() => {
		if (!gameState || !gameState.players) return undefined;
		else return gameState.players.find((p) => p.isLocal);
	}, [gameState]);

	const relevantPlayers = useMemo(() => {
		let relevantPlayers: Player[];
		if (
			!gameState ||
			!gameState.players ||
			gameState.lobbyCode === 'MENU' ||
			!myPlayer
		)
			relevantPlayers = [];
		else
			relevantPlayers = gameState.players.filter(
				(p) =>
					(Object.values(socketPlayerIds).some((o) => o.playerId === p.id) ||
						p.isLocal) &&
					((!myPlayer.isDead && !otherDead[p.id]) || myPlayer.isDead)
			);
		return relevantPlayers;
	}, [gameState]);

	let talkingPlayers: Player[];
	if (
		!gameState ||
		!gameState.players ||
		gameState.lobbyCode === 'MENU' ||
		!myPlayer
	)
		talkingPlayers = [];
	else
		talkingPlayers = gameState.players.filter(
			(p) => otherTalking[p.id] || (p.isLocal && talking)
		);

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

	useEffect(() => {
		const onOverlaySettings = (
			_: Electron.IpcRendererEvent,
			newSettings: ISettings
		) => {
			setSettings(newSettings);
		};

		const onOverlayState = (_: Electron.IpcRendererEvent, state: string) => {
			setStatus(state);
		};

		const onOverlayGameState = (
			_: Electron.IpcRendererEvent,
			newState: AmongUsState
		) => {
			setGameState(newState);
		};

		const onOverlaySocketIds = (
			_: Electron.IpcRendererEvent,
			ids: SocketClientMap
		) => {
			setSocketPlayerIds(ids);
		};

		const onOverlayTalkingSelf = (
			_: Electron.IpcRendererEvent,
			talking: boolean
		) => {
			setTalking(talking);
		};

		const onOverlayTalking = (_: Electron.IpcRendererEvent, id: number) => {
			setOtherTalking((old) => ({
				...old,
				[id]: true,
			}));
		};

		const onOverlayNotTalking = (_: Electron.IpcRendererEvent, id: number) => {
			setOtherTalking((old) => ({
				...old,
				[id]: false,
			}));
		};

		ipcRenderer.on('overlaySettings', onOverlaySettings);
		ipcRenderer.on('overlayState', onOverlayState);
		ipcRenderer.on('overlayGameState', onOverlayGameState);
		ipcRenderer.on('overlaySocketIds', onOverlaySocketIds);
		ipcRenderer.on('overlayTalkingSelf', onOverlayTalkingSelf);
		ipcRenderer.on('overlayTalking', onOverlayTalking);
		ipcRenderer.on('overlayNotTalking', onOverlayNotTalking);
		return () => {
			ipcRenderer.off('overlaySettings', onOverlaySettings);
			ipcRenderer.off('overlayState', onOverlayState);
			ipcRenderer.off('overlayGameState', onOverlayGameState);
			ipcRenderer.off('overlaySocketIds', onOverlaySocketIds);
			ipcRenderer.off('overlayTalkingSelf', onOverlayTalkingSelf);
			ipcRenderer.off('overlayTalking', onOverlayTalking);
			ipcRenderer.off('overlayNotTalking', onOverlayNotTalking);
		};
	}, []);
	document.body.style.backgroundColor = 'rgba(255, 255, 255, 0)';
	document.body.style.paddingTop = '0';

	let topArea = (
		<p>
			<b style={{ color: '#9b59b6' }}>CrewLink</b> ({status})
		</p>
	);

	let playerList: Player[] = [];
	if (gameState.players && gameState.gameState != GameState.MENU)
		playerList = relevantPlayers;
	const classnames: string[] = ['overlay-wrapper'];
	if (
		gameState.gameState == GameState.UNKNOWN ||
		gameState.gameState == GameState.MENU
	) {
		classnames.push('gamestate_menu');
	} else {
		classnames.push('gamestate_game');
		classnames.push('overlay_postion_' + settings.overlayPosition);

		topArea = <></>;
		if (settings.compactOverlay && playerList) {
			playerList = talkingPlayers;
			classnames.push('compactoverlay');
		}
	}

	const isOnSide =
		settings.overlayPosition == 'right' || settings.overlayPosition == 'left';
	let playerArea: JSX.Element = <></>;

	if (playerList) {
		playerArea = (
			<div className="otherplayers">
				{playerList.map((player) => {
					const connected =
						Object.values(socketPlayerIds).some(
							(o) => o.playerId === player.id
						) || player.isLocal;
					const name = settings.compactOverlay ? (
						''
					) : (
						<span className="playername">
							<small>{player.name}</small>
						</span>
					);
					return (
						<div key={player.id} className="player_wrapper">
							<div>
								<Avatar
									key={player.id}
									player={player}
									talking={
										!connected ||
										otherTalking[player.id] ||
										(player.isLocal && talking)
									}
									showborder={isOnSide}
									borderColor={connected ? '#2ecc71' : '#c0392b'}
									isAlive={
										(!player.isLocal && !otherDead[player.id]) ||
										(player.isLocal && !player.isDead)
									}
									size={50}
								/>
							</div>
							{name}
						</div>
					);
				})}
			</div>
		);
	}

	return (
		<div className={classnames.join(' ')}>
			{topArea}
			{playerArea}
		</div>
	);
}
