import os
from psycopg_pool import ConnectionPool
from dotenv import load_dotenv
load_dotenv() 
db_url = os.getenv("DB_CONNECTION_STRING")


pool = ConnectionPool(conninfo=db_url, min_size=1, max_size=10)

def ensure_schema():
    with pool.connection() as conn:
        conn.execute("SELECT 1")
