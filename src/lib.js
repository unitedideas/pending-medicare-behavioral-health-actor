import { createHash } from "node:crypto";

export const DATA_CATALOG_URL = "https://data.cms.gov/data.json";
export const NPPES_API_URL = "https://npiregistry.cms.hhs.gov/api/";
export const PENDING_STATUS = "First-time Medicare enrollment application pending Medicare Administrative Contractor processing";
export const LIMITATIONS = "Pending does not mean approved, enrolled, credentialed, licensed, newly opened, available, interested, or ready to buy. Public NPPES contact fields may be old, shared, or operational. Verify every record before relying on it.";

const MAX_CATALOG_BYTES = 25 * 1024 * 1024;
const MAX_CSV_BYTES = 5 * 1024 * 1024;
const MIN_SOURCE_ROWS = 1_000;
const MAX_SOURCE_ROWS = 25_000;
const MIN_ADDED_ROWS = 25;
const MAX_ADDED_ROWS = 10_000;
const MIN_SELECTED_ROWS = 3;
const MAX_SELECTED_ROWS = 1_000;

const DATASETS = [
  { key: "physician", title: "Pending Initial Logging and Tracking Physicians", filename: /^PendingInitialLandTsPhysicians_(20\d{6})\.csv$/ },
  { key: "non_physician", title: "Pending Initial Logging and Tracking Non Physicians", filename: /^PendingInitialLandTsNonPhysicians_(20\d{6})\.csv$/ }
];

export const TAXONOMIES = new Map([
  ["101YM0800X", "Mental health counselor"],
  ["261QM0801X", "Mental health clinic"],
  ["251S00000X", "Community / behavioral health"],
  ["101YP2500X", "Professional counselor"],
  ["103K00000X", "Behavior analyst"],
  ["106H00000X", "Marriage and family therapist"],
  ["103T00000X", "Psychologist"],
  ["261QM0850X", "Adult mental health clinic"]
]);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function normalizeStates(states) {
  if (states == null) return [];
  if (!Array.isArray(states)) throw new Error("states must be an array of two-letter codes");
  const normalized = [...new Set(states.map((state) => String(state).trim().toUpperCase()).filter(Boolean))].sort();
  if (normalized.some((state) => !/^[A-Z]{2}$/.test(state))) throw new Error("Each state must be a two-letter code");
  return normalized;
}

export function parseCsvLine(line) {
  const values = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      values.push(current);
      current = "";
    } else {
      current += character;
    }
  }
  if (quoted) throw new Error("Malformed CSV: unclosed quote");
  values.push(current.replace(/\r$/, ""));
  return values;
}

