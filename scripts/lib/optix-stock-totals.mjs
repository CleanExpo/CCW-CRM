/**
 * Optix stock control totals (qty, non-zero, per-branch).
 * Does not invent DATABASE_URL. Stock rows have no SOH value.
 */

export const OPTIX_STOCK_TOTALS_USAGE = [
  'Usage:',
  '  npm run cin7:optix-stock-totals -- --email <account@domain>',
  '  npm run cin7:optix-stock-totals -- --email <account@domain> --confirm-remote',
].join('\n');

function looksLikeEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function parseOptixStockTotalsCliArgs(argv) {
  let email = '';
  let confirmRemote = false;
  let help = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--') continue;
    if (arg === '--help' || arg === '-h') {
      help = true;
      continue;
    }
    if (arg === '--confirm-remote') {
      confirmRemote = true;
      continue;
    }
    if (arg === '--email' || arg.startsWith('--email=')) {
      const value = arg.startsWith('--email=') ? arg.slice('--email='.length) : argv[i + 1];
      if (!arg.startsWith('--email=')) i += 1;
      if (!value || value.startsWith('-')) {
        throw new Error('--email requires an address');
      }
      email = value.trim().toLowerCase();
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (help) return { help: true, email, confirmRemote };
  if (!email) throw new Error('--email is required (the Optix account that ran the stock walk).');
  if (!looksLikeEmail(email)) throw new Error(`--email is not a valid address: ${email}`);
  return { help: false, email, confirmRemote };
}

export function formatOptixStockTotals(input) {
  const lines = [
    `account: ${input.email}`,
    `keys (SKU × branch rows): ${input.keys}`,
    `total SOH quantity: ${input.qty}`,
    `non-zero positions: ${input.nonzero}`,
    `negative positions: ${input.negative ?? 0}`,
    'total SOH value: not stored on Optix stock rows',
    'quantity per branch:',
  ];
  for (const row of input.perBranch) {
    lines.push(`  ${row.branch}: ${row.qty} (${row.nonzero} non-zero)`);
  }
  if (input.perBranch.length === 0) {
    lines.push('  (no stock rows)');
  }
  if (input.keys === 0) {
    lines.push('note: this account has no stored stock walk');
  }
  return lines.join('\n');
}

export async function loadOptixStockTotals({
  email,
  findUserByEmail,
  queryTotals,
  queryPerBranch,
}) {
  const user = await findUserByEmail(email);
  if (!user) {
    throw new Error(
      `No Optix account for ${email}. Local Postgres is empty unless that user exists here; use --confirm-remote only on the host that ran the walk.`
    );
  }
  const totals = await queryTotals(user.id);
  const perBranch = await queryPerBranch(user.id);
  return {
    email: user.email,
    keys: Number(totals.keys ?? 0),
    qty: Number(totals.qty ?? 0),
    nonzero: Number(totals.nonzero ?? 0),
    negative: Number(totals.negative ?? 0),
    perBranch: perBranch.map((row) => ({
      branch: String(row.branch),
      qty: Number(row.qty ?? 0),
      nonzero: Number(row.nonzero ?? 0),
    })),
  };
}

export function describeOptixStockTotalsFailure(error) {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  if (code === 'ECONNREFUSED') {
    return 'Could not reach Postgres (ECONNREFUSED). Start local Postgres, or set DATABASE_URL to the host that holds the walk and pass --confirm-remote.';
  }
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
    return 'Could not resolve the database hostname.';
  }
  if (
    code === 'SELF_SIGNED_CERT_IN_CHAIN' ||
    code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ||
    code === 'CERT_HAS_EXPIRED'
  ) {
    return 'TLS to that Postgres host failed verification. This script will not skip certificate checks.';
  }
  if (error instanceof Error) return error.message;
  return String(error);
}
