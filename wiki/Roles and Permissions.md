# Roles and Permissions

> **Last verified:** 2026-11-26 against commit `c557e49`.
> Enforcement pointers at the bottom name where each rule lives in code.

## Two axes, not four roles

PlanItPoker is often described as having four roles: Administrator, Co-host, Voter and
Spectator. That shorthand hides how the system actually behaves. A participant has **two
independent attributes**:

| Axis          | Values                | What it decides      |
| ------------- | --------------------- | -------------------- |
| Moderation    | host · co-host · none | Who can run the room |
| Participation | voter · spectator     | Who casts cards      |

Consequences worth internalizing:

- **Moderation and voting are independent.** A host or co-host who is not a spectator votes
  like anyone else. Admins are not observers of the estimation — they can estimate with the
  team.
- **Every room starts with a spectator host.** The creator enters as host _and_ spectator, so
  voting starts only when they stage stories and flip their own switch. Moderation never waits
  for participation.
- **"Spectator" is a participation state, not a lesser member.** A spectator co-host still
  reveals votes, manages the backlog and ends sessions.

The classic four "roles" are just combinations of the two axes:

| Moderation | as Voter                    | as Spectator                |
| ---------- | --------------------------- | --------------------------- |
| Host       | the usual host              | **every room starts here**  |
| Co-host    | an admin who also estimates | an admin who only moderates |
| None       | a standard voter            | a pure observer             |

## Who can do what

### Running the room

The server applies one rule to every moderation action: it is allowed for the **host or any
co-host**. The single exception is transferring the primary host role, which only the host can
do.

| Action                                | Host | Co-host | Non-admin |
| ------------------------------------- | :--: | :-----: | :-------: |
| Rename the room                       |  ✅  |   ✅    |     —     |
| Lock / unlock the room (blocks joins) |  ✅  |   ✅    |     —     |
| Toggle auto-reveal                    |  ✅  |   ✅    |     —     |
| Start / pause / reset the timer       |  ✅  |   ✅    |     —     |
| Reveal votes                          |  ✅  |   ✅    |     —     |
| Reset votes (starts a new round)      |  ✅  |   ✅    |     —     |
| Set the active story                  |  ✅  |   ✅    |     —     |
| Finalize / adjust a story's estimate  |  ✅  |   ✅    |     —     |
| Add, bulk-import or delete stories    |  ✅  |   ✅    |     —     |
| Change the estimation deck            |  ✅  |   ✅    |     —     |
| End the session                       |  ✅  |   ✅    |     —     |
| Toggle another participant's role     |  ✅  |   ✅    |     —     |
| Promote / demote a co-host            |  ✅  |   ✅    |     —     |
| Kick a participant                    |  ✅  |   ✅¹   |     —     |
| **Transfer the primary host**         |  ✅  |  **—**  |     —     |

¹ Never the primary host: a kick targeting the current host is refused by the server, no
matter who orders it.

Behavior notes tied to these actions:

- **Reset votes reopens a finalized story**: the accepted estimate is cleared (the story goes
  back to `estimating`), while every recorded round survives. Re-voting never rewrites history.
- **Setting a story or changing the deck clears in-flight cards** — a voter mid-pick has to
  choose again on the new round.
- **An out-of-range story index is a bad request, not a permission problem**: the server
  answers `INVALID_STORY_INDEX` rather than "only admins", so real abuse stays visible in the
  audit log.
- **Ending a session is idempotent**: a retry or a stale tab cannot move the end timestamp,
  which is what the summary's duration is computed from.

### Participating

| Action                              | Who                                                  |
| ----------------------------------- | ---------------------------------------------------- |
| Vote                                | Any non-spectator (host and co-hosts included)       |
| Switch own voter / spectator status | Everyone — the switch sits in the top bar            |
| Copy the invite link                | Everyone — the room code in the top bar is clickable |

A vote is accepted only while **all** of these hold: the session is not ended, the current
round is not revealed, the card belongs to the active deck, the backlog has a story, and the
voter is not a spectator. The refusals are specific — `SESSION_ENDED`, `VOTES_REVEALED` or
`INVALID_VOTE` — instead of a blanket "not allowed".

An unauthorized moderation command from a non-admin answers `FORBIDDEN`, with one deliberate
exception: selecting a story index outside the backlog answers `INVALID_STORY_INDEX` even
before the permission check, because it is a malformed request rather than a power grab.

### Auto-reveal

With auto-reveal on, the round reveals itself the moment **every online voter** has cast a
card (at least one voter required). Offline voters and spectators are not waited on. The round
is recorded exactly once — the same guard covers a manual reveal that races the automatic one.

## Who sees what

