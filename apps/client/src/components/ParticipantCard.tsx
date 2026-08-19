import StarIcon from '@mui/icons-material/Star';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { Box, Typography, Avatar } from '@mui/material';
import { Participant } from '@planitpoker/shared';
import React from 'react';

interface ParticipantCardProps {
  participant: Participant;
  votesRevealed: boolean;
  isSelf: boolean;
}

export const ParticipantCard: React.FC<ParticipantCardProps> = ({
  participant,
  votesRevealed,
  isSelf,
}) => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 1,
        width: 110,
        position: 'relative',
      }}
    >
      {/* Avatar Ring */}
      <Box
        sx={{
          position: 'relative',
          p: '3px',
          borderRadius: '50%',
          background: participant.hasVoted
            ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
            : participant.isSpectator
            ? 'transparent'
            : `linear-gradient(135deg, ${participant.color} 0%, #6366f1 100%)`,
          boxShadow: participant.hasVoted
            ? '0 0 16px rgba(16, 185, 129, 0.6)'
            : '0 4px 12px rgba(0,0,0,0.15)',
        }}
      >
        <Avatar
          sx={{
            width: 52,
            height: 52,
            bgcolor: participant.color,
            fontSize: '28px',
            border: isSelf ? '3px solid #fff' : '2px solid rgba(255,255,255,0.4)',
          }}
        >
          {participant.avatar}
        </Avatar>

        {participant.isHost && (
          <Box
            sx={{
              position: 'absolute',
              top: -6,
              right: -6,
              bgcolor: '#f59e0b',
              color: '#fff',
              borderRadius: '50%',
              width: 22,
              height: 22,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
            }}
          >
            <StarIcon sx={{ fontSize: 14 }} />
          </Box>
        )}
      </Box>

      {/* Name */}
      <Typography
        variant="caption"
        sx={{
          fontWeight: 700,
          color: 'text.primary',
          textAlign: 'center',
          maxWidth: '100px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          lineHeight: 1.2,
        }}
      >
        {participant.name} {isSelf && '(You)'}
      </Typography>

      {/* Card Seat / Voting visual */}
      <Box
        sx={{
          perspective: '1000px',
          width: 50,
          height: 70,
          mt: 0.5,
        }}
      >
        <Box
          sx={{
            width: '100%',
            height: '100%',
            position: 'relative',
            transition: 'transform 0.6s cubic-bezier(0.4, 0.2, 0.2, 1)',
            transformStyle: 'preserve-3d',
            transform: votesRevealed && participant.hasVoted ? 'rotateY(180deg)' : 'rotateY(0deg)',
          }}
        >
          {/* Card Front (Hidden or Thinking or Spectator or Voted card back) */}
          <Box
            sx={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              backfaceVisibility: 'hidden',
              borderRadius: '10px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              border: participant.hasVoted ? '2px solid #10b981' : '2px dashed rgba(148, 163, 184, 0.4)',
              background: participant.hasVoted
                ? 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)'
                : participant.isSpectator
                ? 'rgba(148, 163, 184, 0.1)'
                : 'rgba(255, 255, 255, 0.05)',
              boxShadow: participant.hasVoted ? '0 4px 12px rgba(16, 185, 129, 0.25)' : 'none',
            }}
          >
            {participant.isSpectator ? (
              <VisibilityOffIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
            ) : participant.hasVoted ? (
              <Typography variant="body2" sx={{ fontSize: '20px' }}>
                🃏
              </Typography>
            ) : (
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '11px' }}>
                ...
              </Typography>
            )}
          </Box>

          {/* Card Back (Revealed vote value) */}
          <Box
            sx={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              color: '#ffffff',
              boxShadow: '0 6px 16px rgba(99, 102, 241, 0.4)',
              border: '2px solid #818cf8',
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              {participant.vote !== null ? participant.vote : '?'}
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};
