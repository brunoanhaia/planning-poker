import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SaveIcon from '@mui/icons-material/Save';
import { Box, Button, Chip, Grid, LinearProgress, Paper, Typography } from '@mui/material';
import confetti from 'canvas-confetti';
import React, { useEffect } from 'react';

import { useSocket } from '../context/SocketContext';

export const ResultsPanel: React.FC = () => {
  const { isAdmin, roomState, updateStoryEstimate } = useSocket();

  const currentStory = roomState?.stories[roomState?.currentStoryIndex ?? 0];
  const votedParticipants = (roomState?.participants || []).filter(
    (p) => !p.isSpectator && p.vote !== null && p.vote !== undefined
  );

  const voteCounts: Record<string, number> = {};
  const numericVotes: number[] = [];

  votedParticipants.forEach((p) => {
    const v = String(p.vote);
    voteCounts[v] = (voteCounts[v] || 0) + 1;

    const num = Number(p.vote);
    if (!isNaN(num) && typeof p.vote !== 'symbol') {
      numericVotes.push(num);
    }
  });

  const totalVotes = votedParticipants.length;

  const hasNumeric = numericVotes.length > 0;
  const sum = numericVotes.reduce((acc, n) => acc + n, 0);
  const average = hasNumeric ? (sum / numericVotes.length).toFixed(1) : 'N/A';

  const highestFrequency = Math.max(0, ...Object.values(voteCounts));
  const consensusPercentage =
    totalVotes > 0 ? Math.round((highestFrequency / totalVotes) * 100) : 0;
  const isFullConsensus = consensusPercentage === 100 && totalVotes > 1;

  const modeVote =
    Object.keys(voteCounts).length > 0
      ? Object.keys(voteCounts).reduce((a, b) => (voteCounts[a] > voteCounts[b] ? a : b))
      : '-';

  useEffect(() => {
    if (isFullConsensus && roomState?.votesRevealed) {
      confetti({
        origin: { y: 0.6 },
        particleCount: 100,
        spread: 70,
      });
    }
  }, [isFullConsensus, roomState?.votesRevealed]);

  if (!roomState || !roomState.votesRevealed) return null;

  if (votedParticipants.length === 0) {
    return (
      <Paper sx={{ borderRadius: '20px', my: 2, p: 3, textAlign: 'center' }}>
        <Typography color="text.secondary" variant="body1">
          No votes were cast for this story yet.
        </Typography>
      </Paper>
    );
  }

  const handleSaveEstimate = () => {
    if (!currentStory || !isAdmin) return;
    const finalVal = hasNumeric ? Number(average) : modeVote;
    updateStoryEstimate(currentStory.id, finalVal);
  };

  return (
    <Paper
      elevation={8}
      sx={{
        background: (theme) =>
          theme.palette.mode === 'dark'
            ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'
            : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
        borderRadius: '24px',
        my: 3,
        p: { sm: 4, xs: 2.5 },
      }}
    >
      <Box
        sx={{
          alignItems: 'center',
          display: 'flex',
          justifyContent: 'space-between',
          mb: 3,
        }}
      >
        <Box sx={{ alignItems: 'center', display: 'flex', gap: 1.5 }}>
          <Typography sx={{ fontWeight: 800 }} variant="h5">
            Estimation Results
          </Typography>
          {isFullConsensus && (
            <Chip
              color="success"
              icon={<CheckCircleIcon />}
              label="100% Consensus 🎉"
              sx={{ fontWeight: 700 }}
            />
          )}
        </Box>

        {currentStory && isAdmin && (
          <Button
            color="success"
            onClick={handleSaveEstimate}
            startIcon={<SaveIcon />}
            sx={{ borderRadius: '12px', fontWeight: 700 }}
            variant="contained"
          >
            Accept {hasNumeric ? `Avg (${average})` : `Mode (${modeVote})`}
          </Button>
        )}
      </Box>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item sm={3} xs={6}>
          <Box
            sx={{
              bgcolor: 'action.hover',
              borderRadius: '16px',
              p: 2,
              textAlign: 'center',
            }}
          >
            <Typography color="text.secondary" sx={{ fontWeight: 700 }} variant="caption">
              AVERAGE
            </Typography>
            <Typography color="primary.main" sx={{ fontWeight: 800, mt: 0.5 }} variant="h4">
              {average}
            </Typography>
          </Box>
        </Grid>

        <Grid item sm={3} xs={6}>
          <Box
            sx={{
              bgcolor: 'action.hover',
              borderRadius: '16px',
              p: 2,
              textAlign: 'center',
            }}
          >
            <Typography color="text.secondary" sx={{ fontWeight: 700 }} variant="caption">
              CONSENSUS
            </Typography>
            <Typography color="secondary.main" sx={{ fontWeight: 800, mt: 0.5 }} variant="h4">
              {consensusPercentage}%
            </Typography>
          </Box>
        </Grid>

        <Grid item sm={3} xs={6}>
          <Box
            sx={{
              bgcolor: 'action.hover',
              borderRadius: '16px',
              p: 2,
              textAlign: 'center',
            }}
          >
            <Typography color="text.secondary" sx={{ fontWeight: 700 }} variant="caption">
              TOP VOTE
            </Typography>
            <Typography color="info.main" sx={{ fontWeight: 800, mt: 0.5 }} variant="h4">
              {modeVote}
            </Typography>
          </Box>
        </Grid>

        <Grid item sm={3} xs={6}>
          <Box
            sx={{
              bgcolor: 'action.hover',
              borderRadius: '16px',
              p: 2,
              textAlign: 'center',
            }}
          >
            <Typography color="text.secondary" sx={{ fontWeight: 700 }} variant="caption">
              VOTERS
            </Typography>
            <Typography color="text.primary" sx={{ fontWeight: 800, mt: 0.5 }} variant="h4">
              {totalVotes}
            </Typography>
          </Box>
        </Grid>
      </Grid>

      <Typography sx={{ fontWeight: 700, mb: 2 }} variant="subtitle2">
        Vote Distribution Breakdown
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {Object.entries(voteCounts).map(([vote, count]) => {
          const pct = Math.round((count / totalVotes) * 100);
          return (
            <Box key={vote} sx={{ alignItems: 'center', display: 'flex', gap: 2 }}>
              <Paper
                sx={{
                  alignItems: 'center',
                  bgcolor: 'primary.main',
                  borderRadius: '10px',
                  color: '#fff',
                  display: 'flex',
                  fontWeight: 800,
                  height: 40,
                  justifyContent: 'center',
                  width: 40,
                }}
              >
                {vote}
              </Paper>
              <Box sx={{ flexGrow: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography sx={{ fontWeight: 700 }} variant="body2">
                    {count} {count === 1 ? 'vote' : 'votes'}
                  </Typography>
                  <Typography color="text.secondary" sx={{ fontWeight: 600 }} variant="body2">
                    {pct}%
                  </Typography>
                </Box>
                <LinearProgress
                  sx={{
                    backgroundColor: 'action.hover',
                    borderRadius: 5,
                    height: 10,
                    '& .MuiLinearProgress-bar': {
                      background: 'linear-gradient(90deg, #6366f1 0%, #ec4899 100%)',
                      borderRadius: 5,
                    },
                  }}
                  value={pct}
                  variant="determinate"
                />
              </Box>
            </Box>
          );
        })}
      </Box>
    </Paper>
  );
};
