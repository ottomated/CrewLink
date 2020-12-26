import createMuiTheme from '@material-ui/core/styles/createMuiTheme';
import { red, purple } from '@material-ui/core/colors';

// Create a theme instance.
const theme = createMuiTheme({
	palette: {
		primary: purple,
		secondary: red,
		background: {
			default: '#27232a',
		},
		type: 'dark',
	},
	overrides: {
		MuiTooltip: {
			tooltip: {
				fontSize: 16,
			},
		},
	},
});

export default theme;
