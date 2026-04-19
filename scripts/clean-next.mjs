#!/usr/bin/env node
import { rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const nextDir = join(dirname(fileURLToPath(import.meta.url)), "..", ".next");
rmSync(nextDir, { recursive: true, force: true });
console.log("[clean-next] Removed .next");
