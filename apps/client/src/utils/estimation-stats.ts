import { CardValue, RoomState, Story } from '@planitpoker/shared';

/** Outlier boundary multiplier of the interquartile range (Tukey's rule). */
const OUTLIER_IQR_FACTOR = 1.5;

/** Fewest numeric votes needed before a spread says anything about outliers. */
const MIN_OUTLIERS_SAMPLE = 4;

/** One vote as the statistics see it. */
export interface VoteInput {
    name: string;
    vote: CardValue;
}

/** Everything the results panel and the summary derive from one round. */
export interface VoteStats {
    average: number | null;
    /** Share of votes carried by the most frequent card, in whole percent. */
    consensusPercentage: number;
    median: number | null;
    modeVote: string | null;
    numericVotes: number[];
    outliers: VoteInput[];
    standardDeviation: number | null;
    totalVotes: number;
    voteCounts: Record<string, number>;
}

/**
 * Reports whether a card carries a number, rather than `?`, `☕` or `L`.
 *
 * Numeric strings count as numbers because a custom deck is a list of strings:
 * a card saved as `"8"` is the same estimate as `8`.
 */
export const numericValueOf = (vote: CardValue): null | number => {
    if (typeof vote === 'string' && vote.trim() === '') {
        return null;
    }
    const parsed = Number(vote);
    return Number.isFinite(parsed) ? parsed : null;
};

/**
 * Median of the numeric votes.
 *
 * With an even count it is the midpoint of the two central values, which is the
 * convention a team expects when the estimator is an integer card.
 */
const medianOf = (values: number[]): null | number => {
    if (values.length === 0) {
        return null;
    }
    const sorted = [...values].sort((left, right) => left - right);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
};

/**
 * Population standard deviation of the numeric votes.
 *
 * The room is the whole population — these are not a sample of a larger group
 * of voters — so the divisor is `N` rather than `N - 1`.
 */
const standardDeviationOf = (values: number[], average: null | number): null | number => {
    if (values.length === 0 || average === null) {
        return null;
    }
    const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length;
    return Math.sqrt(variance);
};

/** Linear-interpolated quantile of an already sorted list. */
const quantileOf = (sorted: number[], fraction: number): number => {
    const position = (sorted.length - 1) * fraction;
    const lower = Math.floor(position);
    const upper = Math.ceil(position);
    if (lower === upper) {
        return sorted[lower];
    }
    return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
};

/**
 * Lists the votes outside 1.5 interquartile ranges from the box.
 *
 * A sample smaller than four says nothing about spread, and a deck of estimated
 * points is far too small for a tighter rule to be useful: a single high card
 * would be branded an outlier in any team of three.
 */
const outliersOf = (votes: VoteInput[]): VoteInput[] => {
    const numeric = votes
        .map((entry) => ({ entry, value: numericValueOf(entry.vote) }))
        .filter((item): item is { entry: VoteInput; value: number } => item.value !== null);

    if (numeric.length < MIN_OUTLIERS_SAMPLE) {
        return [];
    }

    const sorted = numeric.map((item) => item.value).sort((left, right) => left - right);
    const firstQuartile = quantileOf(sorted, 0.25);
    const thirdQuartile = quantileOf(sorted, 0.75);
    const spread = thirdQuartile - firstQuartile;
    const low = firstQuartile - OUTLIER_IQR_FACTOR * spread;
    const high = thirdQuartile + OUTLIER_IQR_FACTOR * spread;

    return numeric
        .filter((item) => item.value < low || item.value > high)
        .map((item) => item.entry);
};

/**
 * Formats a statistic for display.
 *
 * `null` means the round had no numeric card, which differs from zero: a team
 * that voted only `?` and `☕` has an undefined mean, not a mean of 0.
 *
 * @param value - The figure, or `null` when it cannot be computed.
 * @param decimals - How many decimals to keep.
 * @returns The figure ready to render.
 */
export const formatStatValue = (value: null | number, decimals: number): string =>
    value === null ? 'N/A' : value.toFixed(decimals);

/**
 * Aggregates the cards of one round.
 *
 * Symbolic cards (`?`, `☕`, `XL`) still shape the distribution and the mode,
 * but they cannot enter the numeric statistics.
 *
 * @param votes - The cards cast in the round.
 * @returns The aggregate statistics.
 */
export const computeVoteStats = (votes: VoteInput[]): VoteStats => {
    const voteCounts: Record<string, number> = {};
    const numericVotes: number[] = [];

    votes.forEach((entry) => {
        const key = String(entry.vote);
        voteCounts[key] = (voteCounts[key] ?? 0) + 1;
        const numeric = numericValueOf(entry.vote);
        if (numeric !== null) {
            numericVotes.push(numeric);
        }
    });

    const average =
        numericVotes.length > 0
            ? numericVotes.reduce((sum, value) => sum + value, 0) / numericVotes.length
            : null;
    const modeVote = Object.keys(voteCounts).reduce<null | string>(
        (best, key) => (best === null || voteCounts[key] > voteCounts[best] ? key : best),
        null
    );

    return {
        average,
        consensusPercentage:
            votes.length === 0
                ? 0
                : Math.round((Math.max(...Object.values(voteCounts)) / votes.length) * 100),
        median: medianOf(numericVotes),
        modeVote,
        numericVotes,
        outliers: outliersOf(votes),
        standardDeviation: standardDeviationOf(numericVotes, average),
        totalVotes: votes.length,
        voteCounts,
    };
};

/** One revealed round as the summary presents it. */
export interface SummaryRound {
    number: number;
    revealedAt: number;
    stats: VoteStats;
}

/** One story as the summary presents it. */
export interface SummaryStory {
    finalEstimate: null | string;
    rounds: SummaryRound[];
    storyId: string;
    title: string;
}

/** Everything the end-of-session summary shows. */
export interface SessionSummary {
    durationMs: null | number;
    estimatedStories: number;
    stories: SummaryStory[];
    totalPoints: number;
}

/** Sums the point values a team accepted, ignoring symbolic estimates. */
const totalPointsOf = (stories: Story[]): number =>
    stories.reduce((sum, story) => {
        const value =
            story.finalEstimate === null ? null : numericValueOf(story.finalEstimate ?? '');
        return value === null ? sum : sum + value;
    }, 0);

/**
 * Builds the end-of-session summary from the live room state.
 *
 * Rounds are already revealed snapshots, so no vote is ever shown before its
 * time: a story with no revealed round simply contributes no numbers.
 *
 * @param room - The room state received from the server.
 * @returns The summary of every story, its rounds and the session totals.
 */
export const buildSessionSummary = (room: RoomState): SessionSummary => {
    const stories: SummaryStory[] = room.stories.map((story) => ({
        finalEstimate:
            story.finalEstimate === null || story.finalEstimate === undefined
                ? null
                : String(story.finalEstimate),
        rounds: story.rounds.map((round, index) => ({
            number: index + 1,
            revealedAt: round.revealedAt,
            stats: computeVoteStats(
                round.votes.map((vote) => ({ name: vote.name, vote: vote.vote }))
            ),
        })),
        storyId: story.id,
        title: story.title,
    }));

    return {
        durationMs: room.endedAt === null ? null : Math.max(0, room.endedAt - room.createdAt),
        estimatedStories: stories.filter((story) => story.finalEstimate !== null).length,
        stories,
        totalPoints: totalPointsOf(room.stories),
    };
};
