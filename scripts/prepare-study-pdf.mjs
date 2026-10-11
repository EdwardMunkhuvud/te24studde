import { cpSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
const require = createRequire(import.meta.url);
const source = dirname(require.resolve("pdfjs-dist/package.json"));
const target = "public/study/pdfjs";
mkdirSync(target, { recursive: true });
cpSync(join(source, "build/pdf.worker.min.mjs"), join(target, "pdf.worker.min.mjs"));
for (const directory of ["cmaps", "standard_fonts", "wasm"]) cpSync(join(source, directory), join(target, directory), { recursive: true });
