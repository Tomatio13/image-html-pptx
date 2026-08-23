#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  fail,
  parseOptions,
  printJson,
  requireFile,
  requireString,
} from "./lib/cli.mjs";
import { validateSlides } from "./lib/validate-slides.mjs";

async function main() {
  const values = parseOptions(process.argv.slice(2), {
    input: { type: "string" },
    selector: { type: "string", default: ".slide" },
    chrome: { type: "string" },
    report: { type: "string" },
  });
  const input = await requireFile(requireString(values, "input"), "HTML input");
  const report = await validateSlides(input, {
    selector: values.selector,
    chrome: values.chrome,
  });
  if (values.report) {
    const reportPath = path.resolve(values.report);
    await mkdir(path.dirname(reportPath), { recursive: true });
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  }
  printJson(report);
  if (!report.ok) process.exitCode = 2;
}

main().catch(fail);
