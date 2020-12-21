import createMuiTheme from '@material-ui/core/styles/createMuiTheme';
import { red, purple } from '@material-ui/core/colors';

// Create a theme instance.
const theme = createMuiTheme({
  palette: {
    primary: purple,
    secondary: red,
    type: 'dark'
  },
});

export default theme;