function trustedCmsCsv(url, expectedFilename) {
  const parsed = new URL(url);
  const filename = parsed.pathname.split("/").at(-1);
  const match = expectedFilename.exec(filename || "");
  if (parsed.protocol !== "https:" || parsed.hostname !== "data.cms.gov" || !parsed.pathname.startsWith("/sites/default/files/") || !match) {
    throw new Error(`Refusing an unexpected CMS CSV URL: ${parsed.origin}${parsed.pathname}`);
  }
  const compact = match[1];
  const date = `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
  return { url: parsed.toString(), date, filename };
}

export function resolveSnapshots(catalog) {
  if (!catalog || !Array.isArray(catalog.dataset)) throw new Error("CMS catalog did not contain a dataset array");
  const resolved = {};
  for (const definition of DATASETS) {
    const dataset = catalog.dataset.find((candidate) => candidate?.title === definition.title);
    if (!dataset || !Array.isArray(dataset.distribution)) throw new Error(`CMS catalog omitted ${definition.title}`);
    const snapshots = dataset.distribution
      .filter((distribution) => typeof distribution?.downloadURL === "string" && String(distribution.format || "").toUpperCase() === "CSV")
      .map((distribution) => trustedCmsCsv(distribution.downloadURL, definition.filename))
      .sort((left, right) => right.date.localeCompare(left.date));
    const unique = [...new Map(snapshots.map((snapshot) => [snapshot.date, snapshot])).values()];
    if (unique.length < 2) throw new Error(`${definition.title} exposed fewer than two CSV snapshots`);
    resolved[definition.key] = { current: unique[0], previous: unique[1] };
  }
  return resolved;
}

async function fetchBuffer(url, maxBytes, fetchImpl = fetch) {
  const response = await fetchImpl(url, {
    headers: { "user-agent": "PendingMedicareBH-Apify/1.0 (+https://github.com/unitedideas/pending-medicare-behavioral-health-actor)" }
  });
  if (!response.ok) throw new Error(`${new URL(url).hostname} returned HTTP ${response.status}`);
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > maxBytes) throw new Error(`${new URL(url).hostname} response exceeded the size limit`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > maxBytes) throw new Error(`${new URL(url).hostname} response exceeded the size limit`);
  return bytes;
}

export async function fetchCatalog(fetchImpl = fetch) {
  const bytes = await fetchBuffer(DATA_CATALOG_URL, MAX_CATALOG_BYTES, fetchImpl);
  let catalog;
  try {
    catalog = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new Error("CMS data catalog was not valid JSON");
  }
  return { catalog, bytes };
}

export function parsePendingCsv(text, pendingFile) {
  const lines = text.split(/\n/).filter((line) => line.trim());
  if (!lines.length) throw new Error(`CMS ${pendingFile} CSV was empty`);
  const headers = parseCsvLine(lines[0]).map((value) => value.trim().replace(/^\uFEFF/, ""));
  if (headers.join("|") !== "NPI|LAST_NAME|FIRST_NAME") throw new Error(`CMS ${pendingFile} CSV schema changed`);
  const records = new Map();
  for (const line of lines.slice(1)) {
    const row = parseCsvLine(line);
    const npi = String(row[0] || "").trim();
    if (!/^\d{10}$/.test(npi)) throw new Error(`CMS ${pendingFile} CSV contained an invalid NPI`);
    records.set(npi, {
      npi,
      last_name: String(row[1] || "").trim(),
      first_name: String(row[2] || "").trim(),
      pending_file: pendingFile
    });
  }
  if (records.size < MIN_SOURCE_ROWS || records.size > MAX_SOURCE_ROWS) {
    throw new Error(`Failing closed: ${pendingFile} snapshot contained ${records.size} unique NPIs`);
  }
  return records;
}

export function addedRecords(current, previous) {
  return [...current.values()].filter((record) => !previous.has(record.npi));
}

function chooseTaxonomy(taxonomies = []) {
  const matches = taxonomies.filter((taxonomy) => TAXONOMIES.has(taxonomy?.code));
  return matches.find((taxonomy) => taxonomy.primary === true) || matches[0] || null;
}

function chooseLocation(addresses = []) {
  return addresses.find((address) => address?.address_purpose === "LOCATION") || addresses[0] || {};
}

function compactDate(value) {
  const text = String(value || "");
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  return match ? text : "";
}

export function normalizeNppesResult(pending, payload, snapshots) {
  if (!payload || payload.result_count !== 1 || !Array.isArray(payload.results) || payload.results.length !== 1) return null;
  const result = payload.results[0];
  if (String(result.number || "") !== pending.npi) return null;
  const taxonomy = chooseTaxonomy(result.taxonomies);
  if (!taxonomy) return null;
  const location = chooseLocation(result.addresses);
  const basic = result.basic || {};
  const sourceSnapshot = snapshots[pending.pending_file];
  return {
    npi: pending.npi,
    first_name: String(basic.first_name || pending.first_name).trim(),
    last_name: String(basic.last_name || pending.last_name).trim(),
    credential: String(basic.credential || "").trim(),
    enumeration_type: String(result.enumeration_type || ""),
    focus: TAXONOMIES.get(taxonomy.code),
    taxonomy_code: taxonomy.code,
    taxonomy_description: String(taxonomy.desc || "").trim(),
    address_1: String(location.address_1 || "").trim(),
    address_2: String(location.address_2 || "").trim(),
    city: String(location.city || "").trim(),
    state: String(location.state || "").trim().toUpperCase(),
    postal_code: String(location.postal_code || "").trim(),
    telephone: String(location.telephone_number || "").trim(),
    npi_enumeration_date: compactDate(basic.enumeration_date),
    npi_last_updated: compactDate(basic.last_updated),
    npi_status: String(basic.status || "").trim(),
    pending_status: PENDING_STATUS,
    pending_file: pending.pending_file,
    pending_added_date: sourceSnapshot.current.date,
    prior_snapshot_date: sourceSnapshot.previous.date,
    cms_pending_source_url: sourceSnapshot.current.url,
    nppes_registry_url: `https://npiregistry.cms.hhs.gov/provider-view/${pending.npi}`,
    limitations: LIMITATIONS
  };
}

