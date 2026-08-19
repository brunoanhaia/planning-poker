import MoreVertIcon from '@mui/icons-material/MoreVert';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import SecurityIcon from '@mui/icons-material/Security';
import StarIcon from '@mui/icons-material/Star';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import {
  Avatar,
  Box,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from '@mui/material';
import { Participant } from '@planitpoker/shared';
import React, { useState } from 'react';

import { useSocket } from '../context/SocketContext';

interface ParticipantCardProps {
  isSelf: boolean;
  participant: Participant;
  votesRevealed: boolean;
}

export const ParticipantCard: React.FC<ParticipantCardProps> = ({
  isSelf,
  participant,
  votesRevealed,
}) => {
  const { isAdmin, isHost, kickParticipant, promoteCoAdmin, toggleUserRole, transferAdmin } =
    useSocket();
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

  const handleOpenMenu = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    setMenuAnchor(e.currentTarget);
  };

  const handleCloseMenu = () => setMenuAnchor(null);

  const handleKick = () => {
    kickParticipant(participant.id);
    handleCloseMenu();
  };

  const handleToggleRole = () => {
    toggleUserRole(participant.id);
    handleCloseMenu();
  };

  const handlePromoteCoAdmin = () => {
    promoteCoAdmin(participant.id);
    handleCloseMenu();
  };

  const handleTransferAdmin = () => {
    transferAdmin(participant.id);
    handleCloseMenu();
  };

  return (
    <Box
      sx={{
        alignItems: 'center',
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5,
        position: 'relative',
        width: 110,
      }}
    >
      {/* Avatar Ring */}
      <Box
        sx={{
          background: participant.hasVoted
            ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
            : participant.isSpectator
              ? 'transparent'
              : `linear-gradient(135deg, ${participant.color} 0%, #6366f1 100%)`,
          borderRadius: '50%',
          boxShadow: participant.hasVoted
            ? '0 0 16px rgba(16, 185, 129, 0.6)'
            : '0 4px 12px rgba(0,0,0,0.15)',
          p: '3px',
          position: 'relative',
        }}
      >
        <Avatar
          sx={{
            bgcolor: participant.color,
            border: isSelf ? '3px solid #fff' : '2px solid rgba(255,255,255,0.4)',
            fontSize: '28px',
            height: 52,
            width: 52,
          }}
        >
          {participant.avatar}
        </Avatar>

        {/* Crown Badge */}
        {(participant.isHost || participant.isAdmin) && (
          <Tooltip title={participant.isHost ? 'Primary Room Admin / Host' : 'Co-Administrator'}>
            <Box
              sx={{
                alignItems: 'center',
                bgcolor: participant.isHost ? '#f59e0b' : '#8b5cf6',
                borderRadius: '50%',
                boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                color: '#fff',
                display: 'flex',
                height: 22,
                justifyContent: 'center',
                position: 'absolute',
                right: -6,
                top: -6,
                width: 22,
              }}
            >
              {participant.isHost ? '👑' : <StarIcon sx={{ fontSize: 13 }} />}
            </Box>
          </Tooltip>
        )}

        {/* Admin Quick Action Context Menu Trigger */}
        {isAdmin && !isSelf && (
          <Box
            sx={{
              bottom: -4,
              position: 'absolute',
              right: -6,
            }}
          >
            <IconButton
              onClick={handleOpenMenu}
              size="small"
              sx={{
                bgcolor: 'background.paper',
                boxShadow: 2,
                height: 20,
                p: 0,
                width: 20,
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              <MoreVertIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Box>
        )}
      </Box>

      {/* Participant Actions Menu */}
      <Menu anchorEl={menuAnchor} onClose={handleCloseMenu} open={Boolean(menuAnchor)}>
        <MenuItem onClick={handleToggleRole}>
          <ListItemIcon>
            <SwapHorizIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{participant.isSpectator ? 'Make Voter' : 'Make Spectator'}</ListItemText>
        </MenuItem>

        <MenuItem onClick={handlePromoteCoAdmin}>
          <ListItemIcon>
            <SecurityIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>
            {participant.isAdmin ? 'Demote from Co-Admin' : 'Promote to Co-Admin'}
          </ListItemText>
        </MenuItem>

        {isHost && (
          <MenuItem onClick={handleTransferAdmin}>
            <ListItemIcon>
              <StarIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Transfer Primary Host</ListItemText>
          </MenuItem>
        )}

        <MenuItem onClick={handleKick} sx={{ color: 'error.main' }}>
          <ListItemIcon sx={{ color: 'error.main' }}>
            <PersonRemoveIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Kick from Room</ListItemText>
        </MenuItem>
      </Menu>

      {/* Name */}
      <Typography
        sx={{
          color: 'text.primary',
          fontWeight: 700,
          lineHeight: 1.2,
          maxWidth: '100px',
          overflow: 'hidden',
          textAlign: 'center',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        variant="caption"
      >
        {participant.name} {isSelf && '(You)'}
      </Typography>

      {/* Card Seat / Voting visual */}
      <Box
        sx={{
          height: 70,
          mt: 0.5,
          perspective: '1000px',
          width: 50,
        }}
      >
        <Box
          sx={{
            height: '100%',
            position: 'relative',
            transform: votesRevealed && participant.hasVoted ? 'rotateY(180deg)' : 'rotateY(0deg)',
            transformStyle: 'preserve-3d',
            transition: 'transform 0.6s cubic-bezier(0.4, 0.2, 0.2, 1)',
            width: '100%',
          }}
        >
          {/* Card Front */}
          <Box
            sx={{
              alignItems: 'center',
              backfaceVisibility: 'hidden',
              background: participant.hasVoted
                ? 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)'
                : participant.isSpectator
                  ? 'rgba(148, 163, 184, 0.1)'
                  : 'rgba(255, 255, 255, 0.05)',
              border: participant.hasVoted
                ? '2px solid #10b981'
                : '2px dashed rgba(148, 163, 184, 0.4)',
              borderRadius: '10px',
              boxShadow: participant.hasVoted ? '0 4px 12px rgba(16, 185, 129, 0.25)' : 'none',
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              justifyContent: 'center',
              position: 'absolute',
              width: '100%',
            }}
          >
            {participant.isSpectator ? (
              <VisibilityOffIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
            ) : participant.hasVoted ? (
              <Typography sx={{ fontSize: '20px' }} variant="body2">
                🃏
              </Typography>
            ) : (
              <Typography
                sx={{ color: 'text.secondary', fontSize: '11px', fontWeight: 600 }}
                variant="caption"
              >
                ...
              </Typography>
            )}
          </Box>

          {/* Card Back (Revealed vote value) */}
          <Box
            sx={{
              alignItems: 'center',
              backfaceVisibility: 'hidden',
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              border: '2px solid #818cf8',
              borderRadius: '10px',
              boxShadow: '0 6px 16px rgba(99, 102, 241, 0.4)',
              color: '#ffffff',
              display: 'flex',
              height: '100%',
              justifyContent: 'center',
              position: 'absolute',
              transform: 'rotateY(180deg)',
              width: '100%',
            }}
          >
            <Typography sx={{ fontWeight: 800 }} variant="h6">
              {participant.vote !== null ? participant.vote : '?'}
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};
