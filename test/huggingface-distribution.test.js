import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../distribution/huggingface/pending-medicare-provider-enrollment-data/", import.meta.url);

test("Hugging Face distribution is dated, aggregate-complete, and honest about the paid boundary", async () => {
  const [card, states, specialties, receipt] = await Promise.all([
    readFile(new URL("README.md", root), "utf8"),
    readFile(new URL("state_counts.csv", root), "utf8"),
    readFile(new URL("specialty_counts.csv", root), "utf8"),
    readFile(new URL("../sample/receipt.json", import.meta.url), "utf8").then(JSON.parse),
  ]);

  const stateRows = states.trim().split("\n").slice(1).map((line) => line.split(","));
  const specialtyRows = specialties.trim().split("\n").slice(1).map((line) => {
    const split = line.lastIndexOf(",");
    return [line.slice(0, split), line.slice(split + 1)];
  });
  const expectedStates = receipt.edition_receipt.by_state;
  const expectedSpecialties = receipt.edition_receipt.by_focus;

  assert.equal(stateRows.length, Object.keys(expectedStates).length);
  assert.equal(specialtyRows.length, Object.keys(expectedSpecialties).length);
  assert.deepEqual(Object.fromEntries(stateRows.map(([key, value]) => [key, Number(value)])), expectedStates);
  assert.deepEqual(Object.fromEntries(specialtyRows.map(([key, value]) => [key, Number(value)])), expectedSpecialties);
  assert.equal(stateRows.reduce((sum, [, value]) => sum + Number(value), 0), 211);
  assert.equal(specialtyRows.reduce((sum, [, value]) => sum + Number(value), 0), 211);
  assert.match(card, /Pending does not mean approved/);
  assert.match(card, /does \*\*not\*\* publish all 211 provider rows/);
  assert.match(card, /\*\*\$12 once per run\*\*/);
  assert.match(card, /buyer-paid Apify platform usage/);
  assert.match(card, /1,763 of 1,763 NPPES lookups/);
});
