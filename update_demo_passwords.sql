-- Update demo user passwords with correct bcrypt hash
UPDATE users
SET hashed_password = '$2b$12$rOTVEHVk1whN3OzwdRdtquY/q4mLvucM6O0FtaL8bhpW/b73pRAVS'
WHERE email IN ('admin@demo.com', 'sales@demo.com', 'warehouse@demo.com');

-- Verify
SELECT email, length(hashed_password) as hash_length, substring(hashed_password, 1, 20) as hash_start
FROM users;
