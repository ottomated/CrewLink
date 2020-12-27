import Store from 'electron-store';
import React, {
	ReactChild,
	useContext,
	useEffect,
	useReducer,
	useState,
} from 'react';
import {
	SettingsContext,
	LobbySettingsContext,
	GameStateContext,
} from '../contexts';
import MicrophoneSoundBar from './MicrophoneSoundBar';
import TestSpeakersButton from './TestSpeakersButton';
import { ISettings, ILobbySettings } from '../../common/ISettings';
import TextField from '@material-ui/core/TextField';
import makeStyles from '@material-ui/core/styles/makeStyles';
import withStyles from '@material-ui/core/styles/withStyles';
import Box from '@material-ui/core/Box';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Radio from '@material-ui/core/Radio';
import Checkbox from '@material-ui/core/Checkbox';
import RadioGroup from '@material-ui/core/RadioGroup';
import MuiDivider from '@material-ui/core/Divider';
import Typography from '@material-ui/core/Typography';
import Grid from '@material-ui/core/Grid';
import { isHttpUri, isHttpsUri } from 'valid-url';
import ChevronLeft from '@material-ui/icons/ArrowBack';
import IconButton from '@material-ui/core/IconButton';
import Alert from '@material-ui/lab/Alert';
import Slider from '@material-ui/core/Slider';
import Tooltip from '@material-ui/core/Tooltip';
import Dialog from '@material-ui/core/Dialog';
import DialogTitle from '@material-ui/core/DialogTitle';
import DialogContent from '@material-ui/core/DialogContent';
import DialogActions from '@material-ui/core/DialogActions';
import { GameState } from '../../common/AmongUsState';
import Button from '@material-ui/core/Button';

interface StyleInput {
	open: boolean;
}

const Divider = withStyles((theme) => ({
	root: {
		width: '100%',
		marginTop: theme.spacing(2),
		marginBottom: theme.spacing(2),
	},
}))(MuiDivider);

const useStyles = makeStyles((theme) => ({
	root: {
		width: '100vw',
		height: `calc(100vh - ${theme.spacing(3)}px)`,
		background: '#171717ad',
		backdropFilter: 'blur(4px)',
		position: 'absolute',
		left: 0,
		top: 0,
		zIndex: 99,
		alignItems: 'center',
		marginTop: theme.spacing(3),
		transition: 'transform .1s ease-in-out',
		WebkitAppRegion: 'no-drag',
		transform: ({ open }: StyleInput) =>
			open ? 'translateX(0)' : 'translateX(-100%)',
	},
	header: {
		display: 'flex',
		justifyContent: 'center',
		alignItems: 'center',
		height: 40,
	},
	scroll: {
		paddingTop: theme.spacing(3),
		paddingLeft: theme.spacing(2),
		paddingRight: theme.spacing(2),
		overflowY: 'auto',
		display: 'flex',
		flexDirection: 'column',
		justifyContent: 'start',
		alignItems: 'center',
		paddingBottom: theme.spacing(7),
		height: `calc(100vh - 40px - ${theme.spacing(7 + 3 + 3)}px)`,
	},
	shortcutField: {
		marginTop: theme.spacing(1),
	},
	back: {
		cursor: 'pointer',
		position: 'absolute',
		right: theme.spacing(1),
		WebkitAppRegion: 'no-drag',
	},
	alert: {
		position: 'absolute',
		bottom: theme.spacing(1),
		zIndex: 10,
	},
	urlDialog: {
		display: 'flex',
		flexDirection: 'column',
		alignItems: 'center',
		justifyContent: 'start',
		'&>*': {
			marginBottom: theme.spacing(1),
		},
	},
}));

const keys = new Set([
	'Space',
	'Backspace',
	'Delete',
	'Enter',
	'Up',
	'Down',
	'Left',
	'Right',
	'Home',
	'End',
	'PageUp',
	'PageDown',
	'Escape',
	'LControl',
	'LShift',
	'LAlt',
	'RControl',
	'RShift',
	'RAlt',
]);

