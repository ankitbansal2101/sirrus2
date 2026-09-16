import { createJiti } from "jiti";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

const jiti = createJiti(import.meta.url, {
  alias: {
    "@": root,
  },
});

await jiti.import("./leads-server.ts");
