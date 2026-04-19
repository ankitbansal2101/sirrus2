#!/usr/bin/env node
/**
 * Starts `next dev` on the first free port from PORT (default 3000) upward.
 * Avoids EADDRINUSE when an old dev server or another app still holds 3000.
 *
 * Pass `--clean` once to delete `.next` before starting (fixes missing chunk / manifest
 * errors after HMR, interrupted builds, or mixed Turbopack/Webpack runs).
 *
 * Default `npm run dev` uses Webpack — Turbopack (`--turbopack`) can throw ENOENT on
 * `app-build-manifest.json` / `_buildManifest.js.tmp.*` after refresh on some setups; use
 * `npm run dev:turbo` only if you want Turbopack.
 */
import { rmSync } from "node:fs";
import net from "node:net";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const rawArgs = process.argv.slice(2);
const wantClean = rawArgs.includes("--clean");
const passThrough = rawArgs.filter((a) => a !== "--clean");
if (wantClean) {
  rmSync(join(root, ".next"), { recursive: true, force: true });
  console.log("\n[dev] Removed .next (clean start).\n");
}

function portFree(port) {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.once("error", () => resolve(false));
    s.once("listening", () => s.close(() => resolve(true)));
    s.listen(port, "0.0.0.0");
  });
}

async function pickPort(start, maxTries = 30) {
  for (let p = start; p < start + maxTries; p++) {
    if (await portFree(p)) return p;
  }
  throw new Error(`No free TCP port found between ${start} and ${start + maxTries - 1}`);
}

const explicit = process.env.PORT;
const preferred = explicit ? Number(explicit) : 3000;
if (explicit && (Number.isNaN(preferred) || preferred < 1)) {
  console.error(`Invalid PORT="${explicit}"`);
  process.exit(1);
}

const port = await pickPort(preferred);
if (!explicit && port !== 3000) {
  console.warn(`\n[dev] Port 3000 is in use — starting on http://localhost:${port} instead.\n`);
}

const nextBin = join(root, "node_modules", "next", "dist", "bin", "next");

const child = spawn(process.execPath, [nextBin, "dev", "-p", String(port), ...passThrough], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, PORT: String(port) },
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
