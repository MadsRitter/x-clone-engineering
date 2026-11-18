#!/usr/bin/env node
// PreToolUse hook: stop Claude from reading secret env files (.env, .env.local,
// .env.production, ...) while still allowing the committed templates
// (.env.example, .env.sample, .env.template).
//
// Plain Node with no dependencies, so it runs the same on macOS, Linux and Windows.
// It reads the hook payload from stdin and, to block, prints a
// hookSpecificOutput "deny" decision on stdout (exit 0). Anything else exits 0
// silently, so the normal permission flow runs.

const SAFE_SUFFIXES = new Set(["example", "sample", "template"]);

/** Last path segment, splitting on both / and \ so Windows paths work too. */
function baseName(p) {
  const parts = String(p).split(/[\\/]+/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : "";
}

/** True for .env and .env.<anything> except the safe templates. */
function isSecretEnvFile(p) {
  const name = baseName(p).toLowerCase();
  if (name === ".env") return true;
  if (!name.startsWith(".env.")) return false;
  const suffix = name.slice(".env.".length);
  return suffix !== "" && !SAFE_SUFFIXES.has(suffix);
}

/** Split a shell command into word-like tokens (quotes, redirects, separators). */
function shellTokens(command) {
  return String(command)
    .split(/[\s"'`;|&<>()=]+/)
    .filter(Boolean);
}

function findSecretPath(toolName, input = {}) {
  switch (toolName) {
    case "Read":
    case "Edit":
    case "Write":
    case "NotebookEdit":
      return [input.file_path, input.notebook_path].find((p) => p && isSecretEnvFile(p));
    case "Grep":
    case "Glob":
      return [input.path, input.glob, input.pattern && toolName === "Glob" ? input.pattern : null]
        .find((p) => p && isSecretEnvFile(p));
    case "Bash":
    case "PowerShell":
      return shellTokens(input.command).find(isSecretEnvFile);
    default:
      return undefined;
  }
}

function deny(file) {
  const reason =
    `Blocked: "${baseName(file)}" is a secret environment file and may hold API keys, ` +
    `tokens or passwords, so this project's PreToolUse hook does not let Claude read it. ` +
    `Use the committed template .env.example to learn which variables exist, ` +
    `and ask the user if you need a real value.`;
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
  const hit = findSecretPath(payload.tool_name, payload.tool_input);
  if (hit) deny(hit);
  process.exit(0);
});
