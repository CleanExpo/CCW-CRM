/** 31 Aug 2026 11:28 AM — Stock on Hand & Availability, Aug 2026 SOH columns. */
export const ANNE_SOH_2026_08_31 = {
  row_count: 17789,
  total_quantity: 97124.0126,
  value: 1577583.37,
  nonzero_positions: 4839,
  per_branch: [
    { branch: 'CCW - QLD1, QLD', quantity: 46813.3032 },
    { branch: 'CCW - VIC1, VIC', quantity: 35974.2293 },
    { branch: 'PFS-Offshore, Cavite', quantity: 12972.414 },
    { branch: 'CCW - NSW1, NSW', quantity: 1361.066 },
    { branch: 'CCW - Shopify', quantity: 3 },
    { branch: 'POWERFORCE - VIC2 (CLOSED), VIC', quantity: 0.0001 },
  ],
  as_of: '2026-08-31T11:28:00+10:00',
  captured_by: 'Anne Frey',
};

export function parseStoreAnneCliArgs(argv) {
  let email = '';
  let dryRun = false;
  let confirmRemote = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--') continue;
    if (arg === '--email') {
      const value = argv[i + 1];
      if (!value) throw new Error('--email requires an address');
      email = value.trim().toLowerCase();
      i += 1;
      continue;
    }
    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }
    if (arg === '--confirm-remote') {
      confirmRemote = true;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  if (!email) throw new Error('--email is required (the Optix account, not a password).');
  return { email, dryRun, confirmRemote, input: ANNE_SOH_2026_08_31 };
}

export async function storeAnneExportByEmail({ email, input, findUserByEmail, persistAnne }) {
  const user = await findUserByEmail(email.trim().toLowerCase());
  if (!user) {
    throw new Error(`No Optix account for ${email}.`);
  }
  const freeze = await persistAnne(user.id, input);
  return { ownerUserId: user.id, email: user.email, freeze };
}
