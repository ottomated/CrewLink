import React, {
	Dispatch,
	SetStateAction,
	useEffect,
	useReducer,
	useState,
} from 'react';
import ReactDOM from 'react-dom';
import Voice from './Voice';
import Menu from './Menu';
import { ipcRenderer, remote } from 'electron';
import { AmongUsState } from '../common/AmongUsState';
import Settings, {
	settingsReducer,
	lobbySettingsReducer,
} from './settings/Settings';
import {
	GameStateContext,
	SettingsContext,
	LobbySettingsContext,
} from './contexts';
import { ThemeProvider } from '@material-ui/core/styles';
import theme from './theme';
import SettingsIcon from '@material-ui/icons/Settings';
import CloseIcon from '@material-ui/icons/Close';
import IconButton from '@material-ui/core/IconButton';
import makeStyles from '@material-ui/core/styles/makeStyles';

let appVersion = '';
if (typeof window !== 'undefined' && window.location) {
	const query = new URLSearchParams(window.location.search.substring(1));
	appVersion = ' v' + query.get('version') || '';
}

const useStyles = makeStyles(() => ({
	root: {
		position: 'absolute',
		width: '100vw',
		height: theme.spacing(3),
		backgroundColor: '#1d1a23',
		top: 0,
		WebkitAppRegion: 'drag',
	},
	title: {
		width: '100%',
		textAlign: 'center',
		display: 'block',
		height: theme.spacing(3),
		lineHeight: `${theme.spacing(3)}px`,
		color: theme.palette.primary.main,
	},
	button: {
		WebkitAppRegion: 'no-drag',
		marginLeft: 'auto',
		padding: 0,
		position: 'absolute',
		top: 0,
	},
}));

interface TitleBarProps {
	settingsOpen: boolean;
	setSettingsOpen: Dispatch<SetStateAction<boolean>>;
}

const TitleBar: React.FC<TitleBarProps> = function ({
	settingsOpen,
	setSettingsOpen,
}: TitleBarProps) {
	const classes = useStyles();
	return (
		<div className={classes.root}>
			<span className={classes.title}>CrewLink{appVersion}</span>
			<IconButton
				className={classes.button}
				style={{ left: 0 }}
				size="small"
				onClick={() => setSettingsOpen(!settingsOpen)}
			>
				<SettingsIcon htmlColor="#777" />
			</IconButton>
			<IconButton
				className={classes.button}
				style={{ right: 0 }}
				size="small"
				onClick={() => remote.getCurrentWindow().close()}
			>
				<CloseIcon htmlColor="#777" />
			</IconButton>
		</div>
	);
};

enum AppState {
	MENU,
	VOICE,
}

function App() {
	const [state, setState] = useState<AppState>(AppState.MENU);
	const [gameState, setGameState] = useState<AmongUsState>({} as AmongUsState);
	const [settingsOpen, setSettingsOpen] = useState(false);
	const [error, setError] = useState('');
	const settings = useReducer(settingsReducer, {
		alwaysOnTop: false,
		microphone: 'Default',
		speaker: 'Default',
		pushToTalk: false,
		serverURL: 'https://crewl.ink',
		pushToTalkShortcut: 'V',
		deafenShortcut: 'RControl',
		muteShortcut: 'RAlt',
		hideCode: false,
		enableSpatialAudio: true,
		localLobbySettings: {
			maxDistance: 5.32,
		},
	});
	const lobbySettings = useReducer(
		lobbySettingsReducer,
		settings[0].localLobbySettings
	);

	useEffect(() => {
		const onOpen = (_: Electron.IpcRendererEvent, isOpen: boolean) => {
			setState(isOpen ? AppState.VOICE : AppState.MENU);
		};
		const onState = (_: Electron.IpcRendererEvent, newState: AmongUsState) => {
			setGameState(newState);
		};
		let shouldInit = true;
		const onError = (_: Electron.IpcRendererEvent, error: string) => {
			shouldInit = false;
			setError(error);
		};
		ipcRenderer.on('gameOpen', onOpen);
		ipcRenderer.on('error', onError);
		ipcRenderer.on('gameState', onState);
		ipcRenderer.once('started', () => {
			if (shouldInit) setGameState(ipcRenderer.sendSync('initState'));
		});
		return () => {
			ipcRenderer.off('gameOpen', onOpen);
			ipcRenderer.off('error', onError);
			ipcRenderer.off('gameState', onState);
		};
	}, []);

	let page;
	switch (state) {
		case AppState.MENU:
			page = <Menu error={error} />;
			break;
		case AppState.VOICE:
			page = <Voice error={error} />;
			break;
	}
	return (
		<GameStateContext.Provider value={gameState}>
			<LobbySettingsContext.Provider value={lobbySettings}>
				<SettingsContext.Provider value={settings}>
					<ThemeProvider theme={theme}>
						<TitleBar
							settingsOpen={settingsOpen}
							setSettingsOpen={setSettingsOpen}
						/>
						<Settings
							open={settingsOpen}
							onClose={() => setSettingsOpen(false)}
						/>
						{page}
					</ThemeProvider>
				</SettingsContext.Provider>
			</LobbySettingsContext.Provider>
		</GameStateContext.Provider>
	);
}

ReactDOM.render(<App />, document.getElementById('app'));
