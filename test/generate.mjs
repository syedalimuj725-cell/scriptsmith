// Writes every script Scriptsmith can build for the test cases to ./generated,
// so real PowerShell and Python parsers can check them.
// Usage: node test/generate.mjs
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { TEMPLATES, matchIntent } from "../src/engine.js";
import { CASES } from "./cases.mjs";

const dir = new URL("../generated/", import.meta.url);
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });

const requests = [...TEMPLATES.map((t) => t.example), ...CASES.map((c) => c[0])];
let n = 0;
for (const [i, req] of requests.entries()) {
  const tpl = matchIntent(req);
  if (!tpl) continue;
  const s = tpl.parse(req);
  const base = `${String(i).padStart(2, "0")}-${tpl.id}`;
  writeFileSync(new URL(`${base}.ps1`, dir), tpl.ps(s) + "\n", "utf8");
  writeFileSync(new URL(`${base}.py`, dir), tpl.py(s) + "\n", "utf8");
  n += 2;
}
console.log(`Wrote ${n} scripts to generated/`);
