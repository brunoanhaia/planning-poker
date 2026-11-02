import { MAX_ROUNDS_PER_STORY } from '@planitpoker/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RoomManager } from '../src/roomManager.js';

describe('RoomManager Administrator Suite Unit Tests', () => {
    let rm: RoomManager;

    beforeEach(() => {
        rm = new RoomManager();
    });

    /** Turns the spectating host into a voter, which is what voting cases need. */
    const makeHostVoter = (roomId: string, hostId: string): void => {
        rm.toggleSpectator(roomId, hostId);
    };

    it('should create room with creator as primary admin and host', () => {
        const { hostId, roomId, roomState } = rm.createRoom('Alice', '🚀', '#6366f1', 'Sprint 42')!;

        expect(roomId).toHaveLength(8);
        expect(roomState.title).toBe('Sprint 42');
        expect(roomState.hostId).toBe(hostId);
        expect(roomState.participants[0].isAdmin).toBe(true);
        expect(roomState.participants[0].isHost).toBe(true);
        expect(rm.isUserAdmin(roomState, hostId)).toBe(true);
        // A new room starts with nothing to estimate, and the host watches
        // until they decide to vote.
        expect(roomState.stories).toEqual([]);
        expect(roomState.participants[0].isSpectator).toBe(true);
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

        // The host starts as a spectator, so this case only reaches two active
        // voters once the host joins the round.
        makeHostVoter(roomId, hostId);
        rm.addStory(roomId, hostId, 'Story 1');

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
        const charlieResult = rm.joinRoom(roomId, 'Charlie', '🐱', '#10b981')!;
        const charlieId = charlieResult.participant!.id;

        // Promote Bob to Co-Admin
        rm.promoteCoAdmin(roomId, hostId, bobId);
        expect(rm.isUserAdmin(rm.getRoom(roomId)!, bobId)).toBe(true);

        // Transfer primary host to Charlie, who was a plain voter
        rm.transferAdmin(roomId, hostId, charlieId);
        const room = rm.getRoom(roomId)!;
        const oldHost = room.participants.find((p) => p.id === hostId)!;
        const newHost = room.participants.find((p) => p.id === charlieId)!;

        expect(room.hostId).toBe(charlieId);
        expect(newHost.isHost).toBe(true);
        expect(newHost.isAdmin).toBe(true);
        // The previous host falls back to a plain voter, while the co-admin
        // promoted separately keeps the flag granted to them.
        expect(oldHost.isHost).toBe(false);
        expect(oldHost.isAdmin).toBe(false);
        expect(rm.isUserAdmin(room, hostId)).toBe(false);
        expect(rm.isUserAdmin(room, bobId)).toBe(true);
        expect(rm.isUserAdmin(room, charlieId)).toBe(true);
    });

    it('should allow bulk story import, estimate acceptance and session ending', () => {
        const { hostId, roomId } = rm.createRoom('Alice', '🚀', '#6366f1')!;

        rm.bulkAddStories(roomId, hostId, [
            { title: 'Story 1', description: 'Desc 1' },
            { title: 'Story 2', description: 'Desc 2' },
            { title: 'Story 3' },
        ]);

        const room = rm.getRoom(roomId)!;
        expect(room.stories).toHaveLength(3);

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

        makeHostVoter(roomId, hostId);
        rm.addStory(roomId, hostId, 'Story 1');
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

    it.each([false, true])('rejects votes after reveal (auto-reveal: %s)', (autoReveal) => {
        const { hostId, roomId } = rm.createRoom('Alice', '🚀', '#6366f1')!;
        makeHostVoter(roomId, hostId);
        rm.addStory(roomId, hostId, 'Story 1');
        if (autoReveal) {
            rm.toggleAutoReveal(roomId, hostId);
        }
        expect(rm.submitVote(roomId, hostId, 3)).not.toBeNull();
        if (!autoReveal) {
            expect(rm.submitVote(roomId, hostId, 5)).not.toBeNull();
            rm.revealVotes(roomId, hostId);
        }
        const revealedRoom = structuredClone(rm.getRoom(roomId)!);

        expect(rm.submitVote(roomId, hostId, 8)).toBeNull();
        expect(rm.getRoom(roomId)).toEqual(revealedRoom);

        rm.resetVotes(roomId, hostId);
        expect(rm.submitVote(roomId, hostId, 8)).not.toBeNull();
        expect(rm.getRoom(roomId)!.participants[0].vote).toBe(8);
    });

    it('rejects a first vote submitted after reveal', () => {
        const { hostId, roomId } = rm.createRoom('Alice', '🚀', '#6366f1')!;
        const bobId = rm.joinRoom(roomId, 'Bob', '🎨', '#3b82f6')!.participant!.id;
        makeHostVoter(roomId, hostId);
        rm.addStory(roomId, hostId, 'Story 1');
        rm.submitVote(roomId, hostId, 5);
        rm.revealVotes(roomId, hostId);
        const revealedRoom = structuredClone(rm.getRoom(roomId)!);

        expect(rm.submitVote(roomId, bobId, 8)).toBeNull();
        expect(rm.getRoom(roomId)).toEqual(revealedRoom);
    });

    it('opens a new round on reset instead of erasing the previous result', () => {
        const { hostId, roomId } = rm.createRoom('Alice', '🚀', '#6366f1')!;
        makeHostVoter(roomId, hostId);
        rm.addStory(roomId, hostId, 'Story 1');

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
        makeHostVoter(roomId, hostId);
        rm.addStory(roomId, hostId, 'Story 1');

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

    it('keeps the original end timestamp when the session is ended twice', () => {
        const { hostId, roomId } = rm.createRoom('Alice', '🚀', '#6366f1')!;
        const clock = vi.spyOn(Date, 'now').mockReturnValue(1_000);

        rm.endSession(roomId, hostId);
        clock.mockReturnValue(9_000);
        rm.endSession(roomId, hostId);

        expect(rm.getRoom(roomId)!.endedAt).toBe(1_000);
        clock.mockRestore();
    });

    it('records the round when auto-reveal flips the flag inside the last vote', () => {
        const { hostId, roomId } = rm.createRoom('Alice', '🚀', '#6366f1')!;
        makeHostVoter(roomId, hostId);
        rm.addStory(roomId, hostId, 'Story 1');
        rm.toggleAutoReveal(roomId, hostId);

        rm.submitVote(roomId, hostId, 5);

        const story = rm.getRoom(roomId)!.stories[0];
        expect(rm.getRoom(roomId)!.votesRevealed).toBe(true);
        expect(story.rounds).toHaveLength(1);
        expect(story.rounds[0].votes).toHaveLength(1);

        // A manual reveal afterwards must not append a second copy of the round.
        rm.revealVotes(roomId, hostId);
        expect(rm.getRoom(roomId)!.stories[0].rounds).toHaveLength(1);
    });

    it('keeps the vote of a voter who becomes a spectator after the reveal', () => {
        const { hostId, roomId } = rm.createRoom('Alice', '🚀', '#6366f1')!;
        const bobId = rm.joinRoom(roomId, 'Bob', '🎨', '#3b82f6')!.participant!.id;

        makeHostVoter(roomId, hostId);
        rm.addStory(roomId, hostId, 'Story 1');
        rm.submitVote(roomId, hostId, 3);
        rm.submitVote(roomId, bobId, 5);
        rm.revealVotes(roomId, hostId);

        rm.toggleUserRole(roomId, hostId, bobId);

        const bob = rm.getRoom(roomId)!.participants.find((p) => p.id === bobId)!;
        expect(bob.isSpectator).toBe(true);
        expect(bob.vote).toBe(5);
        expect(bob.hasVoted).toBe(true);
    });

    it('clears the vote of a voter who becomes a spectator before the reveal', () => {
        const { hostId, roomId } = rm.createRoom('Alice', '🚀', '#6366f1')!;
        const bobId = rm.joinRoom(roomId, 'Bob', '🎨', '#3b82f6')!.participant!.id;

        rm.submitVote(roomId, bobId, 5);
        rm.toggleUserRole(roomId, hostId, bobId);

        const bob = rm.getRoom(roomId)!.participants.find((p) => p.id === bobId)!;
        expect(bob.isSpectator).toBe(true);
        expect(bob.vote).toBeNull();
        expect(bob.hasVoted).toBe(false);
    });

    it('reopens a finalized story on reset without losing the round history', () => {
        const { hostId, roomId } = rm.createRoom('Alice', '🚀', '#6366f1')!;
        makeHostVoter(roomId, hostId);
        rm.addStory(roomId, hostId, 'Story 1');

        rm.submitVote(roomId, hostId, 5);
        rm.revealVotes(roomId, hostId);
        rm.updateStoryEstimate(roomId, hostId, rm.getRoom(roomId)!.stories[0].id, 5);
        expect(rm.getRoom(roomId)!.stories[0].status).toBe('completed');

        rm.resetVotes(roomId, hostId);

        const room = rm.getRoom(roomId)!;
        expect(room.stories[0].finalEstimate).toBeNull();
        expect(room.stories[0].status).toBe('estimating');
        expect(room.votesRevealed).toBe(false);
        expect(room.stories[0].rounds).toHaveLength(1);
    });

    it('starts a room with an empty backlog and nothing active', () => {
        const { roomId } = rm.createRoom('Alice', '🚀', '#6366f1')!;

        const room = rm.getRoom(roomId)!;
        expect(room.stories).toEqual([]);
        // The index is a sentinel that addresses nothing; the client shows the
        // setup screen for a room that is not ended and has no stories.
        expect(room.currentStoryIndex).toBe(0);
        expect(room.votesRevealed).toBe(false);
        expect(room.isEnded).toBe(false);
    });

    it('activates the first story added to an empty backlog', () => {
        const { hostId, roomId } = rm.createRoom('Alice', '🚀', '#6366f1')!;

        rm.addStory(roomId, hostId, 'Checkout flow');

        const room = rm.getRoom(roomId)!;
        expect(room.stories).toHaveLength(1);
        expect(room.currentStoryIndex).toBe(0);
        expect(room.stories[0].status).toBe('estimating');
    });

    it('activates only the first story of a bulk import and keeps the order', () => {
        const { hostId, roomId } = rm.createRoom('Alice', '🚀', '#6366f1')!;

        rm.bulkAddStories(roomId, hostId, [
            { title: 'Story 1' },
            { title: 'Story 2' },
            { title: 'Story 3' },
        ]);

        const room = rm.getRoom(roomId)!;
        expect(room.stories.map((story) => story.title)).toEqual(['Story 1', 'Story 2', 'Story 3']);
        expect(room.currentStoryIndex).toBe(0);
        expect(room.stories.map((story) => story.status)).toEqual([
            'estimating',
            'pending',
            'pending',
        ]);
    });

    it('leaves the active story and the revealed state alone when adding to a backlog', () => {
        const { hostId, roomId } = rm.createRoom('Alice', '🚀', '#6366f1')!;
        makeHostVoter(roomId, hostId);
        rm.addStory(roomId, hostId, 'Story 1');
        rm.submitVote(roomId, hostId, 5);
        rm.revealVotes(roomId, hostId);
        const activeStoryId = rm.getRoom(roomId)!.stories[0].id;

        rm.bulkAddStories(roomId, hostId, [{ title: 'Story 2' }, { title: 'Story 3' }]);

        const room = rm.getRoom(roomId)!;
        expect(room.votesRevealed).toBe(true);
        expect(room.currentStoryIndex).toBe(0);
        expect(room.stories[0].id).toBe(activeStoryId);
        expect(room.stories[0].status).toBe('estimating');
        expect(room.stories[1].status).toBe('pending');
    });

    it('auto-reveals without waiting for the spectating host', () => {
        const { roomId } = rm.createRoom('Alice', '🚀', '#6366f1')!;
        const bobId = rm.joinRoom(roomId, 'Bob', '🎨', '#3b82f6')!.participant!.id;
        rm.addStory(roomId, rm.getRoom(roomId)!.hostId, 'Story 1');
        rm.toggleAutoReveal(roomId, rm.getRoom(roomId)!.hostId);

        rm.submitVote(roomId, bobId, 8);

        const room = rm.getRoom(roomId)!;
        expect(room.votesRevealed).toBe(true);
        expect(room.participants.find((p) => p.id === room.hostId)!.vote).toBeNull();
    });

    it('keeps the spectating host as moderator while letting them become a voter', () => {
        const { hostId, roomId } = rm.createRoom('Alice', '🚀', '#6366f1')!;
        const bobId = rm.joinRoom(roomId, 'Bob', '🎨', '#3b82f6')!.participant!.id;
        rm.addStory(roomId, hostId, 'Story 1');

        // Moderation does not depend on voting.
        expect(rm.updateRoomTitle(roomId, hostId, 'Renamed')!.title).toBe('Renamed');
        expect(rm.submitVote(roomId, bobId, 3)).not.toBeNull();
        expect(rm.submitVote(roomId, hostId, 5)).toBeNull();

        rm.toggleSpectator(roomId, hostId);

        expect(rm.getRoom(roomId)!.participants[0].isSpectator).toBe(false);
        expect(rm.submitVote(roomId, hostId, 5)).not.toBeNull();
        expect(rm.getRoom(roomId)!.participants[0].vote).toBe(5);
        expect(rm.isUserAdmin(rm.getRoom(roomId)!, hostId)).toBe(true);
    });

    it('resets the votes and stops the timer when the last story is deleted', () => {
        const { hostId, roomId } = rm.createRoom('Alice', '🚀', '#6366f1')!;
        makeHostVoter(roomId, hostId);
        rm.addStory(roomId, hostId, 'Story 1');
        rm.submitVote(roomId, hostId, 5);
        rm.startTimer(roomId, hostId, 60);
        const storyId = rm.getRoom(roomId)!.stories[0].id;

        rm.deleteStory(roomId, hostId, storyId);

        const room = rm.getRoom(roomId)!;
        expect(room.stories).toEqual([]);
        expect(room.votesRevealed).toBe(false);
        expect(room.participants[0].vote).toBeNull();
        expect(room.participants[0].hasVoted).toBe(false);
        expect(room.timer?.isRunning).toBe(false);
        expect(room.timer?.remaining).toBe(60);
    });
});
