/**
 * Optix stock control totals (qty, non-zero, per-branch).
 * Does not invent DATABASE_URL. Stock rows have no SOH value.
 */

export function parseOptixStockTotalsCliArgs(argv) {
  let email = '';
  let confirmRemote = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--') continue;
    if (arg === '--confirm-remote') {
      confirmRemote = true;
      continue;
    }
    if (arg === '--email') {
      const value = argv[i + 1];
      if (!value) throw new Error('--email requires an address');
      email = value.trim().toLowerCase();
      i += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  if (!email) throw new Error('--email is required (the Optix account that ran the stock walk).');
  return { email, confirmRemote };
}

export function formatOptixStockTotals(input) {
  const lines = [
    `account: ${input.email}`,
    `keys (SKU × branch rows): ${input.keys}`,
    `total SOH quantity: ${input.qty}`,
    `non-zero positions: ${input.nonzero}`,
    'total SOH value: not stored on Optix stock rows',
    'quantity per branch:',
  ];
  for (const row of input.perBranch) {
    lines.push(`  ${row.branch}: ${row.qty} (${row.nonzero} non-zero)`);
  }
  if (input.perBranch.length === 0) {
    lines.push('  (no stock rows)');
  }
  return lines.join('\n');
}

export async function loadOptixStockTotals({ email, findUserByEmail, queryTotals, queryPerBranch }) {
  const user = await findUserByEmail(email);
  if (!user) throw new Error(`No Optix account for ${email}.`);
  const totals = await queryTotals(user.id);
  const perBranch = await queryPerBranch(user.id);
  return {
    email: user.email,
    keys: Number(totals.keys ?? 0),
    qty: Number(totals.qty ?? 0),
    nonzero: Number(totals.nonzero ?? 0),
    perBranch: perBranch.map((row) => ({
      branch: String(row.branch),
      qty: Number(row.qty ?? 0),
      nonzero: Number(row.nonzero ?? 0),
    })),
  };
}
