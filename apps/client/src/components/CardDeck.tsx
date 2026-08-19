import VisibilityIcon from '@mui/icons-material/Visibility';
import { Box, Button, Paper, Typography } from '@mui/material';
import React from 'react';

import { useSocket } from '../context/SocketContext';

export const CardDeck: React.FC = () => {
    const { roomState, currentUserId, submitVote, toggleSpectator } = useSocket();

    if (!roomState) return null;

    const currentUser = roomState.participants.find((p) => p.id === currentUserId);
    const activeDeck = roomState.activeDeck;

    if (currentUser?.isSpectator) {
        return (
            <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center', py: 2 }}>
                <Paper
                    sx={{
                        p: 2,
                        px: 4,
                        borderRadius: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                        backgroundColor: 'rgba(99, 102, 241, 0.08)',
                        border: '1px dashed rgba(99, 102, 241, 0.4)',
                    }}
                >
                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                        You are currently in <strong>Observer Mode</strong> (not voting).
                    </Typography>
                    <Button
                        variant="contained"
                        size="small"
                        color="primary"
                        startIcon={<VisibilityIcon />}
                        onClick={toggleSpectator}
                        sx={{ fontWeight: 700 }}
                    >
                        Switch to Voter
                    </Button>
                </Paper>
            </Box>
        );
    }

    return (
        <Box
            sx={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 1,
                py: 2,
            }}
        >
            <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}
            >
                Select your estimation card:
            </Typography>

            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexWrap: 'wrap',
                    gap: { xs: 1, sm: 1.5 },
                    px: 2,
                    maxWidth: '900px',
                }}
            >
                {activeDeck.map((val) => {
                    const isSelected = currentUser?.vote === val;

                    return (
                        <Paper
                            aria-label={`Select estimate ${val}`}
                            aria-pressed={isSelected}
                            elevation={isSelected ? 8 : 2}
                            key={String(val)}
                            onClick={() => submitVote(val)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    submitVote(val);
                                }
                            }}
                            role="button"
                            sx={{
                                alignItems: 'center',
                                background: isSelected
                                    ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)'
                                    : (theme) =>
                                          theme.palette.mode === 'dark' ? '#1e293b' : '#ffffff',
                                border: isSelected
                                    ? '2px solid #818cf8'
                                    : (theme) =>
                                          theme.palette.mode === 'dark'
                                              ? '1px solid rgba(255,255,255,0.1)'
                                              : '1px solid rgba(0,0,0,0.1)',
                                borderRadius: '12px',
                                color: isSelected ? '#ffffff' : 'text.primary',
                                cursor: 'pointer',
                                display: 'flex',
                                fontSize: { sm: '22px', xs: '16px' },
                                fontWeight: 800,
                                height: { sm: 86, xs: 62 },
                                justifyContent: 'center',
                                outline: 'none',
                                transform: isSelected ? 'translateY(-12px) scale(1.08)' : 'none',
                                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                userSelect: 'none',
                                width: { sm: 58, xs: 42 },
                                '&:focus-visible': {
                                    boxShadow: '0 0 0 3px #6366f1',
                                    transform: 'translateY(-6px)',
                                },
                                '&:hover': {
                                    boxShadow: '0 8px 24px rgba(99, 102, 241, 0.35)',
                                    transform: isSelected
                                        ? 'translateY(-14px) scale(1.1)'
                                        : 'translateY(-6px)',
                                },
                            }}
                            tabIndex={0}
                        >
                            {val}
                        </Paper>
                    );
                })}
            </Box>
        </Box>
    );
};
