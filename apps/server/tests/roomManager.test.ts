import { MAX_ROUNDS_PER_STORY } from '@planitpoker/shared';
import { beforeEach, describe, expect, it } from 'vitest';

import { RoomManager } from '../src/roomManager.js';

describe('RoomManager Administrator Suite Unit Tests', () => {
    let rm: RoomManager;

    beforeEach(() => {
        rm = new RoomManager();
    });

    it('should create room with creator as primary admin and host', () => {
        const { hostId, roomId, roomState } = rm.createRoom('Alice', '🚀', '#6366f1', 'Sprint 42')!;

        expect(roomId).toHaveLength(8);
        expect(roomState.title).toBe('Sprint 42');
        expect(roomState.hostId).toBe(hostId);
        expect(roomState.participants[0].isAdmin).toBe(true);
        expect(roomState.participants[0].isHost).toBe(true);
        expect(rm.isUserAdmin(roomState, hostId)).toBe(true);
    });

    it('should allow admin to rename room and reject non-admin', () => {
        const { hostId, roomId } = rm.createRoom('Alice', '🚀', '#6366f1')!;
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
        const { hostId, roomId } = rm.createRoom('Alice', '🚀', '#6366f1')!;
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
        const { hostId, roomId } = rm.createRoom('Alice', '🚀', '#6366f1')!;
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
        const { hostId, roomId } = rm.createRoom('Alice', '🚀', '#6366f1')!;

        rm.startTimer(roomId, hostId, 60);
        const initialRoom = rm.getRoom(roomId)!;
        expect(initialRoom.timer?.remaining).toBe(60);
        expect(initialRoom.timer?.isRunning).toBe(true);

        rm.tickTimer(roomId);
        const tickedRoom = rm.getRoom(roomId)!;
        expect(tickedRoom.timer?.remaining).toBe(59);

        rm.pauseTimer(roomId, hostId);
        const pausedRoom = rm.getRoom(roomId)!;
        expect(pausedRoom.timer?.isRunning).toBe(false);

        rm.resetTimer(roomId, hostId);
        const resetRoom = rm.getRoom(roomId)!;
        expect(resetRoom.timer?.remaining).toBe(60);
    });

    it('should allow admin to kick participant and toggle participant role', () => {
        const { hostId, roomId } = rm.createRoom('Alice', '🚀', '#6366f1')!;
        const bobResult = rm.joinRoom(roomId, 'Bob', '🎨', '#3b82f6')!;
        const bobId = bobResult.participant!.id;

        // Admin forces Bob to spectator
        rm.toggleUserRole(roomId, hostId, bobId);
        expect(rm.getRoom(roomId)!.participants.find((p) => p.id === bobId)?.isSpectator).toBe(
            true
        );

        // Admin kicks Bob
        rm.kickParticipant(roomId, hostId, bobId);
        expect(rm.getRoom(roomId)!.participants.find((p) => p.id === bobId)).toBeUndefined();
    });

    it('should allow promoting co-admins and transferring primary admin', () => {
        const { hostId, roomId } = rm.createRoom('Alice', '🚀', '#6366f1')!;
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
        const { hostId, roomId } = rm.createRoom('Alice', '🚀', '#6366f1')!;

        rm.bulkAddStories(roomId, hostId, [
            { title: 'Story 1', description: 'Desc 1' },
            { title: 'Story 2', description: 'Desc 2' },
            { title: 'Story 3' },
        ]);

        const room = rm.getRoom(roomId)!;
        expect(room.stories).toHaveLength(4); // 1 initial + 3 bulk

        const targetStoryId = room.stories[1].id;
        rm.updateStoryEstimate(roomId, hostId, targetStoryId, 13);
        expect(rm.getRoom(roomId)!.stories[1].finalEstimate).toBe(13);
        expect(rm.getRoom(roomId)!.stories[1].status).toBe('completed');

        rm.endSession(roomId, hostId);
        expect(rm.getRoom(roomId)!.isEnded).toBe(true);
    });

    it('should refuse a new participant once the session has ended', () => {
        const { hostId, roomId } = rm.createRoom('Alice', '🚀', '#6366f1')!;

        rm.endSession(roomId, hostId);

        const refused = rm.joinRoom(roomId, 'Latecomer', '🐱', '#10b981')!;
        expect(refused.participant).toBeUndefined();
        expect(refused.code).toBe('SESSION_ENDED');
        expect(refused.error).toContain('ended');
        expect(rm.getRoom(roomId)!.participants).toHaveLength(1);
    });

    it('should still let a participant of an ended session reconnect', () => {
        const { hostId, roomId } = rm.createRoom('Alice', '🚀', '#6366f1')!;
        const bobResult = rm.joinRoom(roomId, 'Bob', '🎨', '#3b82f6')!;
        const bobId = bobResult.participant!.id;

        rm.endSession(roomId, hostId);
        // The reload path that matters is the offline one: the participant drops,
        // then comes back with the token it kept.
        rm.leaveRoom(roomId, bobId);

        const reconnected = rm.joinRoom(roomId, 'Bob', '🎨', '#3b82f6', bobId)!;
        expect(reconnected.participant?.id).toBe(bobId);
        expect(reconnected.participant?.isOnline).toBe(true);
    });

    it('should only allow admin or co-host to reveal votes and reject non-admin', () => {
        const { hostId, roomId } = rm.createRoom('Alice', '🚀', '#6366f1')!;
        const bobResult = rm.joinRoom(roomId, 'Bob', '🎨', '#3b82f6')!;
        const bobId = bobResult.participant!.id;
        const charlieResult = rm.joinRoom(roomId, 'Charlie', '🐱', '#10b981')!;
        const charlieId = charlieResult.participant!.id;

        // Bob (non-admin) tries to reveal votes -> rejected
        const nonAdminReveal = rm.revealVotes(roomId, bobId);
        expect(nonAdminReveal).toBeNull();
        expect(rm.getRoom(roomId)!.votesRevealed).toBe(false);

        // Promote Charlie to Co-Admin
        rm.promoteCoAdmin(roomId, hostId, charlieId);

        // Charlie (co-admin) can reveal votes
        const coAdminReveal = rm.revealVotes(roomId, charlieId);
        expect(coAdminReveal).not.toBeNull();
        expect(rm.getRoom(roomId)!.votesRevealed).toBe(true);

        // Reset votes
        rm.resetVotes(roomId, hostId);
        expect(rm.getRoom(roomId)!.votesRevealed).toBe(false);

        // Alice (primary admin) can reveal votes
        const adminReveal = rm.revealVotes(roomId, hostId);
        expect(adminReveal).not.toBeNull();
        expect(rm.getRoom(roomId)!.votesRevealed).toBe(true);
    });

    it('records one revealed round per reveal and keeps the votes as they were', () => {
        const { hostId, roomId } = rm.createRoom('Alice', '🚀', '#6366f1')!;
        const bobId = rm.joinRoom(roomId, 'Bob', '🎨', '#3b82f6')!.participant!.id;

        rm.submitVote(roomId, hostId, 5);
        rm.submitVote(roomId, bobId, 8);
        rm.revealVotes(roomId, hostId);

        const story = rm.getRoom(roomId)!.stories[0];
        expect(story.rounds).toHaveLength(1);
        expect(story.rounds[0].votes.map((vote) => vote.vote)).toEqual([5, 8]);
        expect(story.rounds[0].votes[1].name).toBe('Bob');

        // A second reveal of an already visible round must not append a copy.
        rm.revealVotes(roomId, hostId);
        expect(rm.getRoom(roomId)!.stories[0].rounds).toHaveLength(1);
    });

    it('opens a new round on reset instead of erasing the previous result', () => {
        const { hostId, roomId } = rm.createRoom('Alice', '🚀', '#6366f1')!;

        rm.submitVote(roomId, hostId, 3);
        rm.revealVotes(roomId, hostId);
        rm.resetVotes(roomId, hostId);
        rm.submitVote(roomId, hostId, 13);
        rm.revealVotes(roomId, hostId);

        const story = rm.getRoom(roomId)!.stories[0];
        expect(story.rounds.map((round) => round.votes[0].vote)).toEqual([3, 13]);
    });

    it('keeps the newest rounds when the story is re-estimated past the cap', () => {
        const { hostId, roomId } = rm.createRoom('Alice', '🚀', '#6366f1')!;

        for (let round = 0; round <= MAX_ROUNDS_PER_STORY; round += 1) {
            rm.submitVote(roomId, hostId, round);
            rm.revealVotes(roomId, hostId);
            rm.resetVotes(roomId, hostId);
        }

        const story = rm.getRoom(roomId)!.stories[0];
        expect(story.rounds).toHaveLength(MAX_ROUNDS_PER_STORY);
        expect(story.rounds[story.rounds.length - 1].votes[0].vote).toBe(MAX_ROUNDS_PER_STORY);
    });

    it('stamps the end of the session for the summary duration', () => {
        const { hostId, roomId } = rm.createRoom('Alice', '🚀', '#6366f1')!;
        expect(rm.getRoom(roomId)!.endedAt).toBeNull();

        rm.endSession(roomId, hostId);

        expect(rm.getRoom(roomId)!.isEnded).toBe(true);
        expect(rm.getRoom(roomId)!.endedAt).toBeTypeOf('number');
    });
});
