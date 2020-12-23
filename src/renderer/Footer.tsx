import { shell } from 'electron';
import React from 'react';
import makeStyles from '@material-ui/core/styles/makeStyles';
import Typography from '@material-ui/core/Typography';

const useStyles = makeStyles(() => ({
	footer: {
		position: 'absolute',
		bottom: 0,
		width: '100%',
		display: 'flex',
		flexDirection: 'column',
		justifyContent: 'center',
		alignItems: 'center',
	},
	row: {
		width: '100%',
		display: 'flex',
		justifyContent: 'space-evenly',
		margin: 5,
	},
}));

const Footer: React.FC = function () {
	const classes = useStyles();
	return (
		<div className={classes.footer}>
			<Typography>Made by Ottomated</Typography>
			<div className={classes.row}>
				<svg
					width={36}
					height={36}
					viewBox="0 0 24 24"
					onClick={() => {
						shell.openExternal('https://github.com/ottomated/crewlink');
					}}
				>
					<path
						fill="currentColor"
						d="M12,2A10,10 0 0,0 2,12C2,16.42 4.87,20.17 8.84,21.5C9.34,21.58 9.5,21.27 9.5,21C9.5,20.77 9.5,20.14 9.5,19.31C6.73,19.91 6.14,17.97 6.14,17.97C5.68,16.81 5.03,16.5 5.03,16.5C4.12,15.88 5.1,15.9 5.1,15.9C6.1,15.97 6.63,16.93 6.63,16.93C7.5,18.45 8.97,18 9.54,17.76C9.63,17.11 9.89,16.67 10.17,16.42C7.95,16.17 5.62,15.31 5.62,11.5C5.62,10.39 6,9.5 6.65,8.79C6.55,8.54 6.2,7.5 6.75,6.15C6.75,6.15 7.59,5.88 9.5,7.17C10.29,6.95 11.15,6.84 12,6.84C12.85,6.84 13.71,6.95 14.5,7.17C16.41,5.88 17.25,6.15 17.25,6.15C17.8,7.5 17.45,8.54 17.35,8.79C18,9.5 18.38,10.39 18.38,11.5C18.38,15.32 16.04,16.16 13.81,16.41C14.17,16.72 14.5,17.33 14.5,18.26C14.5,19.6 14.5,20.68 14.5,21C14.5,21.27 14.66,21.59 15.17,21.5C19.14,20.16 22,16.42 22,12A10,10 0 0,0 12,2Z"
					/>
				</svg>
				<svg
					width={36}
					height={36}
					viewBox="0 0 24 24"
					onClick={() => {
						shell.openExternal('https://twitch.tv/ottomated');
					}}
				>
					<path
						fill="#9146ff"
						d="M11.64 5.93H13.07V10.21H11.64M15.57 5.93H17V10.21H15.57M7 2L3.43 5.57V18.43H7.71V22L11.29 18.43H14.14L20.57 12V2M19.14 11.29L16.29 14.14H13.43L10.93 16.64V14.14H7.71V3.43H19.14Z"
					/>
				</svg>
				<svg
					width={36}
					height={36}
					viewBox="0 0 24 24"
					onClick={() => {
						shell.openExternal('https://twitter.com/Ottomated_');
					}}
				>
					<path
						fill="#1da1f2"
						d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"
					/>
				</svg>
				<svg
					width={36}
					height={36}
					viewBox="0 0 24 24"
					onClick={() => {
						shell.openExternal('https://paypal.me/ottomated');
					}}
				>
					<path
						fill="url(#pattern)"
						d="M7,15H9C9,16.08 10.37,17 12,17C13.63,17 15,16.08 15,15C15,13.9 13.96,13.5 11.76,12.97C9.64,12.44 7,11.78 7,9C7,7.21 8.47,5.69 10.5,5.18V3H13.5V5.18C15.53,5.69 17,7.21 17,9H15C15,7.92 13.63,7 12,7C10.37,7 9,7.92 9,9C9,10.1 10.04,10.5 12.24,11.03C14.36,11.56 17,12.22 17,15C17,16.79 15.53,18.31 13.5,18.82V21H10.5V18.82C8.47,18.31 7,16.79 7,15Z"
					/>
					<defs>
						<linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0">
							<stop offset="0%" style={{ stopColor: '#FF6663' }} />
							<stop offset="9.1%" style={{ stopColor: '#FEB144' }} />
							<stop offset="18.2%" style={{ stopColor: '#FEB144' }} />
							<stop offset="27.3%" style={{ stopColor: '#FDFD97' }} />
							<stop offset="36.4%" style={{ stopColor: '#FDFD97' }} />
							<stop offset="45.5%" style={{ stopColor: '#9EE09E' }} />
							<stop offset="54.6%" style={{ stopColor: '#9EE09E' }} />
							<stop offset="63.6%" style={{ stopColor: '#9EC1CF' }} />
							<stop offset="72.7%" style={{ stopColor: '#9EC1CF' }} />
							<stop offset="81.8%" style={{ stopColor: '#CC99C9' }} />
							<stop offset="90.9%" style={{ stopColor: '#CC99C9' }} />
							<stop offset="100%" style={{ stopColor: '#FF6663' }} />
						</linearGradient>

						<pattern
							id="pattern"
							x="0"
							y="0"
							width="300%"
							height="100%"
							patternUnits="userSpaceOnUse"
						>
							<rect
								x="0"
								y="0"
								width="150%"
								height="100%"
								fill="url(#gradient)"
							>
								<animate
									attributeType="XML"
									attributeName="x"
									from="0"
									to="150%"
									dur="2s"
									repeatCount="indefinite"
								/>
							</rect>
							<rect
								x="-150%"
								y="0"
								width="150%"
								height="100%"
								fill="url(#gradient)"
							>
								<animate
									attributeType="XML"
									attributeName="x"
									from="-150%"
									to="0"
									dur="2s"
									repeatCount="indefinite"
								/>
							</rect>
						</pattern>
					</defs>
				</svg>
			</div>
		</div>
	);
};

export default Footer;
