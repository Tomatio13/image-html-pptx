#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import {
  fail,
  parseOptions,
  parsePositiveNumber,
  printJson,
  requireFile,
  requireString,
} from "./lib/cli.mjs";

function decodeXml(value) {
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
}

async function inspectPptx(input) {
  const zip = await JSZip.loadAsync(await readFile(input));
  const slideNames = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
  const slides = [];
  for (const [index, name] of slideNames.entries()) {
    const xml = await zip.file(name).async("string");
    const text = [...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)]
      .map((match) => decodeXml(match[1]))
      .join(" ");
    const shapeCount = (xml.match(/<p:sp(?:\s|>)/g) ?? []).length;
    const pictureCount = (xml.match(/<p:pic(?:\s|>)/g) ?? []).length;
    slides.push({ index: index + 1, name, shapeCount, pictureCount, text });
  }
  return { zip, slides };
}

async function main() {
  const values = parseOptions(process.argv.slice(2), {
    input: { type: "string" },
    "expected-slides": { type: "string" },
    "expect-text": { type: "string", multiple: true },
    report: { type: "string" },
  });
  const input = await requireFile(requireString(values, "input"), "PPTX input");
  const { zip, slides } = await inspectPptx(input);
  const errors = [];
  const warnings = [];
  if (!zip.file("[Content_Types].xml"))
    errors.push("Missing [Content_Types].xml");
  if (!zip.file("ppt/presentation.xml"))
    errors.push("Missing ppt/presentation.xml");
  if (slides.length === 0) errors.push("The presentation contains no slides");

  if (values["expected-slides"]) {
    const expected = parsePositiveNumber(
      values["expected-slides"],
      "expected-slides",
    );
    if (!Number.isInteger(expected))
      throw new Error("--expected-slides must be an integer");
    if (slides.length !== expected) {
      errors.push(`Expected ${expected} slides but found ${slides.length}`);
    }
  }

  for (const slide of slides) {
    if (slide.shapeCount === 0) {
      errors.push(
        `Slide ${slide.index} has no native editable shapes or text boxes`,
      );
    }
    if (!slide.text.trim())
      warnings.push(`Slide ${slide.index} has no editable text`);
    if (slide.pictureCount > 0 && slide.shapeCount === 0) {
      errors.push(`Slide ${slide.index} appears to contain images only`);
    }
  }

  const allText = slides.map((slide) => slide.text).join("\n");
  for (const expectedText of values["expect-text"] ?? []) {
    if (!allText.includes(expectedText)) {
      errors.push(`Expected text was not found: ${expectedText}`);
    }
  }

  const report = {
    ok: errors.length === 0,
    input,
    slideCount: slides.length,
    errors,
    warnings,
    slides,
  };
  if (values.report) {
    const reportPath = path.resolve(values.report);
    await mkdir(path.dirname(reportPath), { recursive: true });
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  }
  printJson(report);
  if (!report.ok) process.exitCode = 2;
}

main().catch(fail);
