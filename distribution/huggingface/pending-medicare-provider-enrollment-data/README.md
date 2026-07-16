---
pretty_name: Pending Medicare Provider Enrollment Data
license: other
tags:
  - tabular
  - medicare
  - healthcare
  - provider-enrollment
  - npi
  - behavioral-health
  - cms
  - nppes
configs:
  - config_name: provider_sample
    data_files: preview.csv
  - config_name: state_counts
    data_files: state_counts.csv
  - config_name: specialty_counts
    data_files: specialty_counts.csv
---

# Pending Medicare Provider Enrollment Data

This is a dated, source-receipted sample of behavioral-health NPIs newly present in CMS's pending first-time Medicare enrollment files on **2026-07-13**, compared with the immediately prior **2026-07-09** publication.

**Pending does not mean approved.** A row indicates that a first-time Medicare enrollment application appeared in a CMS pending file. It does not prove enrollment, credentialing, licensure, a new practice, service availability, interest, or buying intent.

## What is included

- `preview.csv`: 10 deterministic provider rows with NPI, disclosed behavioral-health taxonomy, public NPPES practice fields, snapshot dates, and direct source URLs.
- `state_counts.csv`: the complete state and territory distribution for all 211 behavioral-health matches in the dated national validation run.
- `specialty_counts.csv`: the complete disclosed specialty distribution for those 211 matches.
- `receipt.json`: source URLs, filenames, row counts, SHA-256 hashes, lookup outcomes, validation counts, taxonomy boundary, and limitations.

This repository does **not** publish all 211 provider rows. The aggregates let researchers inspect the dated national result without presenting the 10-row sample as the complete edition.

## Method

1. Resolve the two newest trusted CMS physician and non-physician pending-enrollment CSV snapshots.
2. Diff each newest snapshot against its predecessor by NPI.
3. Look up each added NPI in the official NPPES Registry.
4. Keep the disclosed conservative behavioral-health taxonomy set.
5. Fail closed on unexpected source, schema, lookup, or count conditions.

The dated validation run completed 1,763 of 1,763 NPPES lookups and selected 211 behavioral-health records across 42 jurisdictions, including DC. These are validation facts for the cited snapshots, not a standing market-size claim.

## Sources and responsible use

- [CMS fee-for-service public provider enrollment methodology](https://data.cms.gov/resources/fee-for-service-public-provider-enrollment-methodology)
- [NPPES NPI Registry](https://npiregistry.cms.hhs.gov/)
- [Source repository and current public sample](https://github.com/unitedideas/pending-medicare-behavioral-health-actor/tree/main/sample)

Public NPPES contact fields may be old, shared, or operational. Verify every record before a consequential or contact decision and follow applicable privacy, calling, and marketing rules.

## Current edition

The [Pending Medicare Provider Enrollment Data Actor](https://apify.com/actablesite/pending-medicare-behavioral-health-actor) provides a free current 10-row preview. A complete validated current edition costs **$12 once per run**, plus buyer-paid Apify platform usage. The Actor requests the edition charge only after national validation passes and writes a source-linked fulfillment receipt automatically.

## License note

The underlying CMS and NPPES records are U.S. government public data. The repository's transformation code is MIT-licensed. Users remain responsible for evaluating source terms, downstream use, and any jurisdiction-specific obligations.
