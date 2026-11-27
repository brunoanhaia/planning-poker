# Session Summary and Export

> **Last verified:** 2026-11-26 against commit `4dd98ef`.

The summary is the room's receipt: it opens once, for everyone, when the host ends the
session, and it is built entirely from the state the server already broadcast — so it keeps
working even if the socket drops mid-review, and no vote is ever requested a second time.

## What it shows

| Statistic         | Computed as                                                           |
| ----------------- | --------------------------------------------------------------------- |
| Estimated stories | Stories with an accepted estimate, over the total (`7/9` style)       |
| Total points      | Sum of the **numeric** accepted estimates — symbolic ones are skipped |
| Rounds            | Every revealed round across all stories                               |
| Duration          | `endedAt − createdAt`, formatted `h:mm:ss` or `m:ss`                  |

Below the totals, each story lists its accepted estimate and the round-by-round breakdown —
cards as they stood, the voters' names at reveal time, and the full statistics per round
(average, median, deviation, outliers). Stories without an accepted estimate are counted out
loud ("2 stories without an estimate").

The end timestamp is **frozen**: ending twice, or a stale tab retrying the end, cannot move
it — the duration you read is the duration that happened.

## The CSV export

One row **per revealed round**, in backlog order:

| Column                            | Content                                                        |
| --------------------------------- | -------------------------------------------------------------- |
| Story                             | The story title                                                |
| Final Estimate                    | The accepted estimate, or empty                                |
| Round                             | 1-based round number                                           |
| Votes                             | Cards cast in that round                                       |
| Average / Median / Std. Deviation | Numeric statistics of the round, or empty when no numeric card |
| Outliers                          | Voters outside 1.5 × IQR, by name                              |

- A story with **no revealed round** still gets one row, with its title and final estimate —
  it is part of what happened.
- The header stays in English on purpose: it is the column name a spreadsheet formula and
  another tool expect, not interface copy.
- **The export is safe to open.** Cells starting with a formula trigger (`=`, `+`, `-`, `@`,
  tab, CR) are prefixed with a single quote, embedded quotes are doubled, and the filename is
  a sanitized slug: the summary file is `<slug>_Session_Summary.csv` (at most 60 characters, fixed `.csv` extension the title cannot influence), while the backlog export keeps its own `_Backlog_Estimates` suffix — so the two files never share a name.

## After the end

The session is closed for good: new joins and votes are refused with `SESSION_ENDED`, while a
participant who was already inside may still reconnect. The summary itself can be reopened
from the ended-session banner at any time.