async function lookupNpi(pending, snapshots, fetchImpl, sleep, attempts = 3) {
  const url = new URL(NPPES_API_URL);
  url.searchParams.set("version", "2.1");
  url.searchParams.set("number", pending.npi);
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let response;
    try {
      response = await fetchImpl(url, {
        headers: { "user-agent": "PendingMedicareBH-Apify/1.0 (+https://github.com/unitedideas/pending-medicare-behavioral-health-actor)" },
        signal: AbortSignal.timeout(20_000)
      });
    } catch (error) {
      if (attempt === attempts) return { ok: false, npi: pending.npi, error: error instanceof Error ? error.message : "request failed" };
      await sleep(250 * 2 ** (attempt - 1));
      continue;
    }
    if (response.ok) {
      try {
        const payload = await response.json();
        return { ok: true, npi: pending.npi, record: normalizeNppesResult(pending, payload, snapshots) };
      } catch {
        return { ok: false, npi: pending.npi, error: "NPPES returned invalid JSON" };
      }
    }
    if ((response.status === 429 || response.status >= 500) && attempt < attempts) {
      await sleep(250 * 2 ** (attempt - 1));
      continue;
    }
    return { ok: false, npi: pending.npi, error: `NPPES returned HTTP ${response.status}` };
  }
  return { ok: false, npi: pending.npi, error: "NPPES lookup failed" };
}

async function mapConcurrent(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  async function consume() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, consume));
  return results;
}

export function selectPreview(records, count = 10) {
  const selected = [];
  const preferredStates = ["CA", "TX", "FL", "NY", "NC", "WA", ...new Set(records.map((record) => record.state))];
  for (const state of preferredStates) {
    const record = records.find((item) => item.state === state && !selected.some((selectedItem) => selectedItem.npi === item.npi));
    if (record) selected.push(record);
    if (selected.length === count) break;
  }
  for (const record of records) {
    if (!selected.some((selectedItem) => selectedItem.npi === record.npi)) selected.push(record);
    if (selected.length === count) break;
  }
  return selected;
}

