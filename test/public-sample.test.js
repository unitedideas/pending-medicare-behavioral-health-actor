import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { LIMITATIONS, parseCsvLine } from "../src/lib.js";

test("public repository sample is current, source-receipted, and free of paid execution", async () => {
  const [csv, jsonText, receiptText, sampleReadme, rootReadme] = await Promise.all([
    readFile(new URL("../sample/preview.csv", import.meta.url), "utf8"),
    readFile(new URL("../sample/preview.json", import.meta.url), "utf8"),
    readFile(new URL("../sample/receipt.json", import.meta.url), "utf8"),
    readFile(new URL("../sample/README.md", import.meta.url), "utf8"),
    readFile(new URL("../README.md", import.meta.url), "utf8"),
  ]);
  const csvRows = csv.trim().split("\n").map(parseCsvLine);
  const records = JSON.parse(jsonText);
  const receipt = JSON.parse(receiptText);

  assert.equal(csvRows.length, 11);
  assert.equal(records.length, 10);
  assert.equal(receipt.access, "free_public_repository_sample");
  assert.equal(receipt.records_returned, 10);
  assert.equal(receipt.edition_receipt.nppes_lookups_attempted, receipt.edition_receipt.nppes_lookups_succeeded);
  assert.ok(receipt.edition_receipt.selected_behavioral_health_records_national >= 3);
  assert.equal(receipt.edition_receipt.limitations, LIMITATIONS);
  assert.match(sampleReadme, /cannot start or authorize a paid run/);
  assert.match(rootReadme, /sample\/preview\.csv/);
  assert.match(rootReadme, /create-task-from-example\/XpbXjWokmaugKKSMe/);
});

test("scheduled sample refresh validates before committing directly to main", async () => {
  const [workflow, builder] = await Promise.all([
    readFile(new URL("../.github/workflows/refresh-public-sample.yml", import.meta.url), "utf8"),
    readFile(new URL("../scripts/build-public-sample.mjs", import.meta.url), "utf8"),
  ]);
  assert.match(workflow, /cron: "30 20 \* \* 1,4"/);
  assert.match(workflow, /contents: write/);
  assert.match(workflow, /npm test/);
  assert.match(workflow, /npm run sample:build/);
  assert.match(workflow, /git push origin HEAD:main/);
  assert.match(workflow, /Publish dated public sample release/);
  assert.match(workflow, /tag="sample-\$\{current_date\}"/);
  assert.match(workflow, /gh release create/);
  assert.match(workflow, /gh release upload/);
  assert.match(workflow, /sample\/preview\.csv sample\/preview\.json sample\/receipt\.json/);
  assert.match(workflow, /complete validated edition is \$12 plus buyer-paid Apify usage/);
  assert.doesNotMatch(workflow, /secrets\./);
  assert.match(builder, /buildEdition\(\)/);
  assert.match(builder, /selectPreview/);
  assert.match(builder, /Expected 10 public preview rows/);
});
