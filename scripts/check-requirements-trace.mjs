#!/usr/bin/env node
// Fails when requirements.md holds a numbered requirement the docs trace does
// not map — and when the trace carries a number no requirement backs. This is
// the mechanical half of the update-requirements rule; the prose half lives in
// .agents/rules/update-requirements.md.
//
// Usage: node scripts/check-requirements-trace.mjs [requirements.md] ["docs/requirements-trace.md"]
import { readFile } from 'node:fs/promises';

/** True when the line opens a `## ` section. */
const isSectionHeading = (line) => /^##\s/.test(line);

/** Normalizes a heading line into the key sections are stored under. */
const normalizeHeading = (line) =>
    line
        .replace(/[‐‑–—-]/g, '-')
        .toLowerCase()
        .trim();

/** Splits a markdown file into `## ` sections keyed by normalized heading text. */
const sectionsOf = (markdown) => {
    const sections = new Map();
    let current = null;
    for (const line of markdown.split('\n')) {
        if (isSectionHeading(line)) {
            current = normalizeHeading(line);
            sections.set(current, []);
        } else if (current !== null) {
            sections.get(current).push(line);
        }
    }
    return sections;
};

/** Finds the `## ` section key that holds a given requirements part. */
const headingKey = (sections, part) => {
    for (const key of sections.keys()) {
        if (key.includes('functional') && key.includes('non') === (part === 'non-functional')) {
            return key;
        }
    }
    throw new Error(`no "${part} requirements" section found`);
};

/** Numbers of `N.` list items in a section body. */
const requirementNumbers = (body) => {
    const numbers = new Set();
    for (const line of body) {
        const match = line.match(/^(\d+)\./);
        if (match) {
            numbers.add(Number(match[1]));
        }
    }
    return numbers;
};

/** Row numbers of a trace table, expanding `a–b` / `a-b` ranges. */
const traceNumbers = (body) => {
    const numbers = new Set();
    for (const line of body) {
        if (!line.startsWith('|')) {
            continue;
        }
        // A row is parsed cell by cell: anchored and unambiguous, so no
        // backtracking can make the scan super-linear on long rows.
        const cells = line.split('|').map((cell) => cell.trim());
        const range = /^(\d+)(?:[‐‑–—-](\d+))?$/.exec(cells[1] ?? '');
        if (!range) {
            continue;
        }
        const from = Number(range[1]);
        const to = range[2] === undefined ? from : Number(range[2]);
        for (let numberInRange = from; numberInRange <= to; numberInRange += 1) {
            numbers.add(numberInRange);
        }
    }
    return numbers;
};

/** Numbers present on one side of the comparison and missing from the other. */
const difference = (left, right) =>
    [...left].filter((number) => !right.has(number)).sort((a, b) => a - b);

/** Compares one requirements part and returns the failure lines it produces. */
const comparePart = (part, requirements, trace) => {
    const required = requirementNumbers(requirements.get(headingKey(requirements, part)));
    const traced = traceNumbers(trace.get(headingKey(trace, part)));
    const unmapped = difference(required, traced);
    const stale = difference(traced, required);
    const ok = unmapped.length === 0 && stale.length === 0;
    process.stdout.write(
        `${part}: ${required.size} requirements, ${traced.size} trace rows` +
            (ok ? ' — ok' : ' — MISMATCH') +
            '\n'
    );
    const failures = [];
    unmapped.forEach((number) =>
        failures.push(`requirements without a trace row (${part}): ${number}`)
    );
    stale.forEach((number) =>
        failures.push(`trace rows without a requirement (${part}): ${number}`)
    );
    return failures;
};

const main = async () => {
    const [requirementsPath = 'requirements.md', tracePath = 'docs/requirements-trace.md'] =
        process.argv.slice(2);
    const [requirementsText, traceText] = await Promise.all([
        readFile(requirementsPath, 'utf8'),
        readFile(tracePath, 'utf8'),
    ]);
    const requirements = sectionsOf(requirementsText);
    const trace = sectionsOf(traceText);
    const failures = ['functional', 'non-functional'].flatMap((part) =>
        comparePart(part, requirements, trace)
    );
    if (failures.length > 0) {
        process.stderr.write(`${failures.map((failure) => `FAIL ${failure}`).join('\n')}\n`);
        // `process.exit()` drops pending writes, and stdout is a pipe when the
        // gate runs in CI — the exit code alone lets the streams flush.
        process.exitCode = 1;
    }
};

await main();
