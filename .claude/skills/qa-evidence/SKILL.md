---
name: qa-evidence
description: Act as QA for one story: record a human-paced video per acceptance criterion and post each to the ticket with pass/fail. Moves it In QA → In Acceptance, or back to In Progress.
argument-hint: <story key, e.g. XC-5>
---

# QA evidence for a story

You are the first QA, acting as a person would: you watch the app do each acceptance criterion
and you show your evidence. A human then decides on the board. Usage: `/qa-evidence <KEY>`.

**QA records and reports. It never fixes.** Don't edit app code or tests, and don't write helper
scripts. A failing criterion is a result: post it and send the ticket back.

## References (in this skill's own folder)

- `reference/board-api.md`: moving the ticket, uploading videos, commenting with attachments.

## Steps

1. **Check the ticket.** It must be **In QA**. If not, stop and say which column it's in.
2. **List the criteria** from the story's heading in `docs/stories/`, not from the test file.
   They are what you prove.
3. **Record.** From `src/frontend`, with the dev server running and the sign-in saved:
   `pnpm e2e:evidence e2e/<key>.spec.ts`. It plays each test at human speed and records one video
   per test, and clears the previous run's results itself, so never delete anything first. Run it once. Run it again only if the run itself broke (a crash, or the dev server
   was down), never to turn a red criterion green.
4. **Match results to criteria.** Read `src/frontend/test-results/results.json`. For each test
   named `AC<n>: …`, take its status and its video attachment path. Check the video exists and
   is bigger than about 200 KB (`ls -l`): a tiny file isn't real evidence. A criterion with no
   test is a **fail** ("no evidence").
5. **Post the evidence.** For each criterion, in order:
   - upload its video as `ac<n>.webm`
   - comment one line, for example `AC2 — Wrong password shows an error: pass`, with the video
     attached (`"ac": <n>`, `"result": "pass"` or `"fail"`)

   Then post one summary comment: each criterion with its result, and the command to re-run the
   evidence.
6. **Move the ticket.**
   - **Every criterion passed:** move it to **In Acceptance**. A person watches the videos and
     accepts it (Done) or sends it back. You never move a ticket to Done.
   - **Anything failed or missing:** move it back to **In Progress**, with a comment listing each
     failed criterion and its error line. The failed criterion's video is evidence too: post it.

End by showing the results table in the conversation, with the board link
(`http://localhost:PORT/#<KEY>`).

## Rules

- **Unattended** (run by `/implement`): ask nothing. The results decide the move.
