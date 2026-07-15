import assert from "node:assert/strict";
import test from "node:test";
import {
  LIMITATIONS,
  PENDING_STATUS,
  addedRecords,
  normalizeNppesResult,
  normalizeStates,
  parseCsvLine,
  resolveSnapshots,
  selectPreview
} from "../src/lib.js";

test("parseCsvLine handles quoted commas and escaped quotes", () => {
  assert.deepEqual(parseCsvLine('123,"DOE, JR.","A""LEX"'), ["123", "DOE, JR.", 'A"LEX']);
});

test("normalizeStates validates and deduplicates", () => {
  assert.deepEqual(normalizeStates([" ca ", "TX", "ca"]), ["CA", "TX"]);
  assert.throws(() => normalizeStates(["California"]), /two-letter/);
});

test("resolveSnapshots selects the two newest trusted files", () => {
  const distribution = (prefix) => [
    { format: "CSV", downloadURL: `https://data.cms.gov/sites/default/files/2026-07/${prefix}_20260709.csv` },
    { format: "CSV", downloadURL: `https://data.cms.gov/sites/default/files/2026-07/${prefix}_20260713.csv` },
    { format: "API", accessURL: "https://data.cms.gov/api" }
  ];
  const catalog = {
    dataset: [
      { title: "Pending Initial Logging and Tracking Physicians", distribution: distribution("PendingInitialLandTsPhysicians") },
      { title: "Pending Initial Logging and Tracking Non Physicians", distribution: distribution("PendingInitialLandTsNonPhysicians") }
    ]
  };
  const snapshots = resolveSnapshots(catalog);
  assert.equal(snapshots.physician.current.date, "2026-07-13");
  assert.equal(snapshots.physician.previous.date, "2026-07-09");
  assert.equal(snapshots.non_physician.current.date, "2026-07-13");
});

test("resolveSnapshots rejects a lookalike host", () => {
  const catalog = {
    dataset: [
      {
        title: "Pending Initial Logging and Tracking Physicians",
        distribution: [
          { format: "CSV", downloadURL: "https://evil.example/PendingInitialLandTsPhysicians_20260713.csv" },
          { format: "CSV", downloadURL: "https://evil.example/PendingInitialLandTsPhysicians_20260709.csv" }
        ]
      },
      { title: "Pending Initial Logging and Tracking Non Physicians", distribution: [] }
    ]
  };
  assert.throws(() => resolveSnapshots(catalog), /Refusing an unexpected CMS CSV URL/);
});

test("addedRecords returns only new NPIs", () => {
  const current = new Map([
    ["1111111111", { npi: "1111111111" }],
    ["2222222222", { npi: "2222222222" }]
  ]);
  const previous = new Map([["1111111111", { npi: "1111111111" }]]);
  assert.deepEqual(addedRecords(current, previous), [{ npi: "2222222222" }]);
});

test("normalizeNppesResult keeps a behavioral-health match and pending boundary", () => {
  const pending = { npi: "1003167859", first_name: "TEST", last_name: "PERSON", pending_file: "non_physician" };
  const payload = {
    result_count: 1,
    results: [{
      number: "1003167859",
      enumeration_type: "NPI-1",
      basic: { first_name: "ALEX", last_name: "DOE", credential: "LMHC", enumeration_date: "2020-01-02", last_updated: "2026-07-01", status: "A" },
      taxonomies: [{ code: "101YM0800X", desc: "Counselor, Mental Health", primary: true }],
      addresses: [{ address_purpose: "LOCATION", address_1: "1 MAIN ST", city: "SEATTLE", state: "WA", postal_code: "98101", telephone_number: "206-555-0100" }]
    }]
  };
  const snapshots = {
    non_physician: {
      current: { date: "2026-07-13", url: "https://data.cms.gov/current.csv" },
      previous: { date: "2026-07-09", url: "https://data.cms.gov/previous.csv" }
    }
  };
  const record = normalizeNppesResult(pending, payload, snapshots);
  assert.equal(record.focus, "Mental health counselor");
  assert.equal(record.pending_status, PENDING_STATUS);
  assert.equal(record.limitations, LIMITATIONS);
  assert.equal(record.pending_added_date, "2026-07-13");
});

test("normalizeNppesResult rejects unrelated taxonomies", () => {
  const pending = { npi: "1003167859", pending_file: "physician" };
  const payload = {
    result_count: 1,
    results: [{ number: "1003167859", taxonomies: [{ code: "207Q00000X", primary: true }], addresses: [], basic: {} }]
  };
  const snapshots = { physician: { current: { date: "2026-07-13", url: "https://data.cms.gov/current.csv" }, previous: { date: "2026-07-09" } } };
  assert.equal(normalizeNppesResult(pending, payload, snapshots), null);
});

test("selectPreview is deterministic and fills the requested count", () => {
  const records = [
    { npi: "3", state: "WA" },
    { npi: "1", state: "CA" },
    { npi: "2", state: "TX" },
    { npi: "4", state: "OR" }
  ];
  assert.deepEqual(selectPreview(records, 3).map((record) => record.npi), ["1", "2", "3"]);
});
