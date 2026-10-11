import { describe, expect, it } from 'vitest';

import { JoinFailureLimiter } from '../src/joinFailureLimiter.js';

/** A limiter with a small budget, driven by an explicit clock. */
const budgetOf = (): JoinFailureLimiter => new JoinFailureLimiter(3, 60_000, 60_000);

describe('JoinFailureLimiter', () => {
    it('allows joins while the address stays inside its budget', () => {
        const budget = budgetOf();

        budget.recordFailure('10.0.0.1', 1_000);
        budget.recordFailure('10.0.0.1', 1_100);

        expect(budget.allows('10.0.0.1', 1_200)).toBe(true);
    });

    it('bars the address once it spent the budget inside the window', () => {
        const budget = budgetOf();

        budget.recordFailure('10.0.0.1', 1_000);
        budget.recordFailure('10.0.0.1', 1_100);
        budget.recordFailure('10.0.0.1', 2_000);

        expect(budget.allows('10.0.0.1', 2_100)).toBe(false);
        expect(budget.barredAddresses).toBe(1);
    });

    it('lets the address back once the cool-down expires', () => {
        const budget = budgetOf();

        for (let attempt = 0; attempt < 3; attempt += 1) {
            budget.recordFailure('10.0.0.1', 1_000);
        }
        expect(budget.allows('10.0.0.1', 2_000)).toBe(false);

        expect(budget.allows('10.0.0.1', 1_000 + 60_000 + 1)).toBe(true);
        expect(budget.barredAddresses).toBe(0);
    });

    it('forgets misses that fell out of the window', () => {
        const budget = new JoinFailureLimiter(3, 10_000, 60_000);

        budget.recordFailure('10.0.0.1', 1_000);
        budget.recordFailure('10.0.0.1', 1_100);
        budget.recordFailure('10.0.0.1', 40_000);

        // Only the last miss is still inside the window, so the address is not barred.
        expect(budget.allows('10.0.0.1', 40_100)).toBe(true);
        expect(budget.barredAddresses).toBe(0);
    });

    it('lets the window, not a success, decay the misses', () => {
        // A reset on success would be an oracle: room creation is open to
        // anybody, so a guessing client could spend the budget, join a room of
        // its own and start again with a full allowance.
        const budget = budgetOf();

        budget.recordFailure('10.0.0.1', 1_000);
        budget.recordFailure('10.0.0.1', 1_100);
        budget.recordFailure('10.0.0.1', 2_000);

        expect(budget.allows('10.0.0.1', 2_100)).toBe(false);
        expect(budget.allows('10.0.0.1', 2_000 + 60_000 + 1)).toBe(true);
    });

    it('counts addresses independently', () => {
        const budget = budgetOf();

        for (let attempt = 0; attempt < 3; attempt += 1) {
            budget.recordFailure('10.0.0.1', 1_000);
        }

        expect(budget.allows('10.0.0.1', 2_000)).toBe(false);
        expect(budget.allows('10.0.0.2', 2_000)).toBe(true);
    });

    it('drops what expired when swept', () => {
        const budget = budgetOf();
        for (let attempt = 0; attempt < 3; attempt += 1) {
            budget.recordFailure('10.0.0.1', 1_000);
        }

        budget.sweep(1_000 + 60_000 + 1);

        expect(budget.barredAddresses).toBe(0);
        expect(budget.allows('10.0.0.1', 1_000 + 60_000 + 1)).toBe(true);
    });

    it('bounds how many addresses it tracks', () => {
        // A client cycling through distinct addresses leaves one record each, so
        // the tracked state needs a ceiling of its own.
        const budget = new JoinFailureLimiter(3, 60_000, 60_000, 10);

        for (let address = 0; address < 200; address += 1) {
            budget.recordFailure(`10.0.${address}.1`, 1_000);
        }

        expect(budget.trackedAddresses).toBe(10);
    });

    it('bounds the barred addresses too', () => {
        const budget = new JoinFailureLimiter(1, 60_000, 60_000, 10);

        for (let address = 0; address < 50; address += 1) {
            budget.recordFailure(`10.0.${address}.1`, 1_000);
        }

        expect(budget.barredAddresses).toBe(10);
    });

    it('keeps serving the address it just heard from', () => {
        const budget = new JoinFailureLimiter(3, 60_000, 60_000, 5);

        for (let address = 0; address < 20; address += 1) {
            budget.recordFailure(`10.0.${address}.1`, 1_000);
        }
        const newest = '10.0.19.1';

        expect(budget.trackedAddresses).toBe(5);
        budget.recordFailure(newest, 2_000);

        // The newest address survives the eviction, and its miss is still counted.
        budget.recordFailure(newest, 2_001);
        budget.recordFailure(newest, 2_002);
        expect(budget.allows(newest, 2_003)).toBe(false);
    });
});
