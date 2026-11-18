---
name: review-pr
description: Fresh-eyes review of one story's change set against its acceptance criteria, the PRD's non-functional requirements and the code conventions. Moves it In Review → In QA, or back to In Progress.
argument-hint: <story key, e.g. XC-5>
---

# Review a story's change set

Reviews what `/implement-story` built for one story, the way a colleague reviews a pull request:
with fresh eyes, and without the builder's reasoning. Usage: `/review-pr <KEY>`.

## References (in this skill's own folder)

- `reviewers/code-reviewer.md`: the reviewer's instructions. The reviewer runs as a separate
  subagent.
- `reference/board-api.md`: how to move a ticket and comment on it.

## Steps

1. **Check the ticket.** It must be **In Review**. If not, stop and say which column it's in.
2. **Find the change set.** The ticket's `Started` comment names the base commit. The change set
   is `git diff <base>..HEAD`, plus the commit messages since the base.
3. **Review with fresh eyes.** Start a general-purpose subagent, not a fork, with
   `reviewers/code-reviewer.md` as its instructions. Give it only:
   - the story's heading in `docs/stories/`, with its acceptance criteria
   - the PRD's Non-Functional Requirements section
   - `CLAUDE.md`
   - the diff and the commit messages

   Not this conversation. If subagents aren't available, follow `reviewers/code-reviewer.md`
   yourself, reading only those inputs.
4. **Save the review** to `docs/reviews/<key>-review.md` (key in lower case) with the reviewer's
   verdict, its findings in order of severity, and the base commit reviewed.
5. **Decide.**
   - **Approve** (no blocking findings): move the ticket to **In QA**. Comment with the verdict and
     each non-blocking finding in one line.
   - **Changes needed:** move the ticket back to **In Progress**. Comment with each blocking
     finding: the file, the line, and what must change.

## Rules

- The review never edits code or tests. It only reads, writes the review file, and comments.
- **Unattended** (run by `/implement`): ask nothing. The verdict decides the move.
