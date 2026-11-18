#!/usr/bin/env node
// PreToolUse hook: stop Claude from editing lockfiles and generated files
// (for example src/frontend/pnpm-lock.yaml and src/frontend/src/routeTree.gen.ts).
// Those files are written by tools, so a hand edit is either overwritten on the
// next run or leaves them out of step with what produced them.
//
// Plain Node with no dependencies, so it runs the same on macOS, Linux and Windows.
// It reads the hook payload from stdin and, to block, prints a
// hookSpecificOutput "deny" decision on stdout (exit 0). Anything else exits 0
// silently, so the normal permission flow runs.
//
// Only file-editing tools are checked. Bash is deliberately left alone, because
// `pnpm install` / `pnpm add` and `pnpm dev` / `pnpm build` are the right way to
// change these files and they run through Bash.

import { openSync, readSync, closeSync } from "node:fs";

/** Lockfiles by exact file name, with the command that should update each one. */
const LOCKFILES = new Map([
  ["pnpm-lock.yaml", "pnpm install / pnpm add / pnpm remove"],
  ["package-lock.json", "npm install"],
  ["npm-shrinkwrap.json", "npm install"],
  ["yarn.lock", "yarn install / yarn add"],
  ["bun.lock", "bun install"],
  ["bun.lockb", "bun install"],
  ["deno.lock", "deno install"],
  ["cargo.lock", "cargo update"],
  ["poetry.lock", "poetry lock"],
  ["uv.lock", "uv lock"],
  ["pipfile.lock", "pipenv lock"],
  ["gemfile.lock", "bundle install"],
  ["composer.lock", "composer update"],
  ["go.sum", "go mod tidy"],
]);

/** Known generated files in this repo, with how they are regenerated. */
const KNOWN_GENERATED = new Map([
  [
    "routetree.gen.ts",
    "TanStack Router regenerates it on `pnpm dev` / `pnpm build`; add or change a file under src/frontend/src/routes/ instead",
  ],
]);

/** Markers that tools put at the top of files they generate. */
const GENERATED_HEADER =
  /@generated\b|\bauto-?generated\b|\bautomatically generated\b|\bcode generated\b.*\bdo not edit\b|\bdo not edit\b.*\bgenerated\b/i;

/** Last path segment, splitting on both / and \ so Windows paths work too. */
function baseName(p) {
  const parts = String(p).split(/[\\/]+/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : "";
}

/** First few KB of a file, or "" if it doesn't exist or can't be read. */
function head(filePath, bytes = 2048) {
  let fd;
  try {
    fd = openSync(filePath, "r");
    const buf = Buffer.alloc(bytes);
    const n = readSync(fd, buf, 0, bytes, 0);
    return buf.toString("utf8", 0, n);
  } catch {
    return "";
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

/** Returns a deny reason for the path, or null if it may be edited. */
function reasonFor(filePath) {
  const name = baseName(filePath);
  const lower = name.toLowerCase();

  if (LOCKFILES.has(lower)) {
    return (
      `Blocked: "${name}" is a lockfile. The package manager writes it, and editing it by hand ` +
      `can break dependency installs. Change the dependency in package.json, or run ` +
      `${LOCKFILES.get(lower)}, and let the tool update the lockfile.`
    );
  }

  if (KNOWN_GENERATED.has(lower)) {
    return (
      `Blocked: "${name}" is a generated file, and any hand edit is overwritten the next time it is ` +
      `generated. ${KNOWN_GENERATED.get(lower)}.`
    );
  }

  if (/\.gen\.[^.\\/]+$/i.test(name) || /\.generated\.[^.\\/]+$/i.test(name)) {
    return (
      `Blocked: "${name}" is a generated file (its name marks it as generated), and any hand edit ` +
      `is overwritten the next time it is generated. Change its source and regenerate it instead.`
    );
  }

  const top = head(filePath).split(/\r?\n/).slice(0, 15).join("\n");
  if (GENERATED_HEADER.test(top)) {
    return (
      `Blocked: "${name}" is a generated file (its header says so), and any hand edit is ` +
      `overwritten the next time it is generated. Change its source and regenerate it instead.`
    );
  }

  return null;
}

function targetPath(toolName, input = {}) {
  switch (toolName) {
    case "Edit":
    case "Write":
    case "MultiEdit":
      return input.file_path;
    case "NotebookEdit":
      return input.notebook_path ?? input.file_path;
    default:
      return undefined;
  }
}

let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (raw += chunk));
process.stdin.on("end", () => {
  let payload;
  try {
    payload = JSON.parse(raw || "{}");
  } catch {
    // Unparseable input: make no decision rather than break every tool call.
    process.exit(0);
  }
  const file = targetPath(payload.tool_name, payload.tool_input);
  const reason = file ? reasonFor(file) : null;
  if (reason) {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason: reason,
        },
      }),
    );
  }
  process.exit(0);
});
