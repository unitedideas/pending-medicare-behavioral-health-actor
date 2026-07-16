import assert from "node:assert/strict";
import test from "node:test";
import { decryptEntitlement, encryptEntitlement, entitlementIdFor } from "../src/entitlements.js";

test("paid editions use deterministic opaque filenames and authenticated encryption", () => {
  const sessionId = "cs_test_pending_medicare_fixture";
  const payload = { access_type: "one_time", records: [{ npi: "1234567890" }], csv: "npi\n1234567890\n" };
  const identifier = entitlementIdFor(sessionId);
  const envelope = encryptEntitlement(sessionId, payload);

  assert.match(identifier, /^[a-f0-9]{64}$/);
  assert.equal(envelope.algorithm, "AES-256-GCM");
  assert.deepEqual(decryptEntitlement(sessionId, envelope), payload);
  assert.doesNotMatch(JSON.stringify({ identifier, envelope }), /cs_test_pending_medicare_fixture/);
  assert.throws(() => decryptEntitlement("cs_test_wrong_session", envelope));
});

test("Stripe publisher fails closed and reports only aggregate order counts", async () => {
  const source = await import("node:fs/promises").then(({ readFile }) => readFile(new URL("../scripts/sync-stripe-entitlements.mjs", import.meta.url), "utf8"));
  assert.match(source, /pending-medicare-behavioral-health-edition-v1/);
  assert.match(source, /session\.status === "complete" && session\.payment_status === "paid"/);
  assert.match(source, /buildEdition\(\)/);
  assert.match(source, /selected_behavioral_health_records_national/);
  assert.match(source, /encryptEntitlement/);
  assert.match(source, /git", \["add", "paid"\]/);
  assert.doesNotMatch(source, /console\.log\([^\n]*session\.id/);
});
