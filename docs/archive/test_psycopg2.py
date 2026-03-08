import psycopg2

try:
    conn = psycopg2.connect(
        host='localhost',
        port=5434,
        user='starter_user',
        password='local_dev_password',
        database='starter_db'
    )
    print("psycopg2 connection successful!")

    cur = conn.cursor()
    cur.execute('SELECT COUNT(*) FROM users')
    count = cur.fetchone()[0]
    print(f"User count: {count}")

    cur.close()
    conn.close()
except Exception as e:
    print(f"Connection failed: {e}")
