#!/usr/bin/env node
import { access, mkdir } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { fail, parseOptions, requireFile, requireString } from "./lib/cli.mjs";
import { findChrome, run, skillRoot } from "./lib/runtime.mjs";
import { validateSlides } from "./lib/validate-slides.mjs";

async function main() {
  const values = parseOptions(process.argv.slice(2), {
    input: { type: "string" },
    output: { type: "string" },
    selector: { type: "string", default: ".slide" },
    chrome: { type: "string" },
    width: { type: "string" },
    height: { type: "string" },
    title: { type: "string" },
    author: { type: "string" },
    "no-pseudo": { type: "boolean", default: false },
  });
  const input = await requireFile(requireString(values, "input"), "HTML input");
  const output = path.resolve(requireString(values, "output"));
  if (path.extname(output).toLowerCase() !== ".pptx") {
    throw new Error("--output must use the .pptx extension");
  }
  const chrome = await findChrome(values.chrome);
  const validation = await validateSlides(input, {
    selector: values.selector,
    chrome,
  });
  if (!validation.ok) {
    throw new Error(`HTML validation failed: ${validation.errors.join("; ")}`);
  }

  const binary = path.join(
    skillRoot,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "dom-to-pptx.cmd" : "dom-to-pptx",
  );
  try {
    await access(binary, constants.X_OK);
  } catch {
    throw new Error(
      `Converter is not installed. Run npm install in ${skillRoot}`,
    );
  }
  await mkdir(path.dirname(output), { recursive: true });
  const args = [
    "export",
    input,
    "--output",
    output,
    "--selector",
    values.selector,
  ];
  for (const option of ["width", "height", "title", "author"]) {
    if (values[option]) args.push(`--${option}`, values[option]);
  }
  if (values["no-pseudo"]) args.push("--no-pseudo");

  await run(binary, args, {
    cwd: path.dirname(input),
    env: { PUPPETEER_EXECUTABLE_PATH: chrome },
    timeout: 120_000,
  });
  process.stdout.write(`Created ${output}\n`);
}

main().catch(fail);
