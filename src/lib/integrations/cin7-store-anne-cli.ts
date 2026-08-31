/**
 * Store Anne’s Cin7 SOH export on an Optix account’s D10 freeze, looked up by
 * email. Does not log in as that user and does not invent a database URL.
 */

export {
  ANNE_SOH_2026_08_31,
  parseStoreAnneCliArgs,
  storeAnneExportByEmail,
} from '../../../scripts/lib/store-anne-args.mjs';
