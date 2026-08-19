import { ThemeProvider, CssBaseline, Box, Container } from '@mui/material';
import React, { useState, useMemo } from 'react';

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
  const { roomState } = useSocket();
  const [backlogOpen, setBacklogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      <Navbar
        darkMode={darkMode}
        onToggleDarkMode={onToggleDarkMode}
        onOpenBacklog={() => setBacklogOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {!roomState ? (
        <Home />
      ) : (
        <Container maxWidth="lg" sx={{ flexGrow: 1, py: 3, display: 'flex', flexDirection: 'column' }}>
          <PokerTable />
          <ResultsPanel />
          <CardDeck />
        </Container>
      )}

      {roomState && (
        <>
          <StoryBacklog open={backlogOpen} onClose={() => setBacklogOpen(false)} />
          <RoomSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
        </>
      )}
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
