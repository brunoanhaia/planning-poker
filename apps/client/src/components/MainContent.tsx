import {
    Box,
    Button,
    Container,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Typography,
    Grid,
} from '@mui/material';
import React, { useState } from 'react';

import { useSocket } from '../context/SocketContext';
import { EstimationPanel } from './EstimationPanel';
import { Home } from './Home';
import { Navbar } from './Navbar';
import { ParticipantsPanel } from './ParticipantsPanel';
import { RoomSettingsModal } from './RoomSettingsModal';
import { StoryBacklog } from './StoryBacklog';

export interface MainContentProps {
    darkMode: boolean;
    onToggleDarkMode: () => void;
}

export const MainContent: React.FC<MainContentProps> = ({ darkMode, onToggleDarkMode }) => {
    const { clearKickedMessage, kickedMessage, roomState } = useSocket();
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
                onOpenSettings={() => setSettingsOpen(true)}
                onToggleDarkMode={onToggleDarkMode}
            />

            {!roomState ? (
                <Home />
            ) : (
                <Container
                    maxWidth="xl"
                    sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        flexGrow: 1,
                        px: { sm: 3, xs: 1 },
                        py: { sm: 3, xs: 1.5 },
                    }}
                >
                    <Grid container spacing={3}>
                        {/* Participants Column (Left on Desktop, Top on Mobile) */}
                        <Grid size={{ xs: 12, md: 3 }}>
                            <ParticipantsPanel />
                        </Grid>

                        {/* Estimation Column (Center on Desktop, Middle on Mobile) */}
                        <Grid size={{ xs: 12, md: 5, lg: 6 }}>
                            <EstimationPanel />
                        </Grid>

                        {/* Backlog Column (Right on Desktop, Bottom on Mobile) */}
                        <Grid size={{ xs: 12, md: 4, lg: 3 }}>
                            <StoryBacklog />
                        </Grid>
                    </Grid>
                </Container>
            )}

            {roomState && (
                <RoomSettingsModal onClose={() => setSettingsOpen(false)} open={settingsOpen} />
            )}

            {/* Kicked from Room Notification Dialog */}
            <Dialog
                maxWidth="xs"
                onClose={clearKickedMessage}
                open={Boolean(kickedMessage)}
                slotProps={{ paper: { sx: { borderRadius: '16px', p: 1 } } }}
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
