import { access } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

export function parseOptions(argv, options) {
  try {
    return parseArgs({ args: argv, options, allowPositionals: false }).values;
  } catch (error) {
    throw new Error(`Invalid arguments: ${error.message}`);
  }
}

export function requireString(values, name) {
  const value = values[name];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Missing required option --${name}`);
  }
  return value;
}

export function parsePositiveNumber(value, name) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`--${name} must be a positive number`);
  }
  return parsed;
}

export async function requireFile(filePath, label = "Input") {
  const resolved = path.resolve(filePath);
  try {
    await access(resolved, constants.R_OK);
  } catch {
    throw new Error(`${label} file is not readable: ${resolved}`);
  }
  return resolved;
}

export function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

export function fail(error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Error: ${message}\n`);
  process.exitCode = 1;
}
