# Database restore test evidence

Copy to `RESTORE-TEST-YYYY-MM-DD.md` after a staging restore.

| Field                       | Value                                 |
| --------------------------- | ------------------------------------- |
| Date (UTC)                  |                                       |
| Operator                    |                                       |
| Source backup file / S3 URI |                                       |
| SHA-256 checksum            |                                       |
| Encryption                  | GPG AES-256 (yes/no)                  |
| Region                      | ap-southeast-2                        |
| Target database             | staging / throwaway                   |
| Command used                | `./scripts/restore-backup.sh …`       |
| Result                      | PASS / FAIL                           |
| Notes                       | row-count spot check, app smoke login |

## Checklist

- [ ] Backup decrypted successfully with production `BACKUP_ENCRYPTION_KEY`
- [ ] Restore completed without error
- [ ] Spot-check: `app_users` / `invoices` counts non-zero (or expected)
- [ ] Plaintext dump was not left on disk
- [ ] Evidence filed under `docs/evidence/`
