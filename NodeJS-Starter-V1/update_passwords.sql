UPDATE users
SET hashed_password = '$2b$12$ubbtACfSaL.BQb107Bm4Z.EUInVPYwZZoLtfzXNCMrru.grTtNf1K'
WHERE email IN ('admin@demo.com', 'sales@demo.com', 'warehouse@demo.com');