const store = new Store<ISettings>({
	migrations: {
		'1.1.3': (store) => {
			const serverIP = store.get('serverIP');
			if (typeof serverIP === 'string') {
				const serverURL = `http://${serverIP}`;
				if (validateServerUrl(serverURL)) {
					store.set('serverURL', serverURL);
				} else {
					console.warn(
						'Error while parsing the old serverIP property. Default URL will be used instead.'
					);
				}

				// @ts-ignore: Old serverIP property no longer exists in ISettings
				store.delete('serverIP');
			}
		},
		'1.1.5': (store) => {
			const serverURL = store.get('serverURL');
			if (serverURL === 'http://54.193.94.35:9736') {
				store.set('serverURL', 'https://crewl.ink');
			}
		},
		'1.1.6': (store) => {
			const enableSpatialAudio = store.get('stereoInLobby');
			if (typeof enableSpatialAudio === 'boolean') {
				store.set('enableSpatialAudio', enableSpatialAudio);
			}
			// @ts-ignore
			store.delete('stereoInLobby');
		},
		'1.2.0': (store) => {
			if (store.get('serverURL') !== 'https://crewl.ink') {
				store.set('serverURL', 'https://crewl.ink');
			}
			// @ts-ignore
			store.delete('offsets');
		},
	},
	schema: {
		alwaysOnTop: {
			type: 'boolean',
			default: false,
		},
		microphone: {
			type: 'string',
			default: 'Default',
		},
		speaker: {
			type: 'string',
			default: 'Default',
		},
		pushToTalk: {
			type: 'boolean',
			default: false,
		},
		serverURL: {
			type: 'string',
			default: 'https://crewl.ink',
			format: 'uri',
		},
		pushToTalkShortcut: {
			type: 'string',
			default: 'V',
		},
		deafenShortcut: {
			type: 'string',
			default: 'RControl',
		},
		muteShortcut: {
			type: 'string',
			default: 'RAlt',
		},
		hideCode: {
			type: 'boolean',
			default: false,
		},
		enableSpatialAudio: {
			type: 'boolean',
			default: true,
		},
		localLobbySettings: {
			type: 'object',
			properties: {
				maxDistance: {
					type: 'number',
					default: 5.32,
				},
			},
			default: {
				maxDistance: 5.32,
			},
		},
	},
});

export interface SettingsProps {
	open: boolean;
	onClose: () => void;
}

export const settingsReducer = (
	state: ISettings,
	action: {
		type: 'set' | 'setOne' | 'setLobbySetting';
		action: [string, unknown] | ISettings;
	}
): ISettings => {
	if (action.type === 'set') {
		return action.action as ISettings;
	}
	const v = action.action as [string, unknown];
	if (action.type === 'setLobbySetting') {
		const lobbySettings = {
			...state.localLobbySettings,
			[v[0]]: v[1],
		};
		v[0] = 'localLobbySettings';
		v[1] = lobbySettings;
	}
	store.set(v[0], v[1]);
	return {
		...state,
		[v[0]]: v[1],
	};
};

export const lobbySettingsReducer = (
	state: ILobbySettings,
	action: {
		type: 'set' | 'setOne';
		action: [string, unknown] | ILobbySettings;
	}
): ILobbySettings => {
	if (action.type === 'set') return action.action as ILobbySettings;
	const v = action.action as [string, unknown];
	return {
		...state,
		[v[0]]: v[1],
	};
};

interface MediaDevice {
	id: string;
	kind: MediaDeviceKind;
	label: string;
}

function validateServerUrl(uri: string): boolean {
	try {
		if (!isHttpUri(uri) && !isHttpsUri(uri)) return false;
		const url = new URL(uri);
		if (url.hostname === 'discord.gg') return false;
		if (url.pathname !== '/') return false;
		return true;
	} catch (_) {
		return false;
	}
}

type URLInputProps = {
	initialURL: string;
	onValidURL: (url: string) => void;
	className: string;
};

