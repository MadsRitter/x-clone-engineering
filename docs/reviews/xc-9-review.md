# XC-9 review: Post a tweet

Base commit reviewed: `cec4f08` → head `06a1901`. Reviewer: fresh-eyes subagent (`.claude/skills/review-pr/reviewers/code-reviewer.md`), given only the story, the PRD's non-functional requirements and out-of-scope list, `CLAUDE.md`, the commit messages and the diff.

Note: the first pass was given a story excerpt cut one line short, so it missed AC4 and reported that criterion as not in the story. The reviewer was then given the full story and reviewed again. This file records that second, complete review.

**Verdict: APPROVE**

## Blocking

None.

## Non-blocking

1. `src/frontend/src/queries/tweets.ts:6-8`: the story leaves the limits "Not known yet". The code uses the shared API's own rules (280 characters, 5 MB, JPEG/PNG/WebP/GIF) and says so in a comment. Raise these with the product owner so the PRD can record them.
2. `src/frontend/e2e/xc-9.spec.ts:94-95, 121-123`: `firstTweet` assumes no one else posts between this run's post and the check. After AC2's reload, someone else's newer tweet could push it down, so the test can fail when nothing is wrong. Consider finding the tweet by its unique content instead.
3. `src/frontend/src/components/timeline/composer.tsx:28,48`: once a file is rejected, `imageError` stays on screen until another file is picked, even after a successful text-only post. Clear it in `onSuccess`, and probably in the textarea's `onChange` too.
4. `src/frontend/src/components/timeline/composer.tsx:452`: only one message shows at a time (`tooLong ?? imageError ?? postError`). This is acceptable.
5. `src/frontend/e2e/xc-9.spec.ts:148`: the AC4 e2e test doesn't try text that is too long with an image attached. The unit test `canPost` covers that case, so this is optional.
6. `src/frontend/src/components/timeline/composer.tsx:431-444`: NF1 says posts should feel instant on a slow connection, but the box shows "Posting…" until the upload and the create both finish. This is acceptable for now. Consider an optimistic insert for text-only tweets later.

## Criteria → tests

- AC1 → "AC1: I can type a tweet and post it, with or without one image": ok
- AC2 → "AC2: My new tweet appears at the top of my timeline straight away": ok
- AC3 → "AC3: I cannot post an empty tweet": ok
- AC4 → "AC4: If the tweet is too long or the image is not allowed, I see a clear message": ok. It checks 280 vs 281 characters, a non-image file, a file over 5 MB (none of which send a request), and an image the API rejects by its bytes (the API's reason shows and the text is kept).

## Other checks

Conventions are met: `components/ui` Button and Textarea are reused, the API calls are in `src/queries/tweets.ts` (`mutationOptions`, `credentials: "include"`), there is no hard-coded origin, no generated file is edited, and nothing is skipped and no debug code is left.
