from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
password = "demo123"
hashed = pwd_context.hash(password)
print(f"Password: {password}")
print(f"Hash: {hashed}")

# Verify it works
print(f"Verification: {pwd_context.verify(password, hashed)}")
