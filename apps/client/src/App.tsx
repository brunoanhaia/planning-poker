import {
  Box,
  Button,
  Container,
  CssBaseline,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  ThemeProvider,
  Typography,
} from '@mui/material';
import React, { useMemo, useState } from 'react';

import { CardDeck } from './components/CardDeck';
import { Home } from './components/Home';
import { Navbar } from './components/Navbar';
import { PokerTable } from './components/PokerTable';
import { ResultsPanel } from './components/ResultsPanel';
import { RoomSettingsModal } from './components/RoomSettingsModal';
import { StoryBacklog } from './components/StoryBacklog';
import { SocketProvider, useSocket } from './context/SocketContext';
import { getAppTheme } from './theme';

const MainContent: React.FC<{
  darkMode: boolean;
  onToggleDarkMode: () => void;
}> = ({ darkMode, onToggleDarkMode }) => {
  const { clearKickedMessage, kickedMessage, roomState } = useSocket();
  const [backlogOpen, setBacklogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <Box
      sx={{
        bgcolor: 'background.default',
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
      }}
    >
      <Navbar
        darkMode={darkMode}
        onOpenBacklog={() => setBacklogOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        onToggleDarkMode={onToggleDarkMode}
      />

      {!roomState ? (
        <Home />
      ) : (
        <Container
          maxWidth="lg"
          sx={{
            display: 'flex',
            flexDirection: 'column',
            flexGrow: 1,
            px: { sm: 3, xs: 1 },
            py: { sm: 3, xs: 1.5 },
          }}
        >
          <PokerTable />
          <ResultsPanel />
          <CardDeck />
        </Container>
      )}

      {roomState && (
        <>
          <StoryBacklog onClose={() => setBacklogOpen(false)} open={backlogOpen} />
          <RoomSettingsModal onClose={() => setSettingsOpen(false)} open={settingsOpen} />
        </>
      )}

      {/* Kicked from Room Notification Dialog */}
      <Dialog
        maxWidth="xs"
        onClose={clearKickedMessage}
        open={Boolean(kickedMessage)}
        PaperProps={{ sx: { borderRadius: '16px', p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>Session Notice</DialogTitle>
        <DialogContent>
          <Typography variant="body2">{kickedMessage}</Typography>
        </DialogContent>
        <DialogActions sx={{ pb: 2, px: 3 }}>
          <Button onClick={clearKickedMessage} variant="contained">
            OK
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export const App: React.FC = () => {
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('planit_theme');
    return saved ? saved === 'dark' : true;
  });

  const toggleDarkMode = () => {
    setDarkMode((prev) => {
      const next = !prev;
      localStorage.setItem('planit_theme', next ? 'dark' : 'light');
      return next;
    });
  };

  const theme = useMemo(() => getAppTheme(darkMode ? 'dark' : 'light'), [darkMode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <SocketProvider>
        <MainContent darkMode={darkMode} onToggleDarkMode={toggleDarkMode} />
      </SocketProvider>
    </ThemeProvider>
  );
};

export default App;
