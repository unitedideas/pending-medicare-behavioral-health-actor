import { mkdir, writeFile } from "node:fs/promises";
import { buildEdition, selectPreview } from "../src/lib.js";

const outputDirectory = new URL("../sample/", import.meta.url);
const edition = await buildEdition();
const records = selectPreview(edition.records);

if (records.length !== 10) {
  throw new Error(`Expected 10 public preview rows, received ${records.length}`);
}

const fields = Object.keys(records[0]);
const escapeCsv = (value) => {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};
const csv = [fields, ...records.map((record) => fields.map((field) => record[field]))]
  .map((row) => row.map(escapeCsv).join(","))
  .join("\n") + "\n";

const receipt = {
  schema_version: 1,
  access: "free_public_repository_sample",
  records_returned: records.length,
  selection: "Deterministic one-per-preferred-state sample, then stable national-order fill",
  edition_receipt: edition.receipt,
};

await mkdir(outputDirectory, { recursive: true });
await Promise.all([
  writeFile(new URL("preview.csv", outputDirectory), csv),
  writeFile(new URL("preview.json", outputDirectory), JSON.stringify(records, null, 2) + "\n"),
  writeFile(new URL("receipt.json", outputDirectory), JSON.stringify(receipt, null, 2) + "\n"),
]);

console.log(JSON.stringify({
  ok: true,
  records: records.length,
  current_snapshot: edition.receipt.sources.physician.current.date,
  prior_snapshot: edition.receipt.sources.physician.previous.date,
  selected_national: edition.receipt.selected_behavioral_health_records_national,
  nppes_lookups_succeeded: edition.receipt.nppes_lookups_succeeded,
  nppes_lookups_attempted: edition.receipt.nppes_lookups_attempted,
}));