| Information                        | Before reveal                                          | After reveal                             |
| ---------------------------------- | ------------------------------------------------------ | ---------------------------------------- |
| Other participants' card values    | Hidden — from admins too                               | Everyone, spectators included            |
| Your own card                      | Visible                                                | Visible                                  |
| Who has voted (roster badge)       | Everyone                                               | Everyone                                 |
| The deck                           | Voters pick cards; spectators see an "observer" notice | Results panel for everyone               |
| Timer countdown                    | Everyone sees it; only admins get controls             | Everyone sees it                         |
| First-run setup screen             | Admins stage the room; others see a waiting card       | —                                        |
| Results, statistics, round history | —                                                      | Everyone; accept controls are admin-only |
| Session summary                    | —                                                      | Opens for everyone when the session ends |

Two of those rows are deliberate product decisions, not accidents:

- **"Has voted" is public on purpose.** It is the moderation affordance that tells the host
  who is still thinking. Only the card _value_ is secret — the server nulls everyone else's
  `vote` in the state it sends you, but keeps `hasVoted` flowing.
- **Only revealed rounds exist.** There is no hidden history to leak: a round is recorded at
  the moment of reveal, with the card, the voter's name at that time, and the timestamp. A
  later rename cannot rewrite who voted what.

## How roles change

- **Creation.** The creator becomes host (with full moderation) and spectator (no cards).
  The room opens on the setup screen for them and a waiting card for everyone else.
- **Co-host appointment.** Any admin toggles any other participant between co-host and
  plain member. "Promote" and "demote" are the same switch.
- **Primary host transfer.** Host-only. The old host is demoted to a **plain voter** — both
  flags are cleared, so they lose co-host rights too, not just the crown. The new host may be
  a spectator, which simply recreates the state every room starts in.
- **Automatic succession.** When the host's connection closes — leaving, crashing, a network
  blip — the room immediately appoints the next **online co-host**, or failing that the next
  online participant. Reconnecting does **not** hand the crown back: the former host returns
  as an admin (their co-host-level rights survive) but only the new host can transfer it.
  This is the strongest argument for appointing a co-host early: the room stays administrable
  through a flaky connection.
- **Kick.** Removes the participant from the roster entirely (they are not an "offline" row),
  revokes their session tokens, bars re-entry for 5 minutes, and shows them a removal notice.
  The bar is advisory by design: it holds the revoked token and the browser identity cookie,
  and a client that discards both is admitted as a brand-new participant.
- **End of session.** New joins and votes are refused (a token-proven reconnect of an
  existing participant is still honored), the end timestamp freezes, and everyone gets the
  summary.

## Sharp edges

Honest documentation of behaviors you can run into:

1. **A momentary disconnect moves the crown.** Succession triggers on any socket close, and a
   reconnect never restores it. If the host's connection is flaky, appoint a co-host first.
2. **"Kick" is offered on the host's roster row** (any admin sees the menu on it), but the
   server always refuses — with a generic authorization error, not a "the host cannot be
   kicked" one.
3. **Promote is a toggle.** The same menu item demotes a co-host. Targeting the host with it
   flips a flag the host does not actually use (host authority comes from the room's `hostId`),
   so nothing visibly changes except the menu label on that row.
4. **Ending a session stops joins and votes — not moderation.** An admin can still reveal a
   pending round, edit the backlog or rename a closed room afterwards.
5. **A spectator keeps the card they already showed.** Switching to spectator after the
   reveal does not retract a revealed card; the round is frozen. Only Reset Votes alters a
   revealed round.
6. **Switching story or deck silently drops in-flight votes** — including yours, if you were
   mid-pick.

## For maintainers — where the rules live

Use these pointers to re-verify this page when the code moves:

- `apps/server/src/roomManager.ts` — `isUserAdmin` is the single moderation check
  (`hostId === userId || participant.isAdmin`); every room-level action calls it, and
  `transferAdmin` is the one method that checks `hostId` instead.
- `apps/server/src/participantService.ts` — every role transition: join and reconnect,
  automatic succession on leave, promote/demote, transfer, kick, the spectator toggles, and
  `sanitizeRoomStateForUser`, which decides what each recipient may see.
- `apps/server/src/webSocketHandler.ts` — per-message guards and their ordering (ended
  session and revealed-vote checks run before the domain call), plus the error codes sent.
- `apps/client/src/components/participants-panel/` and
  `participant-roster-row/` — which affordances the UI offers: the management menu appears
  for admins on **other** rows only, and the "Transfer host" item only for the current host.
- `apps/client/src/context/socket-context/socket-provider.tsx` — the client derives your own
  powers exactly the way the server does (`isAdmin = hostId === you || your isAdmin`), so the
  two derivations cannot drift.
