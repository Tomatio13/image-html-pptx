import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const skillRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

export async function firstExecutable(candidates) {
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      await access(candidate, constants.X_OK);
      return candidate;
    } catch {
      // Try the next explicit candidate.
    }
  }
  return null;
}

export async function findChrome(explicitPath) {
  const chrome = await firstExecutable([
    explicitPath,
    process.env.PUPPETEER_EXECUTABLE_PATH,
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ]);
  if (!chrome) {
    throw new Error(
      "Chrome or Chromium was not found. Pass --chrome or set PUPPETEER_EXECUTABLE_PATH.",
    );
  }
  return chrome;
}

export function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
      env: { ...process.env, ...options.env },
      cwd: options.cwd,
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timeout = options.timeout
      ? setTimeout(() => {
          timedOut = true;
          child.kill("SIGKILL");
        }, options.timeout)
      : null;
    if (options.capture) {
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk) => (stdout += chunk));
      child.stderr.on("data", (chunk) => (stderr += chunk));
    }
    child.on("error", reject);
    child.on("close", (code) => {
      if (timeout) clearTimeout(timeout);
      if (timedOut) {
        reject(new Error(` exceeded the ms timeout`));
        return;
      }
      if (code === 0) resolve({ stdout, stderr });
      else {
        reject(
          new Error(
            `${command} exited with code ${code}${stderr ? `: ${stderr.trim()}` : ""}`,
          ),
        );
      }
    });
  });
}