const URLInput: React.FC<URLInputProps> = function ({
	initialURL,
	onValidURL,
	className,
}: URLInputProps) {
	const [isValidURL, setURLValid] = useState(true);
	const [currentURL, setCurrentURL] = useState(initialURL);
	const [open, setOpen] = useState(false);

	useEffect(() => {
		setCurrentURL(initialURL);
	}, [initialURL]);

	function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
		const url = event.target.value.trim();
		setCurrentURL(url);
		if (validateServerUrl(url)) {
			setURLValid(true);
		} else {
			setURLValid(false);
		}
	}

	return (
		<>
			<Button
				variant="contained"
				color="secondary"
				onClick={() => setOpen(true)}
			>
				Change Voice Server
			</Button>
			<Dialog fullScreen open={open} onClose={() => setOpen(false)}>
				<DialogTitle>Change Voice Server</DialogTitle>
				<DialogContent className={className}>
					<TextField
						fullWidth
						error={!isValidURL}
						spellCheck={false}
						label="Voice Server"
						value={currentURL}
						onChange={handleChange}
						variant="outlined"
						color="primary"
						helperText={isValidURL ? '' : 'Invalid URL'}
					/>
					<Alert severity="error">
						This option is for advanced users only. Other servers can steal your
						info or crash CrewLink.
					</Alert>
					<Button
						color="primary"
						variant="contained"
						onClick={() => {
							setOpen(false);
							setURLValid(true);
							onValidURL('https://crewl.ink');
						}}
					>
						Reset to default
					</Button>
				</DialogContent>
				<DialogActions>
					<Button
						color="primary"
						onClick={() => {
							setURLValid(true);
							setOpen(false);
							setCurrentURL(initialURL);
						}}
					>
						Cancel
					</Button>
					<Button
						disabled={!isValidURL}
						color="primary"
						onClick={() => {
							setOpen(false);
							let url = currentURL;
							if (url.endsWith('/')) url = url.substring(0, url.length - 1);
							onValidURL(url);
						}}
					>
						Confirm
					</Button>
				</DialogActions>
			</Dialog>
		</>
	);
};

interface DisabledTooltipProps {
	disabled: boolean;
	title: string;
	children: ReactChild;
}

const DisabledTooltip: React.FC<DisabledTooltipProps> = function ({
	disabled,
	children,
	title,
}: DisabledTooltipProps) {
	if (disabled)
		return (
			<Tooltip placement="top" arrow title={title}>
				<span>{children}</span>
			</Tooltip>
		);
	else return <>{children}</>;
};

