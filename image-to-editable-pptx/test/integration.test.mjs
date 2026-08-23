import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const fixture = path.join(root, "test/fixtures/slides.html");

function runScript(script, args) {
  return spawnSync(
    process.execPath,
    [path.join(root, "scripts", script), ...args],
    {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        PUPPETEER_EXECUTABLE_PATH: "/usr/bin/google-chrome",
      },
    },
  );
}

test(
  "fixture validates, exports, and contains native editable content",
  { timeout: 120_000 },
  async (context) => {
    const temporary = await mkdtemp(
      path.join(os.tmpdir(), "pptx-integration-test-"),
    );
    context.after(() => rm(temporary, { recursive: true, force: true }));
    const pptx = path.join(temporary, "fixture.pptx");

    const validation = runScript("validate-html.mjs", ["--input", fixture]);
    assert.equal(validation.status, 0, validation.stderr || validation.stdout);

    const exported = runScript("export-pptx.mjs", [
      "--input",
      fixture,
      "--output",
      pptx,
    ]);
    assert.equal(exported.status, 0, exported.stderr || exported.stdout);

    const verified = runScript("verify-pptx.mjs", [
      "--input",
      pptx,
      "--expected-slides",
      "2",
      "--expect-text",
      "編集可能なスライド",
      "--expect-text",
      "編集可能PPTX",
    ]);
    assert.equal(verified.status, 0, verified.stderr || verified.stdout);
    const report = JSON.parse(verified.stdout);
    assert.equal(report.ok, true);
    assert.equal(report.slideCount, 2);
    assert.ok(report.slides.every((slide) => slide.shapeCount > 0));
  },
);
