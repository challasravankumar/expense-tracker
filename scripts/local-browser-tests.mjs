// Optional Linux fallback if Playwright's CDN is unavailable. No production use.
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { brotliDecompressSync } from "node:zlib";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
const directory = mkdtempSync(join(tmpdir(), "everyday-browser-"));
const executable = join(directory, "chromium");
try {
  writeFileSync(
    executable,
    brotliDecompressSync(
      readFileSync(
        new URL(
          "../node_modules/@sparticuz/chromium/bin/chromium.br",
          import.meta.url,
        ),
      ),
    ),
    { mode: 0o700 },
  );
  const r = spawnSync("npx", ["playwright", "test"], {
    stdio: "inherit",
    env: {
      ...process.env,
      PLAYWRIGHT_CHROMIUM_EXECUTABLE: executable,
      PLAYWRIGHT_CHROMIUM_ARGS: JSON.stringify([
        "--no-sandbox",
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--no-zygote",
      ]),
    },
  });
  process.exitCode = r.status ?? 1;
} finally {
  rmSync(directory, { recursive: true, force: true });
}
