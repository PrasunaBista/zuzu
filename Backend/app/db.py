import os
from psycopg_pool import ConnectionPool

PG_CONN_STR = (
    f"host={os.getenv('PGHOST')} "
    f"port={os.getenv('PGPORT','5432')} "
    f"dbname={os.getenv('PGDATABASE')} "
    f"user={os.getenv('PGUSER')} "
    f"password={os.getenv('PGPASSWORD')} "
    f"sslmode={os.getenv('PGSSL','disable')}"
)

pool = ConnectionPool(PG_CONN_STR, min_size=1, max_size=10)

def ensure_schema():
    # basic health check; run init.sql separately (or automate here if you prefer)
    with pool.connection() as conn:
        conn.execute("SELECT 1")
