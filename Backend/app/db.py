import os
from psycopg_pool import ConnectionPool
from dotenv import load_dotenv
load_dotenv() 
db_url = os.getenv("DB_CONNECTION_STRING")
if not db_url:
    db_url = (
        f"host={os.getenv('PGHOST')} "
        f"port={os.getenv('PGPORT','5432')} "
        f"dbname={os.getenv('PGDATABASE')} "
        f"user={os.getenv('PGUSER')} "
        f"password={os.getenv('PGPASSWORD')} "
        f"sslmode={os.getenv('PGSSL','disable')}"
    )

pool = ConnectionPool(conninfo=db_url, min_size=1, max_size=10)

def ensure_schema():
    with pool.connection() as conn:
        conn.execute("SELECT 1")
