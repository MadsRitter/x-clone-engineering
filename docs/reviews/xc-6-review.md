# XC-6 review: Sign in

Base commit reviewed: `b214494` → head `2c3def0`. Reviewer: fresh-eyes subagent (`.claude/skills/review-pr/reviewers/code-reviewer.md`), given only the story, the PRD's non-functional requirements and out-of-scope list, `CLAUDE.md`, the commit messages and the diff.

**Verdict: APPROVE**

## Blocking

None.

## Non-blocking

1. `src/frontend/e2e/xc-6.spec.ts` (`createAccount`): every run leaves three throwaway `example.test` accounts on the shared API. This is acceptable, because sign-in needs a real email and password. A line in the header comment saying the accounts pile up on purpose would help.
2. `src/frontend/e2e/xc-6.spec.ts`: about 7 sign-up/sign-in requests go out within seconds in `verify`. If the shared API rate-limits `/sign-in` or `/sign-up`, a 429 could look like a test failure. Watch for this in QA. No change is needed unless it happens.
3. `src/frontend/e2e/xc-6.spec.ts` (`createAccount`): a failed `expect(res.ok())` skips `api.dispose()`. Dispose before asserting, or use try/finally.

## Criteria → tests

- AC1 → "AC1: I can sign in by entering my email and password": ok. It starts with no session, goes through the real form, checks the response is OK, then polls get-session for the account's email.
- AC2 → "AC2: After signing in, I am taken to the home timeline": ok. It checks the URL is `/` and that the loaded timeline shows (the feed or "No tweets yet."), the welcome heading uses the account's name, Sign out is visible (never clicked), and the timeline still shows after a reload.
- AC3 → "AC3: If my email or password is wrong, I see a clear message and stay signed out": ok. It tries a wrong password and an unknown email. Both show exactly "Incorrect email or password.", stay on /sign-in, and get-session returns null. `/` still redirects to /sign-in.

## Other checks

Only the spec changed. It adds no backend work, API calls or generated-file edits, and no hard-coded origin (NF5 and conventions ok). It runs in a fresh signed-out state, imports from `./fixtures`, wraps actions in `evidence.step`, and has no secrets, skips or debug leftovers.
