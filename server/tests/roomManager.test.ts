import { describe, it, expect, beforeEach } from 'vitest';
import { RoomManager } from '../src/roomManager.js';

describe('RoomManager Unit Tests', () => {
  let rm: RoomManager;

  beforeEach(() => {
    rm = new RoomManager();
  });

  it('should create a new room with host participant', () => {
    const { roomId, hostId, roomState } = rm.createRoom('Alice', '🚀', '#6366f1', 'Sprint Planning');

    expect(roomId).toHaveLength(6);
    expect(roomState.title).toBe('Sprint Planning');
    expect(roomState.hostId).toBe(hostId);
    expect(roomState.participants).toHaveLength(1);
    expect(roomState.participants[0].name).toBe('Alice');
    expect(roomState.participants[0].isHost).toBe(true);
  });

  it('should allow multiple participants to join room', () => {
    const { roomId } = rm.createRoom('Alice', '🚀', '#6366f1');
    const joinResult = rm.joinRoom(roomId, 'Bob', '🎨', '#3b82f6');

    expect(joinResult).not.toBeNull();
    expect(joinResult?.roomState.participants).toHaveLength(2);
    expect(joinResult?.roomState.participants[1].name).toBe('Bob');
    expect(joinResult?.roomState.participants[1].isHost).toBe(false);
  });

  it('should handle voting, status flag and reveal privacy', () => {
    const { roomId, hostId } = rm.createRoom('Alice', '🚀', '#6366f1');
    const bobResult = rm.joinRoom(roomId, 'Bob', '🎨', '#3b82f6');
    const bobId = bobResult!.participant.id;

    rm.submitVote(roomId, hostId, 5);
    rm.submitVote(roomId, bobId, 8);

    const roomBeforeReveal = rm.getRoom(roomId)!;
    expect(roomBeforeReveal.votesRevealed).toBe(false);

    // Sanitize state check for Bob (should not see Alice's vote)
    const bobSanitized = rm.sanitizeStateForUser(roomBeforeReveal, bobId);
    const aliceInBobView = bobSanitized.participants.find((p) => p.id === hostId);
    expect(aliceInBobView?.hasVoted).toBe(true);
    expect(aliceInBobView?.vote).toBeNull();

    // Reveal votes
    rm.revealVotes(roomId, hostId);
    const roomAfterReveal = rm.getRoom(roomId)!;
    expect(roomAfterReveal.votesRevealed).toBe(true);
    expect(roomAfterReveal.participants.find((p) => p.id === hostId)?.vote).toBe(5);
    expect(roomAfterReveal.participants.find((p) => p.id === bobId)?.vote).toBe(8);
  });

  it('should handle spectator mode toggling', () => {
    const { roomId, hostId } = rm.createRoom('Alice', '🚀', '#6366f1');
    rm.submitVote(roomId, hostId, 3);
    expect(rm.getRoom(roomId)?.participants[0].hasVoted).toBe(true);

    rm.toggleSpectator(roomId, hostId);
    const room = rm.getRoom(roomId)!;
    expect(room.participants[0].isSpectator).toBe(true);
    expect(room.participants[0].hasVoted).toBe(false);
    expect(room.participants[0].vote).toBeNull();
  });

  it('should reset votes and allow story backlog management', () => {
    const { roomId, hostId } = rm.createRoom('Alice', '🚀', '#6366f1');
    rm.addStory(roomId, 'User Login API', 'OAuth2 & JWT authentication');

    const room = rm.getRoom(roomId)!;
    expect(room.stories).toHaveLength(2);
    expect(room.stories[1].title).toBe('User Login API');

    rm.submitVote(roomId, hostId, 13);
    rm.revealVotes(roomId, hostId);
    rm.resetVotes(roomId, hostId);

    const resetRoom = rm.getRoom(roomId)!;
    expect(resetRoom.votesRevealed).toBe(false);
    expect(resetRoom.participants[0].vote).toBeNull();
  });
});
