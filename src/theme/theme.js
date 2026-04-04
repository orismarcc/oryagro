import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1e4d2b',
      light: '#52b788',
      dark: '#163820',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#b5451b',
      light: '#e07b56',
      dark: '#8a3414',
      contrastText: '#ffffff',
    },
    warning: {
      main: '#d4a017',
      light: '#f0c844',
      dark: '#a07810',
    },
    error: {
      main: '#c0392b',
    },
    info: {
      main: '#1a6b9a',
    },
    success: {
      main: '#2d6a4f',
    },
    background: {
      default: '#f7f5f0',
      paper: '#ffffff',
    },
    text: {
      primary: '#1a1a1a',
      secondary: '#5a5a5a',
    },
    divider: '#e8e4de',
  },
  typography: {
    fontFamily: '"DM Sans", "Helvetica Neue", Arial, sans-serif',
    h1: { fontFamily: '"Fraunces", Georgia, serif', fontWeight: 700 },
    h2: { fontFamily: '"Fraunces", Georgia, serif', fontWeight: 600 },
    h3: { fontFamily: '"Fraunces", Georgia, serif', fontWeight: 600 },
    h4: { fontFamily: '"Fraunces", Georgia, serif', fontWeight: 600 },
    h5: { fontFamily: '"Fraunces", Georgia, serif', fontWeight: 600 },
    h6: { fontFamily: '"Fraunces", Georgia, serif', fontWeight: 600 },
  },
  shape: {
    borderRadius: 6,
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: 'none',
          border: '1px solid #e8e4de',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 6,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          fontWeight: 600,
          fontSize: '0.75rem',
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: 'outlined',
        size: 'small',
      },
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            '& fieldset': { borderWidth: '1.5px' },
          },
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: '#2d2d2d',
          color: '#ffffff',
          fontSize: '0.78rem',
          maxWidth: 260,
          padding: '8px 12px',
          lineHeight: 1.5,
        },
        arrow: {
          color: '#2d2d2d',
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          fontSize: '0.875rem',
        },
      },
    },
    MuiAccordion: {
      styleOverrides: {
        root: {
          boxShadow: 'none',
          border: '1px solid #e8e4de',
          '&:before': { display: 'none' },
          '&.Mui-expanded': { margin: 0 },
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-head': {
            backgroundColor: '#1e4d2b',
            color: '#ffffff',
            fontWeight: 700,
          },
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:nth-of-type(even)': {
            backgroundColor: '#f7f5f0',
          },
        },
      },
    },
  },
});

export default theme;
