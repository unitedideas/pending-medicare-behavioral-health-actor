# Pending Medicare Provider Enrollment Data

Find behavioral-health clinicians newly added to CMS's **pending first-time Medicare enrollment** files since the prior publication. Built for credentialing, medical-billing, EHR, provider-network, and healthcare research teams.

> **Pending is not approved.** A row means a first-time Medicare enrollment application appeared in CMS's pending file. It does not prove enrollment, credentialing, licensure, a new practice, service availability, interest, or buying intent.

[Inspect the current 10-row sample directly in this repository](sample/preview.csv), with no account or token. Its [source receipt](sample/receipt.json) records the exact CMS snapshots, hashes, NPPES lookup success, taxonomy boundary, counts, and limitations.

[Download the latest dated public-sample release](https://github.com/unitedideas/pending-medicare-behavioral-health-actor/releases/latest) for versioned CSV, JSON, and source-receipt assets. The twice-weekly refresh workflow creates one release per current CMS snapshot and updates it idempotently when the same snapshot is revalidated.

[Run the free preview in GitHub Actions](https://github.com/unitedideas/pending-medicare-behavioral-health-action) when you want the same validated sample written into a workflow without an Apify account, token, email, or payment. The Action only invokes Apify after `preview` is explicitly set to `false` with a buyer-owned token and a charge cap of at least `$12.25`.

[Buy the complete validated national CSV for $12 once](https://buy.stripe.com/28EcMY3vQ3bn0921Un6oo0k?client_reference_id=github_actor_readme&utm_source=github&utm_medium=repository&utm_campaign=pending_medicare_csv) when you need every selected row without an Apify account, subscription, or separate platform charge. Private encrypted access normally activates within 15 minutes after payment.

[Duplicate the fixed free task on Apify](https://console.apify.com/create-task-from-example/XpbXjWokmaugKKSMe) when you want a hosted preview with an optional state filter. The task keeps `preview=true` fixed and cannot silently become a paid run. The [hosted Actor](https://apify.com/actablesite/pending-medicare-behavioral-health-actor) remains the optional buyer-funded route for state filters and JSON, Excel, XML, or RSS exports.

## Choose access intentionally

- **Free preview — no edition charge.** Get 10 current rows selected deterministically across states.
- **Complete national CSV — $12 once.** Get every validated behavioral-health row added since the prior CMS publication, with no subscription or separate platform charge.
- **Custom hosted run — optional buyer-funded Apify usage.** Use the Actor when you need state filters or alternate export formats.

The direct CSV purchase does not invoke Apify. The Actor never turns a preview into a paid run; set `preview` to `false` only when you intentionally choose the custom hosted route.

The repository sample refreshes automatically after the twice-weekly CMS publication cadence. Refresh failures stop without replacing the last validated sample.

## What the edition answers

- Which NPIs appeared in the newest CMS pending file but not the immediately prior file?
- Which of those NPIs have a disclosed behavioral-health taxonomy in the official NPPES Registry?
- What public name, credential, taxonomy, practice location, and telephone fields does NPPES currently report?
- Which CMS snapshots, URLs, row counts, and hashes produced the edition?

Use the queue for credentialing research, Medicare-enrollment operations, billing territory analysis, EHR market research, or provider-network research. Verify each record before any operational or contact decision.

## Output

Each dataset row includes:

- NPI, name, credential, and enumeration type;
- matched behavioral-health focus, taxonomy code, and taxonomy description;
- public NPPES practice address and telephone;
- NPI enumeration and last-update dates;
- physician or non-physician pending-file origin;
- current and prior snapshot dates;
- direct CMS source URL and NPPES Registry URL;
- the pending-status definition and material limitations.

The `OUTPUT` key-value-store record is the fulfillment receipt. It records source hashes and row counts, new-NPI counts by file, NPPES lookup success, selected counts, filters, state and specialty distributions, and delivered access level.

## How it works

1. Resolve the two newest CSV snapshots for both official CMS pending datasets.
2. Reject unexpected domains, paths, filenames, schemas, or source counts.
3. Diff each newest snapshot against its predecessor by NPI.
4. Look up each added NPI in the official NPPES Registry.
5. Keep only the disclosed behavioral-health taxonomy set and normalize location fields.
6. Reject implausible deltas, excessive lookup failures, or implausible selected counts.
7. For a full run, request one `current-edition` charge only after validation.
8. Write the dataset and source-linked fulfillment receipt automatically.

## Input

```json
{
  "preview": true,
  "states": ["CA", "TX"]
}
```

- `preview` defaults to `true`.
- `states` is optional. Use two-letter state or territory codes. Leave it empty for national results.
- A state filter can legitimately return zero rows; the receipt still reports the validated national count and exact filter.

## Behavioral-health taxonomy boundary

The initial conservative set includes mental-health counselor, professional counselor, behavior analyst, marriage and family therapist, psychologist, mental-health clinic, adult mental-health clinic, and community/behavioral-health codes. The exact codes are returned in every receipt.

This narrow set favors an explainable signal over broad claims. It does not include every specialty that could participate in behavioral health.

## Source and limitations

- [CMS Fee-for-Service Public Provider Enrollment methodology](https://data.cms.gov/resources/fee-for-service-public-provider-enrollment-methodology)
- [CMS public data catalog](https://data.cms.gov/data.json)
- [NPPES NPI Registry](https://npiregistry.cms.hhs.gov/)

The CMS pending files contain NPI and applicant name only. Enrichment comes from the separately published NPPES Registry. Public address and telephone fields may be old, shared, or operational. Names may change between the pending snapshot and the current NPPES record. No outreach is performed by this Actor.

## Failure contract

The run fails without charging the edition event when a source is missing or untrusted, its schema changes, row or delta counts are implausible, more than 5% of NPPES lookups fail, or the national behavioral-health result falls outside the safety range. A full edition is not delivered when the run's maximum charge cannot authorize the event.
