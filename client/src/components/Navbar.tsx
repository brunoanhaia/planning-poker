import React, { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  IconButton,
  Chip,
  Box,
  Tooltip,
  Snackbar,
  Alert,
  Switch,
  FormControlLabel,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import SettingsIcon from '@mui/icons-material/Settings';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { useSocket } from '../context/SocketContext';

interface NavbarProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onOpenBacklog: () => void;
  onOpenSettings: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  darkMode,
  onToggleDarkMode,
  onOpenBacklog,
  onOpenSettings,
}) => {
  const { roomState, currentUserId, toggleSpectator, leaveRoom } = useSocket();
  const [copied, setCopied] = useState(false);

  const currentUser = roomState?.participants.find((p) => p.id === currentUserId);

  const handleCopyLink = () => {
    if (!roomState) return;
    const url = `${window.location.origin}/#${roomState.id}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
  };

  return (
    <>
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          backgroundColor: (theme) =>
            theme.palette.mode === 'dark' ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(12px)',
          borderBottom: (theme) =>
            theme.palette.mode === 'dark' ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.06)',
          color: 'text.primary',
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between', gap: 2 }}>
          {/* Logo & Brand */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '22px',
                boxShadow: '0 4px 14px 0 rgba(99, 102, 241, 0.39)',
              }}
            >
              🃏
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
                Planit Poker
              </Typography>
              {roomState && (
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                  {roomState.title}
                </Typography>
              )}
            </Box>
          </Box>

          {/* Room info & Actions */}
          {roomState && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              {/* Room Code Chip */}
              <Tooltip title="Click to copy invite link">
                <Chip
                  icon={<ContentCopyIcon sx={{ fontSize: 16 }} />}
                  label={`Room: ${roomState.id}`}
                  onClick={handleCopyLink}
                  color="primary"
                  variant="outlined"
                  sx={{
                    fontWeight: 700,
                    fontSize: '14px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    '&:hover': {
                      backgroundColor: 'primary.light',
                      color: 'primary.contrastText',
                    },
                  }}
                />
              </Tooltip>

              {/* Spectator Toggle */}
              {currentUser && (
                <FormControlLabel
                  control={
                    <Switch
                      checked={currentUser.isSpectator}
                      onChange={toggleSpectator}
                      size="small"
                      color="secondary"
                    />
                  }
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '13px', fontWeight: 600 }}>
                      {currentUser.isSpectator ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                      {currentUser.isSpectator ? 'Spectator' : 'Voter'}
                    </Box>
                  }
                />
              )}

              {/* Backlog Drawer Button */}
              <Tooltip title="Backlog Stories">
                <IconButton onClick={onOpenBacklog} color="primary" sx={{ border: '1px solid rgba(148, 163, 184, 0.2)' }}>
                  <FormatListBulletedIcon fontSize="small" />
                </IconButton>
              </Tooltip>

              {/* Settings Modal (Host or All) */}
              <Tooltip title="Room Settings">
                <IconButton onClick={onOpenSettings} color="primary" sx={{ border: '1px solid rgba(148, 163, 184, 0.2)' }}>
                  <SettingsIcon fontSize="small" />
                </IconButton>
              </Tooltip>

              {/* Leave Room */}
              <Tooltip title="Leave Room">
                <IconButton onClick={leaveRoom} color="error" sx={{ border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                  <ExitToAppIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          )}

          {/* Theme mode toggle */}
          <IconButton onClick={onToggleDarkMode} color="inherit">
            {darkMode ? <Brightness7Icon /> : <Brightness4Icon />}
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* Copy Notification */}
      <Snackbar open={copied} autoHideDuration={3000} onClose={() => setCopied(false)}>
        <Alert severity="success" variant="filled" sx={{ width: '100%' }}>
          Invite link copied to clipboard! Share it with your team.
        </Alert>
      </Snackbar>
    </>
  );
};
