import { Box, Paper, Typography, Chip, List, ListItem, ListItemText, ListItemAvatar, Avatar } from '@mui/material';
import React from 'react';
import { useSocket } from '../context/SocketContext';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

export const ParticipantsPanel: React.FC = () => {
    const { currentUserId, roomState } = useSocket();

    if (!roomState) return null;

    const participants = roomState.participants;

    return (
        <Paper
            elevation={1}
            sx={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                p: 2,
                borderRadius: '16px',
            }}
        >
            <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                    Participants ({participants.length})
                </Typography>
            </Box>

            <List sx={{ flexGrow: 1, overflowY: 'auto', p: 0 }}>
                {participants.map((participant) => {
                    const isSelf = participant.id === currentUserId;
                    const hasVoted = participant.hasVoted;

                    return (
                        <ListItem
                            key={participant.id}
                            sx={{
                                bgcolor: isSelf ? 'action.selected' : 'background.paper',
                                borderRadius: '8px',
                                mb: 1,
                                border: '1px solid',
                                borderColor: isSelf ? 'primary.main' : 'divider',
                                px: 2,
                                py: 1,
                            }}
                        >
                            <ListItemAvatar sx={{ minWidth: 48 }}>
                                <Avatar
                                    sx={{
                                        bgcolor: 'primary.main',
                                        color: 'primary.contrastText',
                                        fontWeight: 800,
                                        width: 36,
                                        height: 36,
                                        fontSize: '0.9rem',
                                    }}
                                >
                                    {participant.name.substring(0, 2).toUpperCase()}
                                </Avatar>
                            </ListItemAvatar>
                            <ListItemText
                                primary={
                                    <Typography variant="body2" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        {participant.name} 
                                        {isSelf && <Typography component="span" variant="caption" color="primary.main">(you)</Typography>}
                                    </Typography>
                                }
                            />
                            {hasVoted && !participant.isSpectator && (
                                <Chip
                                    label="Voted"
                                    color="success"
                                    size="small"
                                    icon={<CheckCircleIcon fontSize="small" />}
                                    sx={{ fontWeight: 700, height: 24 }}
                                />
                            )}
                            {participant.isSpectator && (
                                <Chip label="Spectator" size="small" variant="outlined" sx={{ fontWeight: 700, height: 24 }} />
                            )}
                        </ListItem>
                    );
                })}
            </List>
        </Paper>
    );
};
