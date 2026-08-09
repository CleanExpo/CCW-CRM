import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../password';

describe('password hashing', () => {
  it('produces a bcrypt hash that is not the plaintext', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(hash).not.toBe('correct horse battery staple');
    expect(hash).toMatch(/^\$2[aby]\$12\$/);
  });

  it('salts, so the same password hashes differently each time', async () => {
    const [first, second] = await Promise.all([hashPassword('same-input'), hashPassword('same-input')]);
    expect(first).not.toBe(second);
  });

  it('verifies a correct password', async () => {
    const hash = await hashPassword('s3cret-password');
    await expect(verifyPassword('s3cret-password', hash)).resolves.toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await hashPassword('s3cret-password');
    await expect(verifyPassword('wrong-password', hash)).resolves.toBe(false);
  });

  it('rejects rather than throwing when the stored hash is malformed', async () => {
    await expect(verifyPassword('anything', 'not-a-bcrypt-hash')).resolves.toBe(false);
  });
});
