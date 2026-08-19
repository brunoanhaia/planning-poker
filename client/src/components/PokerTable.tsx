import React from 'react';
import { Box, Paper, Typography, Button, Chip } from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useSocket } from '../context/SocketContext';
import { ParticipantCard } from './ParticipantCard';

export const PokerTable: React.FC = () => {
  const { roomState, currentUserId, revealVotes, resetVotes } = useSocket();

  if (!roomState) return null;

  const currentStory = roomState.stories[roomState.currentStoryIndex];
  const participants = roomState.participants;
  const isHost = roomState.hostId === currentUserId;

  const activeVoters = participants.filter((p) => !p.isSpectator);
  const votedCount = activeVoters.filter((p) => p.hasVoted).length;

  return (
    <Box
      sx={{
        width: '100%',
        minHeight: '440px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        py: 4,
        px: 2,
      }}
    >
      {/* Outer Table Layout Container */}
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          maxWidth: '850px',
          height: '380px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Central Poker Table Felt */}
        <Paper
          elevation={12}
          sx={{
            width: '80%',
            height: '240px',
            borderRadius: '120px',
            background: (theme) =>
              theme.palette.mode === 'dark'
                ? 'radial-gradient(ellipse at center, #1e293b 0%, #0f172a 100%)'
                : 'radial-gradient(ellipse at center, #e0e7ff 0%, #c7d2fe 100%)',
            border: (theme) =>
              theme.palette.mode === 'dark'
                ? '8px solid #334155'
                : '8px solid #818cf8',
            boxShadow: (theme) =>
              theme.palette.mode === 'dark'
                ? '0 0 50px rgba(99, 102, 241, 0.25), inset 0 0 30px rgba(0,0,0,0.6)'
                : '0 0 40px rgba(99, 102, 241, 0.2), inset 0 0 20px rgba(99, 102, 241, 0.2)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            p: 3,
            textAlign: 'center',
            zIndex: 1,
          }}
        >
          {/* Active Story info */}
          <Chip
            label={`Story ${roomState.currentStoryIndex + 1} of ${roomState.stories.length}`}
            size="small"
            color="primary"
            sx={{ fontWeight: 700, mb: 1, height: 22 }}
          />

          <Typography
            variant="h6"
            sx={{
              fontWeight: 800,
              maxWidth: '90%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              mb: 0.5,
            }}
          >
            {currentStory ? currentStory.title : 'No active story selected'}
          </Typography>

          {currentStory?.description && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                maxWidth: '80%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                mb: 2,
              }}
            >
              {currentStory.description}
            </Typography>
          )}

          {/* Voting progress / Action Buttons */}
          <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
            {!roomState.votesRevealed ? (
              <Button
                variant="contained"
                color="primary"
                startIcon={<VisibilityIcon />}
                onClick={revealVotes}
                disabled={activeVoters.length === 0}
                sx={{
                  borderRadius: '20px',
                  fontWeight: 700,
                  px: 3,
                  py: 1,
                  boxShadow: '0 6px 20px rgba(99, 102, 241, 0.4)',
                }}
              >
                Reveal Votes ({votedCount}/{activeVoters.length})
              </Button>
            ) : (
              <Button
                variant="outlined"
                color="secondary"
                startIcon={<RefreshIcon />}
                onClick={resetVotes}
                sx={{
                  borderRadius: '20px',
                  fontWeight: 700,
                  px: 3,
                  py: 1,
                }}
              >
                Reset Votes
              </Button>
            )}
          </Box>
        </Paper>

        {/* Surrounding Participant Seats */}
        <Box
          sx={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            top: 0,
            left: 0,
          }}
        >
          {participants.map((p, idx) => {
            // Position participants around the oval border using trigonometric math
            const total = participants.length;
            const angle = (idx / total) * 2 * Math.PI - Math.PI / 2;
            const rx = 44; // horizontal radius %
            const ry = 42; // vertical radius %

            const left = 50 + rx * Math.cos(angle);
            const top = 50 + ry * Math.sin(angle);

            return (
              <Box
                key={p.id}
                sx={{
                  position: 'absolute',
                  left: `${left}%`,
                  top: `${top}%`,
                  transform: 'translate(-50%, -50%)',
                  pointerEvents: 'auto',
                  zIndex: 2,
                }}
              >
                <ParticipantCard
                  participant={p}
                  votesRevealed={roomState.votesRevealed}
                  isSelf={p.id === currentUserId}
                />
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
};
