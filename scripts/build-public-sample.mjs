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

const feedHomeUrl = "https://actablesite.com/pending-medicare-behavioral-health-data";
const rssFeedUrl = "https://actablesite.com/pending-medicare-feed.xml";
const jsonFeedUrl = "https://actablesite.com/pending-medicare-feed.json";
const checkoutUrl = "https://buy.stripe.com/28EcMY3vQ3bn0921Un6oo0k?client_reference_id=pending_medicare_feed&utm_source=actablesite&utm_medium=feed&utm_campaign=pending_medicare_csv";
const generatedAt = new Date(edition.receipt.generated_at);

function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function recordTitle(record) {
  const name = [record.first_name, record.last_name].filter(Boolean).join(" ");
  return `${name} — ${record.focus} — ${record.city}, ${record.state}`;
}

function recordSummary(record) {
  return `${record.focus} in ${record.city}, ${record.state}. This NPI appeared in the ${record.pending_added_date} CMS pending first-time Medicare enrollment files and was enriched from the public NPPES Registry. Pending does not mean approved, enrolled, credentialed, licensed, available, interested, or ready to buy. Verify the source record before relying on it.`;
}

const rssItems = records.map((record) => `    <item>
      <title>${escapeXml(recordTitle(record))}</title>
      <link>${escapeXml(record.nppes_registry_url)}</link>
      <guid isPermaLink="false">urn:npi:${escapeXml(record.npi)}:pending:${escapeXml(record.pending_added_date)}</guid>
      <pubDate>${new Date(`${record.pending_added_date}T00:00:00Z`).toUTCString()}</pubDate>
      <category>${escapeXml(record.focus)}</category>
      <category>${escapeXml(record.state)}</category>
      <description>${escapeXml(recordSummary(record))}</description>
    </item>`).join("\n");

const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Pending Medicare behavioral-health provider sample</title>
    <link>${feedHomeUrl}</link>
    <atom:link href="${rssFeedUrl}" rel="self" type="application/rss+xml" />
    <description>Ten source-linked behavioral-health NPIs newly present in the latest CMS pending first-time Medicare enrollment files. Free public sample; pending is not approval.</description>
    <language>en-us</language>
    <lastBuildDate>${generatedAt.toUTCString()}</lastBuildDate>
    <ttl>2520</ttl>
${rssItems}
  </channel>
</rss>
`;

const jsonFeed = {
  version: "https://jsonfeed.org/version/1.1",
  title: "Pending Medicare behavioral-health provider sample",
  home_page_url: feedHomeUrl,
  feed_url: jsonFeedUrl,
  description: "Ten source-linked behavioral-health NPIs newly present in the latest CMS pending first-time Medicare enrollment files. Free public sample; pending is not approval.",
  language: "en-US",
  authors: [{ name: "ActableSite", url: "https://actablesite.com" }],
  expired: false,
  _actablesite: {
    current_snapshot: edition.receipt.sources.physician.current.date,
    prior_snapshot: edition.receipt.sources.physician.previous.date,
    validated_national_count: edition.receipt.selected_behavioral_health_records_national,
    sample_records: records.length,
    source_receipt_url: "https://raw.githubusercontent.com/unitedideas/pending-medicare-behavioral-health-actor/main/sample/receipt.json",
    complete_edition: {
      price: "$12 USD once",
      checkout_url: checkoutUrl,
      no_subscription: true,
      platform_usage_charge: false,
    },
    limitations: edition.receipt.limitations,
  },
  items: records.map((record) => ({
    id: `urn:npi:${record.npi}:pending:${record.pending_added_date}`,
    url: record.nppes_registry_url,
    title: recordTitle(record),
    content_text: recordSummary(record),
    date_published: `${record.pending_added_date}T00:00:00Z`,
    tags: [record.focus, record.state, "pending Medicare enrollment", "NPI"],
    _actablesite: {
      npi: record.npi,
      credential: record.credential,
      city: record.city,
      state: record.state,
      pending_added_date: record.pending_added_date,
      taxonomy_code: record.taxonomy_code,
      cms_pending_source_url: record.cms_pending_source_url,
    },
  })),
};

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
  writeFile(new URL("feed.xml", outputDirectory), rss),
  writeFile(new URL("feed.json", outputDirectory), JSON.stringify(jsonFeed, null, 2) + "\n"),
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
