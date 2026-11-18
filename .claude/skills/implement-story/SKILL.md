---
name: implement-story
description: Build one story from the board, test-first: a Playwright test per acceptance criterion, then the code, looping until every test is green. Moves it New → In Progress → In Review.
argument-hint: <story key, e.g. XC-5>
---

# Implement a story

Builds one story so that every acceptance criterion is proven by a test and nothing that already
worked breaks. Usage: `/implement-story <KEY>`. Run from the repository root.

## References (in this skill's own folder)

- `reference/factory-loop.md`: the self-verification loop. Follow it exactly.
- `reference/board-api.md`: how to move a ticket and comment on it.

## Steps

1. **Find the story.** Look up `<KEY>` in `docs/tracker/board-data.js`, then open its heading
   in `docs/stories/` (the item's `source`). Read its acceptance criteria, its `Covers` IDs and
   the PRD lines they point to, including the PRD's Non-Functional Requirements and Out of
   Scope. If the key isn't on the board, stop and say so. If the ticket is In Acceptance or Done,
   stop: there's nothing to build.
2. **Start.** Move the ticket to **In Progress** and comment `Started` with the commit you start
   from (`git rev-parse --short HEAD`). That commit is the story's base: the review compares
   against it.
3. **Write the tests first.** Create `src/frontend/e2e/<key>.spec.ts` (key in lower case, for
   example `xc-5.spec.ts`). Write one test per acceptance criterion, named
   `AC<n>: <the criterion in a few words>`, in the criterion's order. Import `test` and
   `expect` from `./fixtures`. Wrap each user action in `evidence.step("…", …)` with a short
   caption: the QA videos show these. Each test must check what its criterion says, not
   something easier.
4. **Build.** Change the app in `src/frontend/src/` following `CLAUDE.md`: reuse
   `components/ui/` and the `queries/` pattern, and keep the existing code style. Add Vitest
   tests for any logic you add. Never edit generated files or the story text.
5. **Verify.** Run the loop in `reference/factory-loop.md` until everything is green, or until it
   tells you to stop.
6. **Hand over.**
   - **Green:** commit with the message `<KEY>: <story title>`. Move the ticket to
     **In Review** and comment: the files changed, each check and its result, and anything a
     reviewer should look at.
   - **Stopped:** leave the ticket **In Progress** and comment what blocks it and the last
     failing output. Don't commit broken work.

## Rules

- Never weaken, skip or delete a test to get green. Change a test only when it is wrong about its
  criterion, and say so in the hand-over comment.
- Never move a ticket past In Review. Review, QA and acceptance are other steps.
- No scratch, probe or debug files anywhere in the repo.
- **Unattended** (run by `/implement`): ask nothing. Make the call a person would have made, and
  list each decision in the hand-over comment.
