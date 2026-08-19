import AccessTimeIcon from '@mui/icons-material/AccessTime';
import AutoModeIcon from '@mui/icons-material/AutoMode';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RefreshIcon from '@mui/icons-material/Refresh';
import VisibilityIcon from '@mui/icons-material/Visibility';
import {
  Box,
  Button,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  Tooltip,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';

import { useSocket } from '../context/SocketContext';
import { ParticipantCard } from './ParticipantCard';

export const PokerTable: React.FC = () => {
  const {
    currentUserId,
    isAdmin,
    pauseTimer,
    resetTimer,
    resetVotes,
    revealVotes,
    roomState,
    startTimer,
  } = useSocket();

  const [timerMenuAnchor, setTimerMenuAnchor] = useState<null | HTMLElement>(null);

  if (!roomState) return null;

  const currentStory = roomState.stories[roomState.currentStoryIndex];
  const participants = roomState.participants;

  const activeVoters = participants.filter((p) => !p.isSpectator && p.isOnline);
  const votedCount = activeVoters.filter((p) => p.hasVoted).length;

  const timer = roomState.timer;
  const isTimerEnding = timer && timer.remaining <= 10 && timer.remaining > 0;

  const handleOpenTimerMenu = (event: React.MouseEvent<HTMLElement>) => {
    setTimerMenuAnchor(event.currentTarget);
  };

  const handleStartTimerPreset = (duration: number) => {
    startTimer(duration);
    setTimerMenuAnchor(null);
  };

  return (
    <Box
      sx={{
        alignItems: 'center',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        minHeight: '460px',
        position: 'relative',
        px: 2,
        py: 3,
        width: '100%',
      }}
    >
      {/* Session Ended Banner */}
      {roomState.isEnded && (
        <Paper
          sx={{
            bgcolor: 'success.dark',
            borderRadius: '16px',
            color: '#fff',
            mb: 2,
            p: 2,
            textAlign: 'center',
            width: '100%',
          }}
        >
          <Typography sx={{ fontWeight: 800 }} variant="h6">
            🎉 Sprint Planning Estimation Session Ended!
          </Typography>
          <Typography variant="body2">
            All story estimates have been finalized. You can export the summary from the Backlog.
          </Typography>
        </Paper>
      )}

      {/* Top Bar on Table: Auto-Reveal & Timer info */}
      <Box
        sx={{
          alignItems: 'center',
          display: 'flex',
          gap: 2,
          justifyContent: 'center',
          mb: 4,
          position: 'relative',
          zIndex: 10,
        }}
      >
        {/* Synchronized Countdown Timer */}
        <Paper
          elevation={timer?.isRunning ? 6 : 1}
          sx={{
            alignItems: 'center',
            bgcolor: isTimerEnding
              ? 'error.dark'
              : timer?.isRunning
                ? 'action.selected'
                : 'background.paper',
            borderRadius: '24px',
            color: isTimerEnding ? '#fff' : 'text.primary',
            display: 'flex',
            gap: 1,
            px: 2,
            py: 0.5,
            transition: 'all 0.3s ease',
          }}
        >
          <AccessTimeIcon
            color={isTimerEnding ? 'inherit' : timer?.isRunning ? 'primary' : 'action'}
            fontSize="small"
          />
          <Typography sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 800 }} variant="body2">
            {timer
              ? `${Math.floor(timer.remaining / 60)}:${String(timer.remaining % 60).padStart(2, '0')}`
              : 'Timer: Off'}
          </Typography>

          {isAdmin && (
            <Box sx={{ alignItems: 'center', display: 'flex', gap: 0.2 }}>
              <Tooltip title={timer?.isRunning ? 'Pause Timer' : 'Start Timer'}>
                <IconButton
                  color="inherit"
                  onClick={timer ? pauseTimer : handleOpenTimerMenu}
                  size="small"
                >
                  {timer?.isRunning ? (
                    <PauseIcon fontSize="small" />
                  ) : (
                    <PlayArrowIcon fontSize="small" />
                  )}
                </IconButton>
              </Tooltip>
              {timer && (
                <Tooltip title="Reset Timer">
                  <IconButton color="inherit" onClick={resetTimer} size="small">
                    <RefreshIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          )}
        </Paper>

        {/* Auto-Reveal Badge */}
        {roomState.autoReveal && (
          <Tooltip title="Auto-Reveal is active (cards flip automatically when everyone votes)">
            <Chip
              color="info"
              icon={<AutoModeIcon sx={{ fontSize: 16 }} />}
              label="Auto-Reveal ON"
              size="small"
              sx={{ fontWeight: 700, height: 28 }}
            />
          </Tooltip>
        )}
      </Box>

      {/* Timer Presets Menu */}
      <Menu
        anchorEl={timerMenuAnchor}
        onClose={() => setTimerMenuAnchor(null)}
        open={Boolean(timerMenuAnchor)}
      >
        <MenuItem onClick={() => handleStartTimerPreset(30)}>30 Seconds</MenuItem>
        <MenuItem onClick={() => handleStartTimerPreset(60)}>1 Minute</MenuItem>
        <MenuItem onClick={() => handleStartTimerPreset(120)}>2 Minutes</MenuItem>
        <MenuItem onClick={() => handleStartTimerPreset(300)}>5 Minutes</MenuItem>
      </Menu>

      {/* Outer Table Layout Container */}
      <Box
        sx={{
          alignItems: 'center',
          display: 'flex',
          height: '420px',
          justifyContent: 'center',
          maxWidth: '850px',
          my: 2,
          position: 'relative',
          width: '100%',
        }}
      >
        {/* Central Poker Table Felt */}
        <Paper
          elevation={12}
          sx={{
            alignItems: 'center',
            background: (theme) =>
              theme.palette.mode === 'dark'
                ? 'radial-gradient(ellipse at center, #1e293b 0%, #0f172a 100%)'
                : 'radial-gradient(ellipse at center, #e0e7ff 0%, #c7d2fe 100%)',
            border: (theme) =>
              theme.palette.mode === 'dark' ? '8px solid #334155' : '8px solid #818cf8',
            borderRadius: '120px',
            boxShadow: (theme) =>
              theme.palette.mode === 'dark'
                ? '0 0 50px rgba(99, 102, 241, 0.25), inset 0 0 30px rgba(0,0,0,0.6)'
                : '0 0 40px rgba(99, 102, 241, 0.2), inset 0 0 20px rgba(99, 102, 241, 0.2)',
            display: 'flex',
            flexDirection: 'column',
            height: '240px',
            justifyContent: 'center',
            p: 3,
            textAlign: 'center',
            width: '80%',
            zIndex: 1,
          }}
        >
          {/* Active Story info */}
          <Chip
            color="primary"
            label={`Story ${roomState.currentStoryIndex + 1} of ${roomState.stories.length}`}
            size="small"
            sx={{ fontWeight: 700, height: 22, mb: 1 }}
          />

          <Typography
            sx={{
              fontWeight: 800,
              maxWidth: '90%',
              mb: 0.5,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            variant="h6"
          >
            {currentStory ? currentStory.title : 'No active story selected'}
          </Typography>

          {currentStory?.description && (
            <Typography
              color="text.secondary"
              sx={{
                maxWidth: '80%',
                mb: 2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              variant="caption"
            >
              {currentStory.description}
            </Typography>
          )}

          {/* Voting progress / Action Buttons */}
          <Box sx={{ alignItems: 'center', display: 'flex', gap: 2, mt: 1 }}>
            {!roomState.votesRevealed ? (
              isAdmin ? (
                <Button
                  color="primary"
                  disabled={activeVoters.length === 0}
                  onClick={revealVotes}
                  startIcon={<VisibilityIcon />}
                  sx={{
                    borderRadius: '20px',
                    boxShadow: '0 6px 20px rgba(99, 102, 241, 0.4)',
                    fontWeight: 700,
                    px: 3,
                    py: 1,
                  }}
                  variant="contained"
                >
                  Reveal Votes ({votedCount}/{activeVoters.length})
                </Button>
              ) : (
                <Chip
                  color="default"
                  icon={<VisibilityIcon sx={{ fontSize: 16 }} />}
                  label={`Votes: ${votedCount}/${activeVoters.length} cast (Waiting for Host to reveal)`}
                  sx={{
                    bgcolor: 'action.hover',
                    fontWeight: 700,
                    px: 1,
                    py: 2,
                  }}
                  variant="outlined"
                />
              )
            ) : (
              isAdmin && (
                <Button
                  color="secondary"
                  onClick={resetVotes}
                  startIcon={<RefreshIcon />}
                  sx={{
                    borderRadius: '20px',
                    fontWeight: 700,
                    px: 3,
                    py: 1,
                  }}
                  variant="outlined"
                >
                  Reset Votes (Admin)
                </Button>
              )
            )}
          </Box>
        </Paper>

        {/* Surrounding Participant Seats */}
        <Box
          sx={{
            height: '100%',
            left: 0,
            pointerEvents: 'none',
            position: 'absolute',
            top: 0,
            width: '100%',
          }}
        >
          {participants.map((p, idx) => {
            const total = participants.length;
            const angle = (idx / total) * 2 * Math.PI + Math.PI / 2;
            const rx = 42;
            const ry = 38;

            const left = 50 + rx * Math.cos(angle);
            const top = 50 + ry * Math.sin(angle);

            return (
              <Box
                key={p.id}
                sx={{
                  left: `${left}%`,
                  pointerEvents: 'auto',
                  position: 'absolute',
                  top: `${top}%`,
                  transform: 'translate(-50%, -50%)',
                  zIndex: 2,
                }}
              >
                <ParticipantCard
                  isSelf={p.id === currentUserId}
                  participant={p}
                  votesRevealed={roomState.votesRevealed}
                />
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
};
