"""Generate correct bcrypt hash for demo123."""
import bcrypt


def generate_hash():
    """Generate bcrypt hash for 'demo123'."""
    password = "demo123"
    password_bytes = password.encode('utf-8')

    # Generate hash
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password_bytes, salt)

    hash_str = hashed.decode('utf-8')
    print(f"\nGenerated bcrypt hash for password: '{password}'")
    print(f"Hash: {hash_str}")

    # Verify it works
    is_valid = bcrypt.checkpw(password_bytes, hashed)
    print(f"\nVerification: {'VALID' if is_valid else 'INVALID'}")

    if is_valid:
        print("\nThis hash can be used in:")
        print(f"  1. Update seed_demo.py line 122:")
        print(f'     password_hash="{hash_str}"')
        print(f"  2. Update database:")
        print(f"     UPDATE users SET password_hash = '{hash_str}' WHERE email = 'admin@demo.com';")


if __name__ == "__main__":
    generate_hash()
