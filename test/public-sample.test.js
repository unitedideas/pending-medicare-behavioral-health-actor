import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { LIMITATIONS, parseCsvLine } from "../src/lib.js";

test("public repository sample is current, source-receipted, feed-ready, and free of paid execution", async () => {
  const [csv, jsonText, receiptText, rss, jsonFeedText, sampleReadme, rootReadme] = await Promise.all([
    readFile(new URL("../sample/preview.csv", import.meta.url), "utf8"),
    readFile(new URL("../sample/preview.json", import.meta.url), "utf8"),
    readFile(new URL("../sample/receipt.json", import.meta.url), "utf8"),
    readFile(new URL("../sample/feed.xml", import.meta.url), "utf8"),
    readFile(new URL("../sample/feed.json", import.meta.url), "utf8"),
    readFile(new URL("../sample/README.md", import.meta.url), "utf8"),
    readFile(new URL("../README.md", import.meta.url), "utf8"),
  ]);
  const csvRows = csv.trim().split("\n").map(parseCsvLine);
  const records = JSON.parse(jsonText);
  const receipt = JSON.parse(receiptText);
  const jsonFeed = JSON.parse(jsonFeedText);

  assert.equal(csvRows.length, 11);
  assert.equal(records.length, 10);
  assert.equal(receipt.access, "free_public_repository_sample");
  assert.equal(receipt.records_returned, 10);
  assert.equal(receipt.edition_receipt.nppes_lookups_attempted, receipt.edition_receipt.nppes_lookups_succeeded);
  assert.ok(receipt.edition_receipt.selected_behavioral_health_records_national >= 3);
  assert.equal(receipt.edition_receipt.limitations, LIMITATIONS);
  assert.match(rss, /<rss version="2\.0"/);
  assert.match(rss, /https:\/\/actablesite\.com\/pending-medicare-feed\.xml/);
  assert.equal((rss.match(/<item>/g) || []).length, 10);
  assert.match(rss, /Pending does not mean approved/);
  assert.equal(jsonFeed.version, "https://jsonfeed.org/version/1.1");
  assert.equal(jsonFeed.feed_url, "https://actablesite.com/pending-medicare-feed.json");
  assert.equal(jsonFeed.items.length, 10);
  assert.equal(jsonFeed._actablesite.validated_national_count, receipt.edition_receipt.selected_behavioral_health_records_national);
  assert.equal(jsonFeed._actablesite.complete_edition.price, "$12 USD once");
  assert.equal(jsonFeed._actablesite.complete_edition.no_subscription, true);
  assert.equal(jsonFeed._actablesite.complete_edition.platform_usage_charge, false);
  assert.match(jsonFeed._actablesite.complete_edition.checkout_url, /client_reference_id=pending_medicare_feed/);
  assert.ok(jsonFeed.items.every((item) => item.content_text.includes("Pending does not mean approved")));
  assert.match(sampleReadme, /cannot start or authorize a paid run/);
  assert.match(sampleReadme, /pending-medicare-feed\.xml/);
  assert.match(rootReadme, /sample\/preview\.csv/);
  assert.match(rootReadme, /Subscribe to the free RSS feed/);
  assert.match(rootReadme, /pending-medicare-feed\.json/);
  assert.match(rootReadme, /create-task-from-example\/XpbXjWokmaugKKSMe/);
  assert.match(rootReadme, /Buy the complete validated national CSV for \$12 once/);
  assert.match(rootReadme, /client_reference_id=github_actor_readme/);
  assert.match(rootReadme, /utm_source=github&/);
  assert.match(rootReadme, /without an Apify account, subscription, or separate platform charge/);
  assert.match(rootReadme, /normally activates within 15 minutes/);
  assert.match(rootReadme, /optional buyer-funded route/);
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
  assert.match(workflow, /sample\/preview\.csv sample\/preview\.json sample\/receipt\.json sample\/feed\.xml sample\/feed\.json/);
  assert.match(workflow, /complete validated edition is \$12 plus buyer-paid Apify usage/);
  assert.doesNotMatch(workflow, /secrets\./);
  assert.match(builder, /buildEdition\(\)/);
  assert.match(builder, /selectPreview/);
  assert.match(builder, /Expected 10 public preview rows/);
});
