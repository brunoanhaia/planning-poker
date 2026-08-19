import GroupAddIcon from '@mui/icons-material/GroupAdd';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import {
  Container,
  Paper,
  Typography,
  Box,
  TextField,
  Button,
  Tabs,
  Tab,
  Grid,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  FormHelperText,
  Alert,
} from '@mui/material';
import React, { useState, useEffect } from 'react';

import { useSocket } from '../context/SocketContext';
import { AVATARS, AVATAR_COLORS, DeckType, PRESET_DECKS } from '../types';

export const Home: React.FC = () => {
  const { createRoom, joinRoom, error, clearError } = useSocket();

  const [tabIndex, setTabIndex] = useState(0);
  const [userName, setUserName] = useState(() => localStorage.getItem('planit_name') || '');
  const [avatar, setAvatar] = useState(() => localStorage.getItem('planit_avatar') || AVATARS[0]);
  const [color, setColor] = useState(() => localStorage.getItem('planit_color') || AVATAR_COLORS[0]);

  // Create room form
  const [roomTitle, setRoomTitle] = useState('');
  const [deckType, setDeckType] = useState<DeckType>('fibonacci');

  // Join room form
  const [roomCode, setRoomCode] = useState('');

  // Check URL hash for direct room link (e.g. /#ABC123)
  useEffect(() => {
    const hash = window.location.hash.replace('#', '').toUpperCase();
    if (hash && hash.length === 6) {
      setRoomCode(hash);
      setTabIndex(1); // Switch to Join tab
    }
  }, []);

  const savePreferences = () => {
    localStorage.setItem('planit_name', userName);
    localStorage.setItem('planit_avatar', avatar);
    localStorage.setItem('planit_color', color);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim()) return;
    savePreferences();
    createRoom(userName.trim(), avatar, color, roomTitle.trim() || undefined, deckType);
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim() || !roomCode.trim()) return;
    savePreferences();
    joinRoom(roomCode.trim().toUpperCase(), userName.trim(), avatar, color);
  };

  return (
    <Container maxWidth="sm" sx={{ pt: 6, pb: 8 }}>
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <Typography
          variant="h3"
          sx={{
            fontWeight: 800,
            background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '-0.03em',
            mb: 1,
          }}
        >
          Planit Poker Real-Time
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Agile estimation made fun, fast, and effortless for remote software teams.
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" onClose={clearError} sx={{ mb: 3, borderRadius: '12px' }}>
          {error}
        </Alert>
      )}

      <Paper
        elevation={6}
        sx={{
          borderRadius: '24px',
          overflow: 'hidden',
          p: { xs: 3, sm: 4 },
        }}
      >
        <Tabs
          value={tabIndex}
          onChange={(_, newVal) => setTabIndex(newVal)}
          variant="fullWidth"
          sx={{
            mb: 4,
            borderBottom: 1,
            borderColor: 'divider',
            '& .MuiTab-root': { fontWeight: 700, fontSize: '15px' },
          }}
        >
          <Tab icon={<RocketLaunchIcon />} label="Create Session" iconPosition="start" />
          <Tab icon={<GroupAddIcon />} label="Join Session" iconPosition="start" />
        </Tabs>

        {/* User Profile Section */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
            1. Your Profile
          </Typography>

          <TextField
            fullWidth
            label="Your Display Name"
            placeholder="e.g. Alex, Sarah, Dev Lead"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            required
            sx={{ mb: 2.5 }}
          />

          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
            Choose Avatar & Theme Color:
          </Typography>

          <Grid container spacing={1} sx={{ mb: 2 }}>
            {AVATARS.map((emoji) => (
              <Grid item key={emoji}>
                <Box
                  onClick={() => setAvatar(emoji)}
                  sx={{
                    width: 42,
                    height: 42,
                    borderRadius: '12px',
                    fontSize: '22px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    backgroundColor: avatar === emoji ? 'primary.main' : 'action.hover',
                    color: avatar === emoji ? '#fff' : 'inherit',
                    transition: 'transform 0.15s ease',
                    '&:hover': { transform: 'scale(1.15)' },
                  }}
                >
                  {emoji}
                </Box>
              </Grid>
            ))}
          </Grid>

          <Grid container spacing={1}>
            {AVATAR_COLORS.map((c) => (
              <Grid item key={c}>
                <Box
                  onClick={() => setColor(c)}
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    backgroundColor: c,
                    cursor: 'pointer',
                    border: color === c ? '3px solid #fff' : 'none',
                    boxShadow: color === c ? `0 0 0 2px ${c}` : 'none',
                    transition: 'transform 0.15s ease',
                    '&:hover': { transform: 'scale(1.15)' },
                  }}
                />
              </Grid>
            ))}
          </Grid>
        </Box>

        {/* Create Session Tab */}
        {tabIndex === 0 && (
          <form onSubmit={handleCreate}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
              2. Session Details
            </Typography>

            <TextField
              fullWidth
              label="Session / Project Title (Optional)"
              placeholder="e.g. Sprint 42 Estimation"
              value={roomTitle}
              onChange={(e) => setRoomTitle(e.target.value)}
              sx={{ mb: 2.5 }}
            />

            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel>Estimation Deck Type</InputLabel>
              <Select
                value={deckType}
                label="Estimation Deck Type"
                onChange={(e) => setDeckType(e.target.value as DeckType)}
              >
                <MenuItem value="fibonacci">Fibonacci (1, 2, 3, 5, 8, 13, 21...)</MenuItem>
                <MenuItem value="modified_fibonacci">Modified Fibonacci (0, 0.5, 1, 2, 3, 5...)</MenuItem>
                <MenuItem value="tshirt">T-Shirt Sizes (XS, S, M, L, XL, XXL)</MenuItem>
                <MenuItem value="powers_of_2">Powers of 2 (1, 2, 4, 8, 16, 32...)</MenuItem>
              </Select>
              <FormHelperText>
                Deck cards preview: {PRESET_DECKS[deckType].join(', ')}
              </FormHelperText>
            </FormControl>

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={!userName.trim()}
              sx={{ py: 1.5, fontSize: '16px', fontWeight: 700 }}
            >
              Start Session & Generate Room Code
            </Button>
          </form>
        )}

        {/* Join Session Tab */}
        {tabIndex === 1 && (
          <form onSubmit={handleJoin}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
              2. Enter Room Code
            </Typography>

            <TextField
              fullWidth
              label="6-Character Room Code"
              placeholder="e.g. ABC123"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              required
              inputProps={{ maxLength: 6, style: { textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 700 } }}
              sx={{ mb: 3 }}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              color="secondary"
              size="large"
              disabled={!userName.trim() || roomCode.trim().length !== 6}
              sx={{ py: 1.5, fontSize: '16px', fontWeight: 700 }}
            >
              Join Room Now
            </Button>
          </form>
        )}
      </Paper>
    </Container>
  );
};