const Settings: React.FC<SettingsProps> = function ({
	open,
	onClose,
}: SettingsProps) {
	const classes = useStyles({ open });
	const [settings, setSettings] = useContext(SettingsContext);
	const gameState = useContext(GameStateContext);
	const [lobbySettings, setLobbySettings] = useContext(LobbySettingsContext);
	const [unsavedCount, setUnsavedCount] = useState(0);
	const unsaved = unsavedCount > 2;
	useEffect(() => {
		setSettings({
			type: 'set',
			action: store.store,
		});
		setLobbySettings({
			type: 'set',
			action: store.get('localLobbySettings'),
		});
	}, []);

	useEffect(() => {
		setUnsavedCount((s) => s + 1);
	}, [
		settings.microphone,
		settings.speaker,
		settings.serverURL,
		settings.enableSpatialAudio,
	]);

	const [devices, setDevices] = useState<MediaDevice[]>([]);
	const [_, updateDevices] = useReducer((state) => state + 1, 0);
	useEffect(() => {
		navigator.mediaDevices.enumerateDevices().then((devices) =>
			setDevices(
				devices.map((d) => {
					let label = d.label;
					if (d.deviceId === 'default') {
						label = 'Default';
					} else {
						const match = /(.+?)\)/.exec(d.label);
						if (match && match[1]) label = match[1] + ')';
					}
					return {
						id: d.deviceId,
						kind: d.kind,
						label,
					};
				})
			)
		);
	}, [_]);

	const setShortcut = (ev: React.KeyboardEvent, shortcut: string) => {
		let k = ev.key;
		if (k.length === 1) k = k.toUpperCase();
		else if (k.startsWith('Arrow')) k = k.substring(5);
		if (k === ' ') k = 'Space';

		if (k === 'Control' || k === 'Alt' || k === 'Shift')
			k = (ev.location === 1 ? 'L' : 'R') + k;

		if (/^[0-9A-Z]$/.test(k) || /^F[0-9]{1, 2}$/.test(k) || keys.has(k)) {
			setSettings({
				type: 'setOne',
				action: [shortcut, k],
			});
		}
	};

	const setMouseShortcut = (
		ev: React.MouseEvent<HTMLDivElement>,
		shortcut: string
	) => {
		if (ev.button > 2) {
			// this makes our button start at 1 instead of 0
			// React Mouse event starts at 0, but IOHooks starts at 1
			const k = `MouseButton${ev.button + 1}`;
			setSettings({
				type: 'setOne',
				action: [shortcut, k],
			});
		}
	};

	const microphones = devices.filter((d) => d.kind === 'audioinput');
	const speakers = devices.filter((d) => d.kind === 'audiooutput');
	const [localDistance, setLocalDistance] = useState(
		settings.localLobbySettings.maxDistance
	);
	useEffect(() => {
		setLocalDistance(settings.localLobbySettings.maxDistance);
	}, [settings.localLobbySettings.maxDistance]);

	const isInMenuOrLobby =
		gameState?.gameState === GameState.LOBBY ||
		gameState?.gameState === GameState.MENU;
	const canChangeLobbySettings =
		gameState?.gameState === GameState.MENU ||
		(gameState?.isHost && gameState?.gameState === GameState.LOBBY);

	return (
		<Box className={classes.root}>
			<div className={classes.header}>
				<IconButton
					className={classes.back}
					size="small"
					onClick={() => {
						setSettings({
							type: 'setOne',
							action: ['localLobbySettings', lobbySettings],
						});
						if (unsaved) {
							onClose();
							location.reload();
						} else onClose();
					}}
				>
					<ChevronLeft htmlColor="#777" />
				</IconButton>
				<Typography variant="h6">Settings</Typography>
			</div>
			<div className={classes.scroll}>
				{/* Lobby Settings */}
				<div>
					<Typography variant="h6">Lobby Settings</Typography>
					<Typography gutterBottom>
						Voice Distance:{' '}
						{canChangeLobbySettings ? localDistance : lobbySettings.maxDistance}
					</Typography>
					<DisabledTooltip
						disabled={!canChangeLobbySettings}
						title={
							isInMenuOrLobby
								? 'Only the game host can change this!'
								: 'You can only change this in the lobby!'
						}
					>
						<Slider
							disabled={!canChangeLobbySettings}
							value={
								canChangeLobbySettings
									? localDistance
									: lobbySettings.maxDistance
							}
							min={1}
							max={10}
							step={0.1}
							onChange={(_, newValue: number | number[]) => {
								setLocalDistance(newValue as number);
							}}
							onChangeCommitted={(_, newValue: number | number[]) => {
								setSettings({
									type: 'setLobbySetting',
									action: ['maxDistance', newValue as number],
								});
								if (gameState?.isHost) {
									setLobbySettings({
										type: 'setOne',
										action: ['maxDistance', newValue as number],
									});
								}
							}}
						/>
					</DisabledTooltip>
				</div>
				<Divider />
				<Typography variant="h6">Audio</Typography>
				<TextField
					select
					label="Microphone"
					variant="outlined"
					color="secondary"
					value={settings.microphone}
					className={classes.shortcutField}
					SelectProps={{ native: true }}
					InputLabelProps={{ shrink: true }}
					onChange={(ev) => {
						setSettings({
							type: 'setOne',
							action: ['microphone', ev.target.value],
						});
					}}
					onClick={updateDevices}
				>
					{microphones.map((d) => (
						<option key={d.id} value={d.id}>
							{d.label}
						</option>
					))}
				</TextField>
				{open && <MicrophoneSoundBar microphone={settings.microphone} />}
				<TextField
					select
					label="Speaker"
					variant="outlined"
					color="secondary"
					value={settings.speaker}
					className={classes.shortcutField}
					SelectProps={{ native: true }}
					InputLabelProps={{ shrink: true }}
					onChange={(ev) => {
						setSettings({
							type: 'setOne',
							action: ['speaker', ev.target.value],
						});
					}}
					onClick={updateDevices}
				>
					{speakers.map((d) => (
						<option key={d.id} value={d.id}>
							{d.label}
						</option>
					))}
				</TextField>
				{open && <TestSpeakersButton speaker={settings.speaker} />}
				<RadioGroup
					value={settings.pushToTalk}
					onChange={(ev) => {
						setSettings({
							type: 'setOne',
							action: ['pushToTalk', ev.target.value === 'true'],
						});
					}}
				>
					<FormControlLabel
						label="Voice Activity"
						value={false}
						control={<Radio />}
					/>
					<FormControlLabel
						label="Push To Talk"
						value={true}
						control={<Radio />}
					/>
				</RadioGroup>
				<Divider />
				<Typography variant="h6">Keyboard Shortcuts</Typography>
				<Grid container spacing={1}>
					<Grid item xs={12}>
						<TextField
							fullWidth
							spellCheck={false}
							color="secondary"
							label="Push To Talk"
							value={settings.pushToTalkShortcut}
							className={classes.shortcutField}
							variant="outlined"
							onKeyDown={(ev) => {
								setShortcut(ev, 'pushToTalkShortcut');
							}}
							onMouseDown={(ev) => {
								setMouseShortcut(ev, 'pushToTalkShortcut');
							}}
						/>
					</Grid>
					<Grid item xs={6}>
						<TextField
							spellCheck={false}
							color="secondary"
							label="Mute"
							value={settings.muteShortcut}
							className={classes.shortcutField}
							variant="outlined"
							onKeyDown={(ev) => {
								setShortcut(ev, 'muteShortcut');
							}}
							onMouseDown={(ev) => {
								setMouseShortcut(ev, 'muteShortcut');
							}}
						/>
					</Grid>
					<Grid item xs={6}>
						<TextField
							spellCheck={false}
							color="secondary"
							label="Deafen"
							value={settings.deafenShortcut}
							className={classes.shortcutField}
							variant="outlined"
							onKeyDown={(ev) => {
								setShortcut(ev, 'deafenShortcut');
							}}
							onMouseDown={(ev) => {
								setMouseShortcut(ev, 'deafenShortcut');
							}}
						/>
					</Grid>
				</Grid>
				<Divider />
				<Typography variant="h6">Advanced</Typography>
				<FormControlLabel
					label="Show Lobby Code"
					checked={!settings.hideCode}
					onChange={(_, checked: boolean) => {
						setSettings({
							type: 'setOne',
							action: ['hideCode', !checked],
						});
					}}
					control={<Checkbox />}
				/>
				<FormControlLabel
					label="Enable Spatial Audio"
					checked={settings.enableSpatialAudio}
					onChange={(_, checked: boolean) => {
						setSettings({
							type: 'setOne',
							action: ['enableSpatialAudio', checked],
						});
					}}
					control={<Checkbox />}
				/>
				<URLInput
					initialURL={settings.serverURL}
					onValidURL={(url: string) => {
						setSettings({
							type: 'setOne',
							action: ['serverURL', url],
						});
					}}
					className={classes.urlDialog}
				/>
				<Alert
					className={classes.alert}
					severity="info"
					style={{ display: unsaved ? undefined : 'none' }}
				>
					Exit Settings to apply changes
				</Alert>
			</div>
		</Box>
	);
};

export default Settings;
