#!/usr/bin/env node
// Fails when requirements.md holds a numbered requirement the wiki trace does
// not map — and when the trace carries a number no requirement backs. This is
// the mechanical half of the update-requirements rule; the prose half lives in
// .agents/rules/update-requirements.md.
//
// Usage: node scripts/check-requirements-trace.mjs [requirements.md] ["wiki/Requirements Trace.md"]
import { readFileSync } from 'node:fs';

const [requirementsPath = 'requirements.md', tracePath = 'wiki/Requirements Trace.md'] =
    process.argv.slice(2);

/** Splits a markdown file into `## ` sections keyed by normalized heading text. */
const sectionsOf = (markdown) => {
    const sections = new Map();
    const lines = markdown.split('\n');
    let heading = null;
    let buffer = [];
    for (const line of lines) {
        if (/^##\s/.test(line)) {
            if (heading !== null) {
                sections.set(heading, buffer);
            }
            heading = line
                .replace(/[‐‑–—-]/g, '-')
                .toLowerCase()
                .trim();
            buffer = [];
        } else if (heading !== null) {
            buffer.push(line);
        }
    }
    if (heading !== null) {
        sections.set(heading, buffer);
    }
    return sections;
};

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
        const match = line.match(/^\|\s*(\d+)\s*(?:[‐‑–—-]\s*(\d+))?\s*\|/);
        if (!match) {
            continue;
        }
        const from = Number(match[1]);
        const to = match[2] === undefined ? from : Number(match[2]);
        for (let n = from; n <= to; n += 1) {
            numbers.add(n);
        }
    }
    return numbers;
};

const requirements = sectionsOf(readFileSync(requirementsPath, 'utf8'));
const trace = sectionsOf(readFileSync(tracePath, 'utf8'));

const failures = [];
for (const part of ['functional', 'non-functional']) {
    const required = requirementNumbers(requirements.get(headingKey(requirements, part)));
    const traced = traceNumbers(trace.get(headingKey(trace, part)));

    const unmapped = [...required].filter((n) => !traced.has(n)).sort((a, b) => a - b);
    const stale = [...traced].filter((n) => !required.has(n)).sort((a, b) => a - b);
    console.log(
        `${part}: ${required.size} requirements, ${traced.size} trace rows` +
            (unmapped.length === 0 && stale.length === 0 ? ' — ok' : ' — MISMATCH')
    );
    if (unmapped.length > 0) {
        failures.push(`requirements without a trace row (${part}): ${unmapped.join(', ')}`);
    }
    if (stale.length > 0) {
        failures.push(`trace rows without a requirement (${part}): ${stale.join(', ')}`);
    }
}

if (failures.length > 0) {
    console.error(failures.map((f) => `FAIL ${f}`).join('\n'));
    process.exit(1);
}
