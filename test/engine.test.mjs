// Run with: npm test   (uses Node's built-in test runner, no dependencies)
import { test } from "node:test";
import assert from "node:assert/strict";
import { TEMPLATES, matchIntent } from "../src/engine.js";
import { CASES } from "./cases.mjs";

test("every library example matches its own template", () => {
  for (const tpl of TEMPLATES) {
    assert.equal(matchIntent(tpl.example)?.id, tpl.id, `example for "${tpl.name}"`);
  }
});

for (const [request, expected, chips] of CASES) {
  test(`"${request}" -> ${expected ?? "no match"}`, () => {
    const tpl = matchIntent(request);
    assert.equal(tpl ? tpl.id : null, expected);
    if (!tpl || !chips) return;
    const got = Object.fromEntries(tpl.chips(tpl.parse(request)).map((c) => [c.k, String(c.v)]));
    for (const [k, v] of Object.entries(chips)) assert.equal(got[k], v, `slot "${k}"`);
  });
}

test("every template builds non-empty PowerShell and Python", () => {
  for (const tpl of TEMPLATES) {
    const slots = tpl.parse(tpl.example);
    assert.ok(tpl.ps(slots).trim().length > 40, `${tpl.id} ps`);
    assert.ok(tpl.py(slots).trim().length > 40, `${tpl.id} py`);
    assert.ok(!/undefined|\[object Object\]|NaN/.test(tpl.ps(slots) + tpl.py(slots)), `${tpl.id} has no broken values`);
  }
});

test("typed paths cannot inject PowerShell code", () => {
  const req = `delete files older than 5 days in "C:\\Data\\$(Remove-Item C:\\ -Recurse)"`;
  const tpl = matchIntent(req);
  const ps = tpl.ps(tpl.parse(req));
  // The path must sit inside single quotes, where PowerShell does not expand $(...).
  assert.match(ps, /\$Path\s+=\s+'C:\\Data\\\$\(Remove-Item C:\\ -Recurse\)'/);
  assert.doesNotMatch(ps, /"C:\\Data\\\$\(/);
});

test("a single quote in a typed path is escaped for PowerShell", () => {
  const req = `delete files older than 5 days in "C:\\Users\\O'Neil\\Logs"`;
  const tpl = matchIntent(req);
  assert.match(tpl.ps(tpl.parse(req)), /'C:\\Users\\O''Neil\\Logs'/);
});

test("destructive templates default to dry run", () => {
  for (const id of ["delete-old", "rename"]) {
    const tpl = TEMPLATES.find((t) => t.id === id);
    const s = tpl.parse(tpl.example);
    assert.match(tpl.ps(s), /-WhatIf/, `${id} ps`);
    assert.match(tpl.py(s), /DRY_RUN = True/, `${id} py`);
  }
});
