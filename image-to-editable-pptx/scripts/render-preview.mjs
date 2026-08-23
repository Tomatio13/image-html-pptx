#!/usr/bin/env node
import { mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { fail, parseOptions, requireFile, requireString } from "./lib/cli.mjs";
import { firstExecutable, run } from "./lib/runtime.mjs";

async function main() {
  const values = parseOptions(process.argv.slice(2), {
    input: { type: "string" },
    reference: { type: "string", multiple: true },
    "output-dir": { type: "string" },
  });
  const input = await requireFile(requireString(values, "input"), "PPTX input");
  const references = [];
  for (const reference of values.reference ?? []) {
    references.push(await requireFile(reference, "Reference image"));
  }
  if (references.length === 0)
    throw new Error("At least one --reference is required");
  const outputDir = path.resolve(requireString(values, "output-dir"));
  const soffice = await firstExecutable([
    "/usr/bin/soffice",
    "/usr/bin/libreoffice",
  ]);
  const pdftoppm = await firstExecutable(["/usr/bin/pdftoppm"]);
  if (!soffice) throw new Error("LibreOffice/soffice was not found");
  if (!pdftoppm) throw new Error("pdftoppm was not found");

  await mkdir(outputDir, { recursive: true });
  const temporary = await mkdtemp(
    path.join(os.tmpdir(), "image-pptx-preview-"),
  );
  try {
    await run(soffice, [
      "--headless",
      "--convert-to",
      "pdf",
      "--outdir",
      temporary,
      input,
    ]);
    const pdfName = `${path.basename(input, path.extname(input))}.pdf`;
    const pdf = path.join(temporary, pdfName);
    await run(pdftoppm, [
      "-png",
      "-r",
      "144",
      pdf,
      path.join(temporary, "rendered"),
    ]);
    const pages = (await readdir(temporary))
      .filter((name) => /^rendered-\d+\.png$/.test(name))
      .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
    if (pages.length !== references.length) {
      throw new Error(
        `Reference count ${references.length} does not match rendered slide count ${pages.length}`,
      );
    }

    for (let index = 0; index < pages.length; index += 1) {
      const rendered = path.join(temporary, pages[index]);
      const reference = references[index];
      const refImage = sharp(reference).flatten({ background: "#ffffff" });
      const renderedImage = sharp(rendered).flatten({ background: "#ffffff" });
      const refMetadata = await refImage.metadata();
      const targetWidth = 960;
      const targetHeight = Math.max(
        1,
        Math.round((targetWidth * refMetadata.height) / refMetadata.width),
      );
      const [left, right] = await Promise.all([
        refImage
          .resize(targetWidth, targetHeight, {
            fit: "contain",
            background: "#ffffff",
          })
          .png()
          .toBuffer(),
        renderedImage
          .resize(targetWidth, targetHeight, {
            fit: "contain",
            background: "#ffffff",
          })
          .png()
          .toBuffer(),
      ]);
      const output = path.join(
        outputDir,
        `comparison-${String(index + 1).padStart(2, "0")}.png`,
      );
      await sharp({
        create: {
          width: targetWidth * 2 + 24,
          height: targetHeight,
          channels: 3,
          background: "#d9d9d9",
        },
      })
        .composite([
          { input: left, left: 0, top: 0 },
          { input: right, left: targetWidth + 24, top: 0 },
        ])
        .png()
        .toFile(output);
      process.stdout.write(`Created ${output}\n`);
    }
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

main().catch(fail);
