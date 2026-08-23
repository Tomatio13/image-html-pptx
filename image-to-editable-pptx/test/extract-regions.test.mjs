import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");

test("extract-regions crops validated regions", async (context) => {
  const temporary = await mkdtemp(
    path.join(os.tmpdir(), "extract-regions-test-"),
  );
  context.after(async () => {
    const { rm } = await import("node:fs/promises");
    await rm(temporary, { recursive: true, force: true });
  });
  const input = path.join(temporary, "source.png");
  const regions = path.join(temporary, "regions.json");
  const outputDir = path.join(temporary, "output");
  await sharp({
    create: { width: 100, height: 80, channels: 3, background: "#cc5533" },
  })
    .png()
    .toFile(input);
  await writeFile(
    regions,
    JSON.stringify({
      regions: [{ id: "photo-1", x: 10, y: 20, width: 30, height: 25 }],
    }),
  );

  const result = spawnSync(
    process.execPath,
    [
      path.join(root, "scripts/extract-regions.mjs"),
      "--input",
      input,
      "--regions",
      regions,
      "--output-dir",
      outputDir,
    ],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  const output = path.join(outputDir, "photo-1.png");
  assert.ok((await readFile(output)).length > 0);
  const metadata = await sharp(output).metadata();
  assert.equal(metadata.width, 30);
  assert.equal(metadata.height, 25);
});

test("extract-regions rejects out-of-bounds coordinates", async (context) => {
  const temporary = await mkdtemp(
    path.join(os.tmpdir(), "extract-regions-test-"),
  );
  context.after(async () => {
    const { rm } = await import("node:fs/promises");
    await rm(temporary, { recursive: true, force: true });
  });
  const input = path.join(temporary, "source.png");
  const regions = path.join(temporary, "regions.json");
  await sharp({
    create: { width: 10, height: 10, channels: 3, background: "#ffffff" },
  })
    .png()
    .toFile(input);
  await writeFile(
    regions,
    JSON.stringify({
      regions: [{ id: "bad", x: 8, y: 8, width: 4, height: 4 }],
    }),
  );
  const result = spawnSync(
    process.execPath,
    [
      path.join(root, "scripts/extract-regions.mjs"),
      "--input",
      input,
      "--regions",
      regions,
      "--output-dir",
      path.join(temporary, "output"),
    ],
    { encoding: "utf8" },
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /exceeds/);
});