export async function buildEdition({ states = [], fetchImpl = fetch, concurrency = 12, sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)) } = {}) {
  const normalizedStates = normalizeStates(states);
  const { catalog, bytes: catalogBytes } = await fetchCatalog(fetchImpl);
  const snapshots = resolveSnapshots(catalog);
  const downloads = [];
  for (const definition of DATASETS) {
    for (const slot of ["current", "previous"]) {
      const snapshot = snapshots[definition.key][slot];
      downloads.push({ key: definition.key, slot, snapshot });
    }
  }
  const fetched = await Promise.all(downloads.map(async (download) => ({
    ...download,
    bytes: await fetchBuffer(download.snapshot.url, MAX_CSV_BYTES, fetchImpl)
  })));
  const parsed = {};
  for (const definition of DATASETS) {
    parsed[definition.key] = {};
    for (const slot of ["current", "previous"]) {
      const item = fetched.find((candidate) => candidate.key === definition.key && candidate.slot === slot);
      parsed[definition.key][slot] = parsePendingCsv(item.bytes.toString("utf8"), definition.key);
    }
  }
  const addedByFile = Object.fromEntries(DATASETS.map((definition) => [definition.key, addedRecords(parsed[definition.key].current, parsed[definition.key].previous)]));
  const pendingByNpi = new Map();
  for (const definition of DATASETS) {
    for (const record of addedByFile[definition.key]) if (!pendingByNpi.has(record.npi)) pendingByNpi.set(record.npi, record);
  }
  const pending = [...pendingByNpi.values()].sort((left, right) => left.npi.localeCompare(right.npi));
  if (pending.length < MIN_ADDED_ROWS || pending.length > MAX_ADDED_ROWS) {
    throw new Error(`Failing closed: the current CMS delta contained ${pending.length} new NPIs`);
  }
  const lookups = await mapConcurrent(pending, concurrency, (record) => lookupNpi(record, snapshots, fetchImpl, sleep));
  const failures = lookups.filter((lookup) => !lookup.ok);
  const successfulLookups = lookups.length - failures.length;
  if (successfulLookups / lookups.length < 0.95) {
    throw new Error(`Failing closed: only ${successfulLookups} of ${lookups.length} NPPES lookups succeeded`);
  }
  const national = lookups
    .filter((lookup) => lookup.ok && lookup.record)
    .map((lookup) => lookup.record)
    .filter((record) => /^[A-Z]{2}$/.test(record.state))
    .sort((left, right) => left.state.localeCompare(right.state) || left.city.localeCompare(right.city) || left.last_name.localeCompare(right.last_name) || left.npi.localeCompare(right.npi));
  if (national.length < MIN_SELECTED_ROWS || national.length > MAX_SELECTED_ROWS) {
    throw new Error(`Failing closed: ${national.length} behavioral-health applicants passed the current edition gates`);
  }
  const records = normalizedStates.length ? national.filter((record) => normalizedStates.includes(record.state)) : national;
  const byState = Object.fromEntries([...new Set(records.map((record) => record.state))].sort().map((state) => [state, records.filter((record) => record.state === state).length]));
  const byFocus = Object.fromEntries([...new Set(records.map((record) => record.focus))].sort().map((focus) => [focus, records.filter((record) => record.focus === focus).length]));
  const sources = {};
  for (const definition of DATASETS) {
    sources[definition.key] = {
      current: {
        ...snapshots[definition.key].current,
        rows: parsed[definition.key].current.size,
        sha256: sha256(fetched.find((candidate) => candidate.key === definition.key && candidate.slot === "current").bytes)
      },
      previous: {
        ...snapshots[definition.key].previous,
        rows: parsed[definition.key].previous.size,
        sha256: sha256(fetched.find((candidate) => candidate.key === definition.key && candidate.slot === "previous").bytes)
      },
      newly_added_npis: addedByFile[definition.key].length
    };
  }
  const receipt = {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    source_catalog_url: DATA_CATALOG_URL,
    source_catalog_sha256: sha256(catalogBytes),
    sources,
    newly_added_unique_npis: pending.length,
    nppes_lookups_attempted: lookups.length,
    nppes_lookups_succeeded: successfulLookups,
    nppes_lookup_failures: failures.length,
    selected_behavioral_health_records_national: national.length,
    eligible_records_after_state_filter: records.length,
    state_filter: normalizedStates,
    by_state: byState,
    by_focus: byFocus,
    taxonomy_codes: Object.fromEntries(TAXONOMIES),
    pending_status: PENDING_STATUS,
    limitations: LIMITATIONS
  };
  return { receipt, records };
}
