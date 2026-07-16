import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ID_NAMESPACE = "pending-medicare-id-v1";
const KEY_NAMESPACE = "pending-medicare-key-v1";

const digest = (value) => createHash("sha256").update(value).digest();

export const entitlementIdFor = (sessionId) =>
  digest(`${ID_NAMESPACE}:${sessionId}`).toString("hex");

export function encryptEntitlement(sessionId, value) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", digest(`${KEY_NAMESPACE}:${sessionId}`), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
  return {
    schema_version: 1,
    algorithm: "AES-256-GCM",
    iv: iv.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}

export function decryptEntitlement(sessionId, envelope) {
  const packed = Buffer.from(envelope.ciphertext, "base64");
  const decipher = createDecipheriv("aes-256-gcm", digest(`${KEY_NAMESPACE}:${sessionId}`), Buffer.from(envelope.iv, "base64"));
  decipher.setAuthTag(packed.subarray(-16));
  const plaintext = Buffer.concat([decipher.update(packed.subarray(0, -16)), decipher.final()]);
  return JSON.parse(plaintext.toString("utf8"));
}
