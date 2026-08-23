#!/usr/bin/env node
import { mkdir, readFile, rename, rm } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import {
  fail,
  parseOptions,
  requireFile,
  requireString,
  printJson,
} from "./lib/cli.mjs";

function validateRegion(region, index, width, height) {
  const id = String(region.id ?? "");
  if (!/^[a-z0-9][a-z0-9_-]*$/i.test(id)) {
    throw new Error(`Region ${index + 1} has an invalid id`);
  }
  const values = ["x", "y", "width", "height"].map((key) =>
    Number(region[key]),
  );
  if (!values.every(Number.isInteger)) {
    throw new Error(`Region ${id} coordinates must be integers`);
  }
  const [x, y, regionWidth, regionHeight] = values;
  if (x < 0 || y < 0 || regionWidth <= 0 || regionHeight <= 0) {
    throw new Error(
      `Region ${id} must use non-negative coordinates and positive size`,
    );
  }
  if (x + regionWidth > width || y + regionHeight > height) {
    throw new Error(`Region ${id} exceeds the ${width}x${height} source image`);
  }
  return { id, x, y, width: regionWidth, height: regionHeight };
}

async function main() {
  const values = parseOptions(process.argv.slice(2), {
    input: { type: "string" },
    regions: { type: "string" },
    "output-dir": { type: "string" },
  });
  const input = await requireFile(
    requireString(values, "input"),
    "Source image",
  );
  const regionsPath = await requireFile(
    requireString(values, "regions"),
    "Regions JSON",
  );
  const outputDir = path.resolve(requireString(values, "output-dir"));
  const metadata = await sharp(input).metadata();
  if (!metadata.width || !metadata.height)
    throw new Error("Unable to read image dimensions");
  if (!["png", "jpeg", "webp"].includes(metadata.format)) {
    throw new Error(
      "Unsupported source image format: " +
        (metadata.format ?? "unknown") +
        ". Use PNG, JPEG, or WebP.",
    );
  }

  const parsed = JSON.parse(await readFile(regionsPath, "utf8"));
  const entries = Array.isArray(parsed) ? parsed : parsed.regions;
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error("Regions JSON must contain a non-empty regions array");
  }
  const regions = entries.map((region, index) =>
    validateRegion(region, index, metadata.width, metadata.height),
  );
  if (new Set(regions.map((region) => region.id)).size !== regions.length) {
    throw new Error("Region ids must be unique");
  }

  await mkdir(outputDir, { recursive: true });
  const outputs = [];
  for (const region of regions) {
    const output = path.join(outputDir, `${region.id}.png`);
    const temporary = path.join(outputDir, `.${region.id}.${process.pid}.png`);
    try {
      await sharp(input)
        .extract({
          left: region.x,
          top: region.y,
          width: region.width,
          height: region.height,
        })
        .png()
        .toFile(temporary);
      await rename(temporary, output);
    } catch (error) {
      await rm(temporary, { force: true });
      throw error;
    }
    outputs.push({
      id: region.id,
      output,
      width: region.width,
      height: region.height,
    });
  }
  printJson({ input, outputs });
}

main().catch(fail);
