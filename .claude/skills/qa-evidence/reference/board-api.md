# Board API

The board server (`pnpm board`, from `src/frontend`) is the only way skills change the board.
Never edit `docs/tracker/board-data.js` by hand while it runs.

- **Port:** read it from `.board-server.json` in the repository root (`{"port": 4000, …}`).
  Use `4000` if that file is missing.
- **Check it's up:** `curl -s http://localhost:PORT/api/health` returns `{"ok":true,…}`. If it
  doesn't answer, stop and ask the person to start the board: `pnpm board` in `src/frontend`, in
  its own terminal.

## Move a ticket

```sh
curl -s -X POST http://localhost:PORT/api/items/XC-5/status \
  -H 'Content-Type: application/json' \
  -d '{"status":"In Progress","from":"New","role":"Developer","author":"Claude"}'
```

- `status`: one of `New`, `In Progress`, `In Review`, `In QA`, `In Acceptance`, `Done`.
- `from`: the column you expect the ticket to be in now.
- `role`: `Developer` for `/implement-story`; `QA` for `/review-pr` and `/qa-evidence`. The board
  enforces who may move what: a Developer moves between New, In Progress and In Review; QA moves
  between In Review, In QA and In Acceptance, and pushes back to In Progress; only a PO (a
  person) moves a ticket to Done.
- Pushing back to In Progress needs `"comment"`: the reason, which becomes the to-do list.
- **409** means a person moved the ticket since you looked. Stop work on that ticket, leave it
  where it is, and report it. Never move it back.

## Comment on a ticket

```sh
curl -s -X POST http://localhost:PORT/api/items/XC-5/comments \
  -H 'Content-Type: application/json' \
  -d '{"author":"Claude","role":"AI Dev","body":"Started from a1b2c3d."}'
```

Use the role of the step: `AI Dev` (implement), `AI Review` (review), `AI QA` (QA evidence).
Build the JSON with care (escape quotes and newlines), or write it to a file in `src/frontend/test-results/` (gitignored)
and pass it with `-d @file`.

## Upload a video and attach it to a comment

Upload the file. The server saves it under `docs/qa/<KEY>/` and returns its path:

```sh
curl -s -X POST "http://localhost:PORT/api/items/XC-5/attachments?name=ac1.webm" \
  --data-binary @src/frontend/test-results/<folder>/video.webm
# → {"path":"docs/qa/XC-5/ac1.webm","bytes":812345}
```

Then comment with that path as an attachment:

```sh
curl -s -X POST http://localhost:PORT/api/items/XC-5/comments \
  -H 'Content-Type: application/json' \
  -d '{"author":"Claude","role":"AI QA","body":"AC1 — Sign up with email and password: pass",
       "attachments":[{"type":"video","path":"docs/qa/XC-5/ac1.webm","label":"AC1","ac":1,"result":"pass"}]}'
```

`result` is `pass` or `fail`. The board shows the video inline under the comment.
