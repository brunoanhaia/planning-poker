import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SaveIcon from '@mui/icons-material/Save';
import {
  Box,
  Paper,
  Typography,
  Grid,
  LinearProgress,
  Button,
  Chip,
} from '@mui/material';
import confetti from 'canvas-confetti';
import React, { useEffect } from 'react';

import { useSocket } from '../context/SocketContext';

export const ResultsPanel: React.FC = () => {
  const { roomState, updateStoryEstimate } = useSocket();

  const currentStory = roomState?.stories[roomState?.currentStoryIndex ?? 0];
  const votedParticipants = (roomState?.participants || []).filter(
    (p) => !p.isSpectator && p.vote !== null && p.vote !== undefined
  );

  // Calculate Vote Breakdown
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

  // Average calculation
  const hasNumeric = numericVotes.length > 0;
  const sum = numericVotes.reduce((acc, n) => acc + n, 0);
  const average = hasNumeric ? (sum / numericVotes.length).toFixed(1) : 'N/A';

  // Consensus calculation
  const highestFrequency = Math.max(0, ...Object.values(voteCounts));
  const consensusPercentage = totalVotes > 0 ? Math.round((highestFrequency / totalVotes) * 100) : 0;
  const isFullConsensus = consensusPercentage === 100 && totalVotes > 1;

  // Most common vote (Mode)
  const modeVote = Object.keys(voteCounts).length > 0
    ? Object.keys(voteCounts).reduce((a, b) => (voteCounts[a] > voteCounts[b] ? a : b))
    : '-';

  // Trigger confetti on 100% consensus (Hook called unconditionally before early return)
  useEffect(() => {
    if (isFullConsensus && roomState?.votesRevealed) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
    }
  }, [isFullConsensus, roomState?.votesRevealed]);

  if (!roomState || !roomState.votesRevealed) return null;

  if (votedParticipants.length === 0) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center', my: 2, borderRadius: '20px' }}>
        <Typography variant="body1" color="text.secondary">
          No votes were cast for this story yet.
        </Typography>
      </Paper>
    );
  }

  const handleSaveEstimate = () => {
    if (!currentStory) return;
    const finalVal = hasNumeric ? Number(average) : modeVote;
    updateStoryEstimate(currentStory.id, finalVal);
  };

  return (
    <Paper
      elevation={8}
      sx={{
        p: { xs: 2.5, sm: 4 },
        my: 3,
        borderRadius: '24px',
        background: (theme) =>
          theme.palette.mode === 'dark'
            ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'
            : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>
            Estimation Results
          </Typography>
          {isFullConsensus && (
            <Chip
              icon={<CheckCircleIcon />}
              label="100% Consensus 🎉"
              color="success"
              sx={{ fontWeight: 700 }}
            />
          )}
        </Box>

        {currentStory && (
          <Button
            variant="contained"
            color="success"
            startIcon={<SaveIcon />}
            onClick={handleSaveEstimate}
            sx={{ fontWeight: 700, borderRadius: '12px' }}
          >
            Accept {hasNumeric ? `Avg (${average})` : `Mode (${modeVote})`}
          </Button>
        )}
      </Box>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Metric 1: Average */}
        <Grid item xs={6} sm={3}>
          <Box
            sx={{
              p: 2,
              borderRadius: '16px',
              bgcolor: 'action.hover',
              textAlign: 'center',
            }}
          >
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
              AVERAGE
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 800, color: 'primary.main', mt: 0.5 }}>
              {average}
            </Typography>
          </Box>
        </Grid>

        {/* Metric 2: Consensus */}
        <Grid item xs={6} sm={3}>
          <Box
            sx={{
              p: 2,
              borderRadius: '16px',
              bgcolor: 'action.hover',
              textAlign: 'center',
            }}
          >
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
              CONSENSUS
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 800, color: 'secondary.main', mt: 0.5 }}>
              {consensusPercentage}%
            </Typography>
          </Box>
        </Grid>

        {/* Metric 3: Mode / Top Choice */}
        <Grid item xs={6} sm={3}>
          <Box
            sx={{
              p: 2,
              borderRadius: '16px',
              bgcolor: 'action.hover',
              textAlign: 'center',
            }}
          >
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
              TOP VOTE
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 800, color: 'info.main', mt: 0.5 }}>
              {modeVote}
            </Typography>
          </Box>
        </Grid>

        {/* Metric 4: Total Voters */}
        <Grid item xs={6} sm={3}>
          <Box
            sx={{
              p: 2,
              borderRadius: '16px',
              bgcolor: 'action.hover',
              textAlign: 'center',
            }}
          >
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
              VOTERS
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 800, color: 'text.primary', mt: 0.5 }}>
              {totalVotes}
            </Typography>
          </Box>
        </Grid>
      </Grid>

      {/* Distribution Histogram */}
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>
        Vote Distribution Breakdown
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {Object.entries(voteCounts).map(([vote, count]) => {
          const pct = Math.round((count / totalVotes) * 100);
          return (
            <Box key={vote} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Paper
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  bgcolor: 'primary.main',
                  color: '#fff',
                }}
              >
                {vote}
              </Paper>
              <Box sx={{ flexGrow: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {count} {count === 1 ? 'vote' : 'votes'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                    {pct}%
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={pct}
                  sx={{
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: 'action.hover',
                    '& .MuiLinearProgress-bar': {
                      borderRadius: 5,
                      background: 'linear-gradient(90deg, #6366f1 0%, #ec4899 100%)',
                    },
                  }}
                />
              </Box>
            </Box>
          );
        })}
      </Box>
    </Paper>
  );
};
