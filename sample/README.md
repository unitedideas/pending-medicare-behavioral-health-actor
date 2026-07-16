# Current public sample

This directory is refreshed from the two newest CMS physician and non-physician pending-enrollment snapshots. It lets a researcher inspect the current signal, schema, source links, and limitations without an Apify account.

- `preview.csv` and `preview.json` contain the same 10 deterministic records.
- `receipt.json` records the source snapshots, hashes, row counts, NPPES lookup success, taxonomy boundary, state and specialty counts, and material limitations for the validated national edition.
- `feed.xml` and `feed.json` publish those same 10 records as RSS 2.0 and JSON Feed 1.1 for unattended readers. The stable public endpoints are [RSS](https://actablesite.com/pending-medicare-feed.xml) and [JSON Feed](https://actablesite.com/pending-medicare-feed.json).

The [latest dated GitHub release](https://github.com/unitedideas/pending-medicare-behavioral-health-actor/releases/latest) packages all five files as versioned download assets. Release download counts are public distribution evidence; they do not prove a paid edition.

The sample is free. It cannot start or authorize a paid run. The complete validated edition remains a separate, intentional $12 event on Apify, plus buyer-paid platform usage.

**Pending is not approved.** A row means a first-time Medicare enrollment application appeared in CMS's pending file. It does not prove enrollment, credentialing, licensure, a new practice, service availability, interest, or buying intent. Public NPPES address and telephone fields may be old, shared, or operational. Verify each record before relying on it.
