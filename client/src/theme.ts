import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1f5c8b',
    },
    secondary: {
      main: '#b35c00',
    },
    background: {
      default: '#f6f7f9',
    },
  },
  typography: {
    fontFamily: ['Roboto', 'Helvetica', 'Arial', 'sans-serif'].join(','),
    h1: { fontSize: '2rem', fontWeight: 600 },
    h4: { fontWeight: 600 },
  },
  shape: {
    borderRadius: 8,
  },
});
