import { Actor, log } from "apify";
import { buildEdition, selectPreview } from "./lib.js";

await Actor.init();

try {
  const input = await Actor.getInput() || {};
  const preview = input.preview !== false;
  const edition = await buildEdition({ states: input.states || [] });

  let records;
  let access;
  if (preview) {
    records = selectPreview(edition.records);
    access = "free_preview";
  } else {
    const pricing = Actor.getChargingManager().getPricingInfo();
    if (!pricing.isPayPerEvent && process.env.APIFY_IS_AT_HOME) {
      throw new Error("The full edition is unavailable until pay-per-event pricing is active. Run the free preview instead.");
    }
    const charge = await Actor.charge({ eventName: "current-edition" });
    if ((charge.chargedCount ?? 0) < 1) {
      await Actor.setValue("OUTPUT", {
        ok: false,
        status: "charge_limit_reached",
        message: "The run's maximum charge did not allow one $12 current-edition event. Increase the run limit or use the free preview.",
        receipt: edition.receipt,
        records_returned: 0
      });
      log.warning("No full edition was delivered because the run charge limit was reached");
      await Actor.exit("No full edition was delivered because the run charge limit was reached.");
    }
    records = edition.records;
    access = "paid_current_edition";
  }

  const dataset = await Actor.openDataset();
  await dataset.pushData(records);
  const output = {
    ok: true,
    status: "delivered",
    access,
    records_returned: records.length,
    receipt: edition.receipt,
    dataset_id: dataset.id,
    export_formats: ["json", "csv", "xlsx", "xml", "rss"]
  };
  await Actor.setValue("OUTPUT", output);
  log.info("Pending Medicare behavioral-health edition delivered", {
    access,
    records: records.length,
    currentSnapshot: edition.receipt.sources.physician.current.date,
    priorSnapshot: edition.receipt.sources.physician.previous.date
  });
  await Actor.exit(`Delivered ${records.length} ${access === "free_preview" ? "preview" : "full-edition"} records.`);
} catch (error) {
  const message = error instanceof Error ? error.message : "The edition could not be produced.";
  log.error(message);
  await Actor.fail(message);
}
