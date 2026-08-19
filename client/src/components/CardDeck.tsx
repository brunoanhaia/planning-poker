import React from 'react';
import { Box, Paper, Typography, Button, Tooltip } from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
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
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
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
              key={String(val)}
              onClick={() => submitVote(val)}
              elevation={isSelected ? 8 : 2}
              sx={{
                width: { xs: 46, sm: 58 },
                height: { xs: 70, sm: 86 },
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                userSelect: 'none',
                fontWeight: 800,
                fontSize: { xs: '18px', sm: '22px' },
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                background: isSelected
                  ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)'
                  : (theme) => (theme.palette.mode === 'dark' ? '#1e293b' : '#ffffff'),
                color: isSelected ? '#ffffff' : 'text.primary',
                border: isSelected
                  ? '2px solid #818cf8'
                  : (theme) => (theme.palette.mode === 'dark' ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)'),
                transform: isSelected ? 'translateY(-12px) scale(1.08)' : 'none',
                '&:hover': {
                  transform: isSelected ? 'translateY(-14px) scale(1.1)' : 'translateY(-6px)',
                  boxShadow: '0 8px 24px rgba(99, 102, 241, 0.35)',
                },
              }}
            >
              {val}
            </Paper>
          );
        })}
      </Box>
    </Box>
  );
};
