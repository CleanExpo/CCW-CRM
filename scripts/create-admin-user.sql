-- Create admin user for demo
-- Password: demo123 (bcrypt hashed)

INSERT INTO users (id, email, password_hash, full_name, is_active, is_admin, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'admin@demo.com',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5.dQjI3gJ3Mq.',  -- demo123
  'Demo Administrator',
  true,
  true,
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  is_admin = EXCLUDED.is_admin;

SELECT 'Admin user created: admin@demo.com / demo123' as status;
