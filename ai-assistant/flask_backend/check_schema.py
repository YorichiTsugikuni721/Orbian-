import sqlite3
import os

DB_PATH = 'orbian_ai.db'
if os.path.exists(DB_PATH):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("PRAGMA table_info(users)")
    columns = cursor.fetchall()
    for col in columns:
        print(col)
    conn.close()
else:
    print("DB not found")
