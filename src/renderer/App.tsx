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
import { ipcRenderer } from 'electron';
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
import {
	AutoUpdaterState,
	IpcHandlerMessages,
	IpcMessages,
	IpcRendererMessages,
	IpcSyncMessages,
} from '../common/ipc-messages';
import theme from './theme';
import SettingsIcon from '@material-ui/icons/Settings';
import CloseIcon from '@material-ui/icons/Close';
import IconButton from '@material-ui/core/IconButton';
import Dialog from '@material-ui/core/Dialog';
import makeStyles from '@material-ui/core/styles/makeStyles';
import LinearProgress from '@material-ui/core/LinearProgress';
import DialogTitle from '@material-ui/core/DialogTitle';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';
import DialogActions from '@material-ui/core/DialogActions';
import Button from '@material-ui/core/Button';
import prettyBytes from 'pretty-bytes';

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
				onClick={() => ipcRenderer.send(IpcMessages.QUIT_CREWLINK)}
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
	const [updaterState, setUpdaterState] = useState<AutoUpdaterState>({
		state: 'unavailable',
	});
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
		const onError = (_: Electron.IpcRendererEvent, error: string) => {
			shouldInit = false;
			setError(error);
		};
		const onAutoUpdaterStateChange = (
			_: Electron.IpcRendererEvent,
			state: AutoUpdaterState
		) => {
			setUpdaterState((old) => ({ ...old, ...state }));
		};
		let shouldInit = true;
		ipcRenderer
			.invoke(IpcHandlerMessages.START_HOOK)
			.then(() => {
				if (shouldInit) {
					setGameState(ipcRenderer.sendSync(IpcSyncMessages.GET_INITIAL_STATE));
				}
			})
			.catch((error: Error) => {
				if (shouldInit) {
					shouldInit = false;
					setError(error.message);
				}
			});
		ipcRenderer.on(
			IpcRendererMessages.AUTO_UPDATER_STATE,
			onAutoUpdaterStateChange
		);
		ipcRenderer.on(IpcRendererMessages.NOTIFY_GAME_OPENED, onOpen);
		ipcRenderer.on(IpcRendererMessages.NOTIFY_GAME_STATE_CHANGED, onState);
		ipcRenderer.on(IpcRendererMessages.ERROR, onError);
		return () => {
			ipcRenderer.off(
				IpcRendererMessages.AUTO_UPDATER_STATE,
				onAutoUpdaterStateChange
			);
			ipcRenderer.off(IpcRendererMessages.NOTIFY_GAME_OPENED, onOpen);
			ipcRenderer.off(IpcRendererMessages.NOTIFY_GAME_STATE_CHANGED, onState);
			ipcRenderer.off(IpcRendererMessages.ERROR, onError);
			shouldInit = false;
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
						<Dialog fullWidth open={updaterState.state !== 'unavailable'}>
							<DialogTitle>Updating...</DialogTitle>
							<DialogContent>
								{(updaterState.state === 'downloading' ||
									updaterState.state === 'downloaded') &&
									updaterState.progress && (
										<>
											<LinearProgress
												variant={
													updaterState.state === 'downloaded'
														? 'indeterminate'
														: 'determinate'
												}
												value={updaterState.progress.percent}
											/>
											<DialogContentText>
												{prettyBytes(updaterState.progress.transferred)} /{' '}
												{prettyBytes(updaterState.progress.total)}
											</DialogContentText>
										</>
									)}
								{updaterState.state === 'error' && (
									<DialogContentText color="error">
										{updaterState.error}
									</DialogContentText>
								)}
							</DialogContent>
							{updaterState.state === 'error' && (
								<DialogActions>
									<Button href="https://github.com/ottomated/CrewLink/releases/latest">
										Download Manually
									</Button>
								</DialogActions>
							)}
						</Dialog>
						{page}
					</ThemeProvider>
				</SettingsContext.Provider>
			</LobbySettingsContext.Provider>
		</GameStateContext.Provider>
	);
}

ReactDOM.render(<App />, document.getElementById('app'));
