import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import EditIcon from '@mui/icons-material/Edit';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import LockIcon from '@mui/icons-material/Lock';
import SettingsIcon from '@mui/icons-material/Settings';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import {
    Alert,
    AppBar,
    Box,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControlLabel,
    IconButton,
    Snackbar,
    Switch,
    TextField,
    Toolbar,
    Tooltip,
    Typography,
} from '@mui/material';
import Button from '@mui/material/Button';
import React, { useState } from 'react';

import { useSocket } from '../context/SocketContext';

interface NavbarProps {
    darkMode: boolean;
    onOpenBacklog: () => void;
    onOpenSettings: () => void;
    onToggleDarkMode: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
    darkMode,
    onOpenBacklog,
    onOpenSettings,
    onToggleDarkMode,
}) => {
    const { currentUserId, isAdmin, leaveRoom, roomState, toggleSpectator, updateRoomTitle } =
        useSocket();
    const [copied, setCopied] = useState(false);
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [newTitle, setNewTitle] = useState('');

    const currentUser = roomState?.participants.find((p) => p.id === currentUserId);

    const handleCopyLink = () => {
        if (!roomState) return;
        const url = `${window.location.origin}/#${roomState.id}`;
        navigator.clipboard.writeText(url);
        setCopied(true);
    };

    const handleOpenEditTitle = () => {
        if (!isAdmin || !roomState) return;
        setNewTitle(roomState.title);
        setIsEditingTitle(true);
    };

    const handleSaveTitle = () => {
        if (newTitle.trim()) {
            updateRoomTitle(newTitle.trim());
        }
        setIsEditingTitle(false);
    };

    return (
        <>
            <AppBar
                elevation={0}
                position="sticky"
                sx={{
                    backgroundColor: (theme) =>
                        theme.palette.mode === 'dark'
                            ? 'rgba(15, 23, 42, 0.85)'
                            : 'rgba(255, 255, 255, 0.85)',
                    backdropFilter: 'blur(12px)',
                    borderBottom: (theme) =>
                        theme.palette.mode === 'dark'
                            ? '1px solid rgba(255, 255, 255, 0.08)'
                            : '1px solid rgba(0, 0, 0, 0.06)',
                    color: 'text.primary',
                }}
            >
                <Toolbar sx={{ gap: 2, justifyContent: 'space-between' }}>
                    {/* Logo & Brand */}
                    <Box sx={{ alignItems: 'center', display: 'flex', gap: 1.5 }}>
                        <Box
                            sx={{
                                alignItems: 'center',
                                background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
                                borderRadius: '12px',
                                boxShadow: '0 4px 14px 0 rgba(99, 102, 241, 0.39)',
                                display: 'flex',
                                fontSize: '22px',
                                height: 40,
                                justifyContent: 'center',
                                width: 40,
                            }}
                        >
                            🃏
                        </Box>
                        <Box>
                            <Typography
                                sx={{ fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.1 }}
                                variant="h6"
                            >
                                Planit Poker
                            </Typography>
                            {roomState && (
                                <Box sx={{ alignItems: 'center', display: 'flex', gap: 0.5 }}>
                                    <Typography
                                        color="text.secondary"
                                        sx={{
                                            cursor: isAdmin ? 'pointer' : 'default',
                                            fontWeight: 600,
                                            maxWidth: { sm: '300px', xs: '140px' },
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                            '&:hover': isAdmin
                                                ? { textDecoration: 'underline' }
                                                : {},
                                        }}
                                        variant="caption"
                                        onClick={handleOpenEditTitle}
                                    >
                                        {roomState.title}
                                    </Typography>
                                    {isAdmin && (
                                        <Tooltip title="Rename Room">
                                            <IconButton
                                                onClick={handleOpenEditTitle}
                                                size="small"
                                                sx={{ p: 0.2 }}
                                            >
                                                <EditIcon sx={{ fontSize: 13 }} />
                                            </IconButton>
                                        </Tooltip>
                                    )}
                                </Box>
                            )}
                        </Box>
                    </Box>

                    {/* Room info & Actions */}
                    {roomState && (
                        <Box
                            sx={{
                                alignItems: 'center',
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: { xs: 0.5, sm: 1.5 },
                                justifyContent: 'flex-end',
                            }}
                        >
                            {/* Admin Badge */}
                            {isAdmin && (
                                <Chip
                                    color="warning"
                                    label="👑 Admin"
                                    size="small"
                                    sx={{ fontWeight: 800, height: 24 }}
                                />
                            )}

                            {/* Locked badge */}
                            {roomState.isLocked && (
                                <Tooltip title="Room is locked by admin (no new members can join)">
                                    <Chip
                                        color="error"
                                        icon={<LockIcon sx={{ fontSize: 14 }} />}
                                        label={
                                            <Box
                                                component="span"
                                                sx={{ display: { xs: 'none', sm: 'inline' } }}
                                            >
                                                Locked
                                            </Box>
                                        }
                                        size="small"
                                        sx={{ fontWeight: 700, height: 24 }}
                                    />
                                </Tooltip>
                            )}

                            {/* Room Code Chip */}
                            <Tooltip title="Click to copy invite link">
                                <Chip
                                    color="primary"
                                    icon={<ContentCopyIcon sx={{ fontSize: { xs: 13, sm: 16 } }} />}
                                    label={`Room: ${roomState.id}`}
                                    onClick={handleCopyLink}
                                    size="small"
                                    sx={{
                                        borderRadius: '10px',
                                        cursor: 'pointer',
                                        fontSize: { xs: '12px', sm: '14px' },
                                        fontWeight: 700,
                                        height: { xs: 26, sm: 32 },
                                        '&:hover': {
                                            backgroundColor: 'primary.light',
                                            color: 'primary.contrastText',
                                        },
                                    }}
                                    variant="outlined"
                                />
                            </Tooltip>

                            {/* Spectator Toggle */}
                            {currentUser && (
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={currentUser.isSpectator}
                                            color="secondary"
                                            onChange={toggleSpectator}
                                            size="small"
                                        />
                                    }
                                    label={
                                        <Box
                                            sx={{
                                                alignItems: 'center',
                                                display: 'flex',
                                                fontSize: '13px',
                                                gap: 0.5,
                                                fontWeight: 600,
                                            }}
                                        >
                                            {currentUser.isSpectator ? (
                                                <VisibilityOffIcon fontSize="small" />
                                            ) : (
                                                <VisibilityIcon fontSize="small" />
                                            )}
                                            <Box
                                                component="span"
                                                sx={{ display: { xs: 'none', md: 'inline' } }}
                                            >
                                                {currentUser.isSpectator ? 'Spectator' : 'Voter'}
                                            </Box>
                                        </Box>
                                    }
                                    sx={{ mr: { xs: 0, sm: 1 } }}
                                />
                            )}

                            {/* Backlog Drawer Button */}
                            <Tooltip title="Backlog Stories">
                                <IconButton
                                    color="primary"
                                    onClick={onOpenBacklog}
                                    size="small"
                                    sx={{ border: '1px solid rgba(148, 163, 184, 0.2)' }}
                                >
                                    <FormatListBulletedIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>

                            {/* Settings Modal (Admin only) */}
                            {isAdmin && (
                                <Tooltip title="Room Settings (Admin)">
                                    <IconButton
                                        color="primary"
                                        onClick={onOpenSettings}
                                        size="small"
                                        sx={{ border: '1px solid rgba(148, 163, 184, 0.2)' }}
                                    >
                                        <SettingsIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            )}

                            {/* Leave Room */}
                            <Tooltip title="Leave Room">
                                <IconButton
                                    color="error"
                                    onClick={leaveRoom}
                                    size="small"
                                    sx={{ border: '1px solid rgba(239, 68, 68, 0.2)' }}
                                >
                                    <ExitToAppIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        </Box>
                    )}

                    {/* Theme mode toggle */}
                    <IconButton color="inherit" onClick={onToggleDarkMode}>
                        {darkMode ? <Brightness7Icon /> : <Brightness4Icon />}
                    </IconButton>
                </Toolbar>
            </AppBar>

            {/* Rename Dialog */}
            <Dialog
                fullWidth
                maxWidth="xs"
                onClose={() => setIsEditingTitle(false)}
                open={isEditingTitle}
                PaperProps={{ sx: { borderRadius: '16px' } }}
            >
                <DialogTitle sx={{ fontWeight: 800 }}>Rename Room</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        fullWidth
                        label="Room / Sprint Title"
                        onChange={(e) => setNewTitle(e.target.value)}
                        sx={{ mt: 1 }}
                        value={newTitle}
                    />
                </DialogContent>
                <DialogActions sx={{ pb: 2, px: 3 }}>
                    <Button onClick={() => setIsEditingTitle(false)}>Cancel</Button>
                    <Button onClick={handleSaveTitle} variant="contained">
                        Save
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Copy Notification */}
            <Snackbar autoHideDuration={3000} onClose={() => setCopied(false)} open={copied}>
                <Alert severity="success" sx={{ width: '100%' }} variant="filled">
                    Invite link copied to clipboard! Share it with your team.
                </Alert>
            </Snackbar>
        </>
    );
};
