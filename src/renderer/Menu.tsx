import React from 'react';
import { ipcRenderer } from 'electron';
import Footer from './Footer';
import { IpcMessages } from '../common/ipc-messages';
import makeStyles from '@material-ui/core/styles/makeStyles';
import CircularProgress from '@material-ui/core/CircularProgress';
import Typography from '@material-ui/core/Typography';
import SupportLink from './SupportLink';

const useStyles = makeStyles((theme) => ({
	root: {
		width: '100vw',
		height: '100vh',
		paddingTop: theme.spacing(3),
	},
	error: {
		paddingTop: theme.spacing(4),
	},
	menu: {
		display: 'flex',
		flexDirection: 'column',
		alignItems: 'center',
		justifyContent: 'start',
	},
	waiting: {
		fontSize: 20,
		marginTop: 12,
		marginBottom: 12,
	},
	button: {
		color: 'white',
		background: 'none',
		padding: '2px 10px',
		borderRadius: 10,
		border: '4px solid white',
		fontSize: 24,
		outline: 'none',
		fontWeight: 500,
		fontFamily: '"Varela", sans-serif',
		marginTop: 24,
		'&:hover': {
			borderColor: '#00ff00',
			cursor: 'pointer',
		},
	},
}));

export interface MenuProps {
	error: string;
}

const Menu: React.FC<MenuProps> = function ({ error }: MenuProps) {
	const classes = useStyles();
	return (
		<div className={classes.root}>
			<div className={classes.menu}>
				{error ? (
					<div className={classes.error}>
						<Typography align="center" variant="h6" color="error">
							ERROR
						</Typography>
						<Typography align="center" style={{ whiteSpace: 'pre-wrap' }}>
							{error}
						</Typography>
						<SupportLink />
					</div>
				) : (
					<>
						<span className={classes.waiting}>Waiting for Among Us</span>
						<CircularProgress color="primary" size={40} />
						<button
							className={classes.button}
							onClick={() => {
								ipcRenderer.send(IpcMessages.OPEN_AMONG_US_GAME);
							}}
						>
							Open Game
						</button>
					</>
				)}
				<Footer />
			</div>
		</div>
	);
};

export default Menu;
