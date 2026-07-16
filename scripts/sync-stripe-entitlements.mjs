import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { buildEdition } from "../src/lib.js";
import { encryptEntitlement, entitlementIdFor } from "../src/entitlements.js";

const ROOT = resolve(new URL("..", import.meta.url).pathname);
const REPO_DIR = process.env.PENDING_MEDICARE_REPO_DIR || "/Users/shane/Documents/pending-medicare-behavioral-health-actor";
const WORK_DIR = join(ROOT, "work");
const LOCK_DIR = join(WORK_DIR, "stripe-entitlements.lock");
const PAYMENT_LINK_ID = "plink_1TtgRL3svHq2QCOITKq5hlAl";
const PRODUCT_KEY = "pending-medicare-behavioral-health-edition-v1";
const stripeAuthorizationValue = process.env.STRIPE_SECRET_KEY;

if (!stripeAuthorizationValue) throw new Error("STRIPE_SECRET_KEY is not available");

async function run(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd || ROOT,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("exit", (code) => code === 0
      ? resolvePromise({ stdout, stderr })
      : reject(new Error(`${command} ${args[0] || ""} failed (${code}): ${stderr.slice(0, 800)}`)));
  });
}

async function stripe(path) {
  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: { authorization: `Bearer ${stripeAuthorizationValue}` },
    signal: AbortSignal.timeout(20_000),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`Stripe ${path} failed: ${body?.error?.message || response.status}`);
  return body;
}

async function allPages(path) {
  const records = [];
  let cursor = "";
  while (true) {
    const separator = path.includes("?") ? "&" : "?";
    const page = await stripe(`${path}${separator}limit=100${cursor ? `&starting_after=${encodeURIComponent(cursor)}` : ""}`);
    records.push(...page.data);
    if (!page.has_more || !page.data.length) return records;
    cursor = page.data.at(-1).id;
  }
}

function csvFor(records) {
  const fields = Object.keys(records[0] || {});
  if (!fields.length) throw new Error("The validated edition did not contain any records");
  const escape = (value) => {
    const text = String(value ?? "");
    return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  return [fields, ...records.map((record) => fields.map((field) => record[field]))]
    .map((row) => row.map(escape).join(","))
    .join("\n") + "\n";
}

async function acquireLock() {
  await mkdir(WORK_DIR, { recursive: true });
  try {
    await mkdir(LOCK_DIR);
    return true;
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    const lockAgeMs = Date.now() - (await stat(LOCK_DIR)).mtimeMs;
    if (lockAgeMs <= 45 * 60 * 1000) return false;
    await rm(LOCK_DIR, { recursive: true, force: true });
    await mkdir(LOCK_DIR);
    return true;
  }
}

async function publish() {
  const links = await allPages("/payment_links?active=true");
  const paymentLink = links.find((item) => item.id === PAYMENT_LINK_ID && item.metadata?.product_key === PRODUCT_KEY);
  if (!paymentLink) throw new Error("Pending Medicare payment link was not found");

  const sessions = await allPages(`/checkout/sessions?payment_link=${encodeURIComponent(PAYMENT_LINK_ID)}`);
  const paidSessions = sessions.filter((session) => session.status === "complete" && session.payment_status === "paid" && !session.subscription);
  const paidDirectory = join(REPO_DIR, "paid");
  await mkdir(paidDirectory, { recursive: true });

  const missing = [];
  for (const session of paidSessions) {
    try {
      await readFile(join(paidDirectory, `${entitlementIdFor(session.id)}.json`));
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      missing.push(session);
    }
  }

  if (!missing.length) {
    return { ok: true, paid_orders: paidSessions.length, new_paid_orders: 0, fulfilled_orders: paidSessions.length, published: false };
  }

  await run("/usr/bin/git", ["pull", "--ff-only", "origin", "main"], { cwd: REPO_DIR });
  const edition = await buildEdition();
  if (edition.records.length !== edition.receipt.selected_behavioral_health_records_national) {
    throw new Error("Validated edition row count did not match its receipt");
  }
  const csv = csvFor(edition.records);

  for (const session of missing) {
    const envelope = encryptEntitlement(session.id, {
      access_type: "one_time",
      records: edition.records,
      csv,
      receipt: edition.receipt,
    });
    await writeFile(join(paidDirectory, `${entitlementIdFor(session.id)}.json`), `${JSON.stringify({
      ...envelope,
      entitlement_type: "one_time",
      purchased_at: new Date(session.created * 1000).toISOString(),
      fulfilled_at: new Date().toISOString(),
      current_snapshot: edition.receipt.sources.physician.current.date,
      records: edition.records.length,
    }, null, 2)}\n`);
  }

  await run("/usr/bin/git", ["config", "user.name", "Pending Medicare Publisher"], { cwd: REPO_DIR });
  await run("/usr/bin/git", ["config", "user.email", "support@actablesite.com"], { cwd: REPO_DIR });
  await run("/usr/bin/git", ["add", "paid"], { cwd: REPO_DIR });
  const status = await run("/usr/bin/git", ["status", "--porcelain", "--", "paid"], { cwd: REPO_DIR });
  let published = false;
  if (status.stdout.trim()) {
    await run("/usr/bin/git", ["commit", "-m", `Fulfill ${missing.length} paid Pending Medicare edition${missing.length === 1 ? "" : "s"}`], { cwd: REPO_DIR });
    await run("/usr/bin/git", ["pull", "--rebase", "origin", "main"], { cwd: REPO_DIR });
    await run("/usr/bin/git", ["push", "origin", "HEAD:main"], { cwd: REPO_DIR });
    published = true;
  }

  return {
    ok: true,
    paid_orders: paidSessions.length,
    new_paid_orders: missing.length,
    fulfilled_orders: paidSessions.length,
    records_per_order: edition.records.length,
    current_snapshot: edition.receipt.sources.physician.current.date,
    published,
  };
}

if (!await acquireLock()) {
  console.log(JSON.stringify({ ok: true, skipped: "publisher_already_running" }));
} else {
  try {
    console.log(JSON.stringify(await publish()));
  } finally {
    await rm(LOCK_DIR, { recursive: true, force: true });
  }
}
