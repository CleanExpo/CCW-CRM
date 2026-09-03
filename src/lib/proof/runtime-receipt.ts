/**
 * Runtime receipt for the CCW proof packet: redacted, hashed record of what
 * the deployment answered at one instant. Logic lives with the CLI in
 * scripts/lib so the packet tooling and the tests share one implementation.
 */

export {
  RECEIPT_MARKER,
  buildReceipt,
  canonicalJson,
  collectRuntimeReceipt,
  receiptDigest,
  redact,
  redactText,
  sha256Hex,
  stripUrlCredentials,
  verifyReceipt,
} from '../../../scripts/lib/runtime-receipt.mjs';
