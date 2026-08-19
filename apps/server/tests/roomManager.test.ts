import { beforeEach, describe, expect, it } from 'vitest';

import { RoomManager } from '../src/roomManager.js';

describe('RoomManager Administrator Suite Unit Tests', () => {
  let rm: RoomManager;

  beforeEach(() => {
    rm = new RoomManager();
  });

  it('should create room with creator as primary admin and host', () => {
    const { hostId, roomId, roomState } = rm.createRoom('Alice', '🚀', '#6366f1', 'Sprint 42');

    expect(roomId).toHaveLength(6);
    expect(roomState.title).toBe('Sprint 42');
    expect(roomState.hostId).toBe(hostId);
    expect(roomState.participants[0].isAdmin).toBe(true);
    expect(roomState.participants[0].isHost).toBe(true);
    expect(rm.isUserAdmin(roomState, hostId)).toBe(true);
  });

  it('should allow admin to rename room and reject non-admin', () => {
    const { hostId, roomId } = rm.createRoom('Alice', '🚀', '#6366f1');
    const bobResult = rm.joinRoom(roomId, 'Bob', '🎨', '#3b82f6')!;
    const bobId = bobResult.participant!.id;

    // Bob cannot rename
    const failedRename = rm.updateRoomTitle(roomId, bobId, 'Hacked Title');
    expect(failedRename).toBeNull();
    expect(rm.getRoom(roomId)!.title).not.toBe('Hacked Title');

    // Alice can rename
    const successRename = rm.updateRoomTitle(roomId, hostId, 'New Sprint Title');
    expect(successRename).not.toBeNull();
    expect(rm.getRoom(roomId)!.title).toBe('New Sprint Title');
  });

  it('should lock room and reject new participants while allowing existing ones', () => {
    const { hostId, roomId } = rm.createRoom('Alice', '🚀', '#6366f1');
    const bobResult = rm.joinRoom(roomId, 'Bob', '🎨', '#3b82f6')!;
    const bobId = bobResult.participant!.id;

    // Lock room
    rm.toggleLockRoom(roomId, hostId);
    expect(rm.getRoom(roomId)!.isLocked).toBe(true);

    // New participant rejected
    const charlieResult = rm.joinRoom(roomId, 'Charlie', '🐱', '#10b981');
    expect(charlieResult?.error).toBeDefined();

    // Existing participant re-join allowed
    const bobRejoin = rm.joinRoom(roomId, 'Bob Updated', '🎨', '#3b82f6', bobId);
    expect(bobRejoin?.participant?.name).toBe('Bob Updated');
  });

  it('should handle auto-reveal when all active voters cast votes', () => {
    const { hostId, roomId } = rm.createRoom('Alice', '🚀', '#6366f1');
    const bobResult = rm.joinRoom(roomId, 'Bob', '🎨', '#3b82f6')!;
    const bobId = bobResult.participant!.id;

    // Enable auto-reveal
    rm.toggleAutoReveal(roomId, hostId);
    expect(rm.getRoom(roomId)!.autoReveal).toBe(true);

    // Alice votes -> not all voted yet
    rm.submitVote(roomId, hostId, 5);
    expect(rm.getRoom(roomId)!.votesRevealed).toBe(false);

    // Bob votes -> all active voted -> auto-revealed!
    rm.submitVote(roomId, bobId, 8);
    expect(rm.getRoom(roomId)!.votesRevealed).toBe(true);
  });

  it('should manage live countdown timer', () => {
    const { hostId, roomId } = rm.createRoom('Alice', '🚀', '#6366f1');

    rm.startTimer(roomId, hostId, 60);
    let room = rm.getRoom(roomId)!;
    expect(room.timer?.remaining).toBe(60);
    expect(room.timer?.isRunning).toBe(true);

    rm.tickTimer(roomId);
    room = rm.getRoom(roomId)!;
    expect(room.timer?.remaining).toBe(59);

    rm.pauseTimer(roomId, hostId);
    room = rm.getRoom(roomId)!;
    expect(room.timer?.isRunning).toBe(false);

    rm.resetTimer(roomId, hostId);
    room = rm.getRoom(roomId)!;
    expect(room.timer?.remaining).toBe(60);
  });

  it('should allow admin to kick participant and toggle participant role', () => {
    const { hostId, roomId } = rm.createRoom('Alice', '🚀', '#6366f1');
    const bobResult = rm.joinRoom(roomId, 'Bob', '🎨', '#3b82f6')!;
    const bobId = bobResult.participant!.id;

    // Admin forces Bob to spectator
    rm.toggleUserRole(roomId, hostId, bobId);
    expect(rm.getRoom(roomId)!.participants.find((p) => p.id === bobId)?.isSpectator).toBe(true);

    // Admin kicks Bob
    rm.kickParticipant(roomId, hostId, bobId);
    expect(rm.getRoom(roomId)!.participants.find((p) => p.id === bobId)).toBeUndefined();
  });

  it('should allow promoting co-admins and transferring primary admin', () => {
    const { hostId, roomId } = rm.createRoom('Alice', '🚀', '#6366f1');
    const bobResult = rm.joinRoom(roomId, 'Bob', '🎨', '#3b82f6')!;
    const bobId = bobResult.participant!.id;

    // Promote Bob to Co-Admin
    rm.promoteCoAdmin(roomId, hostId, bobId);
    expect(rm.isUserAdmin(rm.getRoom(roomId)!, bobId)).toBe(true);

    // Transfer primary host
    rm.transferAdmin(roomId, hostId, bobId);
    const room = rm.getRoom(roomId)!;
    expect(room.hostId).toBe(bobId);
    expect(room.participants.find((p) => p.id === bobId)?.isHost).toBe(true);
    expect(room.participants.find((p) => p.id === hostId)?.isHost).toBe(false);
  });

  it('should allow bulk story import, estimate acceptance and session ending', () => {
    const { hostId, roomId } = rm.createRoom('Alice', '🚀', '#6366f1');

    rm.bulkAddStories(roomId, hostId, [
      { title: 'Story 1', description: 'Desc 1' },
      { title: 'Story 2', description: 'Desc 2' },
      { title: 'Story 3' },
    ]);

    const room = rm.getRoom(roomId)!;
    expect(room.stories.length).toBe(4); // 1 initial + 3 bulk

    const targetStoryId = room.stories[1].id;
    rm.updateStoryEstimate(roomId, hostId, targetStoryId, 13);
    expect(rm.getRoom(roomId)!.stories[1].finalEstimate).toBe(13);
    expect(rm.getRoom(roomId)!.stories[1].status).toBe('completed');

    rm.endSession(roomId, hostId);
    expect(rm.getRoom(roomId)!.isEnded).toBe(true);
  });
});
