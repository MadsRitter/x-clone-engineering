# XC-7 review: Keep the app behind sign-in

Base commit reviewed: `6cc6257` → head `5aba33e`. Reviewer: fresh-eyes subagent (`.claude/skills/review-pr/reviewers/code-reviewer.md`), given only the story, the PRD's non-functional requirements and out-of-scope list, `CLAUDE.md`, the commit messages and the diff.

**Verdict: APPROVE**

## Blocking

None.

## Non-blocking

1. `src/frontend/e2e/xc-7.spec.ts:83`: the "Going back" step checks only the heading. Adding `await expect(page).toHaveURL(/\/sign-in$/)` would prove the visitor really is on sign-in.
2. `src/frontend/e2e/xc-7.spec.ts:15`: nothing runs at phone width (NF2). The guard doesn't depend on width, so this isn't blocking, but one 375×812 pass over a single path would cover it cheaply.
3. `src/frontend/src/components/not-found.tsx:15-23`: the signed-in "Page not found" screen goes slightly past the story. It is small, reuses `Button`, and is unit-tested, so it can stay.

## Criteria → tests

- AC1 → "AC1: When I am not signed in, I can only see the sign-in and sign-up screens": ok
- AC2 → "AC2: If I open any other page while signed out, I am sent to the sign-in screen": ok
