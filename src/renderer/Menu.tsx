import React from 'react';
import { ipcRenderer } from 'electron';
import './css/menu.css';
import Footer from './Footer';
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
}));

export interface MenuProps {
	error: string;
}

const Menu: React.FC<MenuProps> = function ({ error }: MenuProps) {
	const classes = useStyles();
	return (
		<div className={classes.root}>
			<div className="menu">
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
						<span className="waiting">Waiting for Among Us</span>
						<CircularProgress color="primary" size={40} />
						<button
							className="button"
							onClick={() => {
								ipcRenderer.send('openGame');
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
