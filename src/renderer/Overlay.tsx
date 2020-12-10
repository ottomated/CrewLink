import React, { useEffect, useMemo, useState } from 'react';
import { ipcRenderer, remote } from 'electron';
import { AmongUsState, GameState, Player } from '../main/GameReader';
import Avatar from './Avatar';

interface OtherTalking {
	[playerId: number]: boolean; // isTalking
}

interface OtherDead {
	[playerId: number]: boolean; // isTalking
}

export default function Overlay() {
	const [status, setStatus] = useState("WAITING");
	const [gameState, setGameState] = useState<AmongUsState>({} as AmongUsState);
	const [talking, setTalking] = useState(false);
	const [otherTalking, setOtherTalking] = useState<OtherTalking>({});
	const myPlayer = useMemo(() => {
			if (!gameState || !gameState.players) return undefined;
			else return gameState.players.find(p => p.isLocal);
		}, [gameState]);
	
	const otherPlayers = useMemo(() => {
		let otherPlayers: Player[];
		if (!gameState || !gameState.players || gameState.lobbyCode === 'MENU' || !myPlayer) otherPlayers = [];
		else otherPlayers = gameState.players.filter(p => !p.isLocal);

		return otherPlayers;
	}, [gameState]);
	
	const talkingPlayers = useMemo(() => {
		let talkingPlayers: Player[];
		if (!gameState || !gameState.players || gameState.lobbyCode === 'MENU' || !myPlayer) talkingPlayers = [];
		else talkingPlayers = gameState.players.filter(p => (otherTalking[p.id] || (p.isLocal && talking)));
		return talkingPlayers;
	}, [gameState]);
	
	const [otherDead, setOtherDead] = useState<OtherDead>({});

	useEffect(() => {
		if (gameState.gameState === GameState.LOBBY) {
			setOtherDead({});
		} else if (gameState.gameState !== GameState.TASKS) {
			if (!gameState.players) return;
			setOtherDead(old => {
				for (let player of gameState.players) {
					old[player.id] = player.isDead || player.disconnected;
				}
				return { ...old };
			});
		}
	}, [gameState.gameState]);
	
	useEffect(() => {			
		const onOverlayState = (_: Electron.IpcRendererEvent, state: string) => {
			setStatus(state);
		};
		
		const onOverlayGameState = (_: Electron.IpcRendererEvent, newState: AmongUsState) => {
			setGameState(newState);
		};
		
		const onOverlayTalkingSelf = (_: Electron.IpcRendererEvent, talking: bool) => {
			setTalking(talking);
		};
		
		const onOverlayTalking = (_: Electron.IpcRendererEvent, id: number) => {
			setOtherTalking(old => ({
				...old,
				[id]: true
			}));		
		};
		
		const onOverlayNotTalking = (_: Electron.IpcRendererEvent, id: number) => {
			setOtherTalking(old => ({
				...old,
				[id]: false
			}));
			
		};

		ipcRenderer.on('overlayState', onOverlayState);
		ipcRenderer.on('overlayGameState', onOverlayGameState);
		ipcRenderer.on('overlayTalkingSelf', onOverlayTalkingSelf);
		ipcRenderer.on('overlayTalking', onOverlayTalking);
		ipcRenderer.on('overlayNotTalking', onOverlayNotTalking);
		return () => {
			ipcRenderer.off('overlayState', onOverlayState);
			ipcRenderer.off('overlayGameState', onOverlayGameState);
			ipcRenderer.off('overlayTalkingSelf', onOverlayTalkingSelf);
			ipcRenderer.off('overlayTalking', onOverlayTalking);
			ipcRenderer.off('overlayNotTalking', onOverlayNotTalking);
		}
	}, []);
	
	var extra:string = "";
	var myPlayerDisplay:string = ""
	if (gameState.gameState == GameState.LOBBY) {
		extra = <p>"State is Lobby."</p>		
	}
	
	if (myPlayer != undefined) {
		var connected = true;
		var deafenedState = false;
		//extra = "(" + myPlayer.name + ") " + extra;
		extra = "";

	}

	document.body.style.backgroundColor = "rgba(255, 255, 255, 0)";
	const mystyle = {
      backgroundColor: "rgba(0, 0, 0, 0.85)",
      margin: "10px",
	  paddingLeft: "8px",
	  width: "100px",
	  borderRadius: "8px"
    };
	
	var topArea = <p><b>CrewLink</b> ({status})</p>
	var playerList = [];
	if (gameState.players) playerList = gameState.players;
	if (gameState.gameState != GameState.MENU &&  gameState.gameState != GameState.LOBBY) {
		topArea = "";
		playerList = talkingPlayers;
	}

	var playerArea = "";
	if (gameState.players) {
			playerArea = <div className="otherplayers-left">
				{
							playerList.map(player => {
								let connected = true;
								return (
									<div style={{width:"100px"}}>
									<Avatar key={player.id} player={player}
										talking={!connected || otherTalking[player.id] || (player.isLocal && talking)}
										borderColor={connected ? '#2ecc71' : '#c0392b'}
										isAlive={!otherDead[player.id]}
										size={50} />
											<span>{player.name}</span>
										</div>
								);
							})
				}
			</div>
	}
		
	
	
	return (
	<div style={mystyle}>
		{topArea}
		{extra}
		<div className="otherplayers-left">
		{playerArea}
		</div>
	</div>
	)
}