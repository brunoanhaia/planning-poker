import {
    Box,
    Button,
    Container,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Typography,
} from '@mui/material';
import React, { useState } from 'react';

import { useSocket } from '../context/SocketContext';
import { CardDeck } from './CardDeck';
import { Home } from './Home';
import { Navbar } from './Navbar';
import { PokerTable } from './PokerTable';
import { ResultsPanel } from './ResultsPanel';
import { RoomSettingsModal } from './RoomSettingsModal';
import { StoryBacklog } from './StoryBacklog';

export interface MainContentProps {
    darkMode: boolean;
    onToggleDarkMode: () => void;
}

export const MainContent: React.FC<MainContentProps> = ({ darkMode, onToggleDarkMode }) => {
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
