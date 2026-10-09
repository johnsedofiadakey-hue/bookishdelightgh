// Node module resolution hooks for running admin tests with `node --test`
// without a bundler: maps the `@/` alias to `src/` and resolves extensionless
// TypeScript imports. Node 24 strips TypeScript types natively.
import { existsSync, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const srcRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function candidate(base) {
  for (const suffix of ["", ".ts", ".tsx", "/index.ts"]) {
    const file = base + suffix;
    if (existsSync(file) && statSync(file).isFile()) return file;
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const file = candidate(path.join(srcRoot, specifier.slice(2)));
    if (file) return { url: pathToFileURL(file).href, shortCircuit: true };
  }
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:")) {
    const file = candidate(path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier));
    if (file && /\.tsx?$/.test(file)) return { url: pathToFileURL(file).href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
