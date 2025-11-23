# import os
# from psycopg_pool import ConnectionPool
# from dotenv import load_dotenv
# load_dotenv() 
# db_url = os.getenv("DB_CONNECTION_STRING")


# pool = ConnectionPool(conninfo=db_url, min_size=1, max_size=10)

# def ensure_schema():
#     with pool.connection() as conn:
#         conn.execute("SELECT 1")


# app/db.py
# app/db.py
import os
from psycopg_pool import ConnectionPool

# Read the connection string from environment
db_url = os.getenv("DB_CONNECTION_STRING")

if not db_url:
    # Fail fast if env var is not set
    raise RuntimeError("DB_CONNECTION_STRING is not set")

# Add keepalives + short connect timeout directly in the DSN
# Example base DSN:
#   postgresql://user:pass@host:5432/dbname
if "connect_timeout" not in db_url:
    sep = "&" if "?" in db_url else "?"
    db_url = (
        db_url
        + f"{sep}connect_timeout=5"
        "&keepalives=1"
        "&keepalives_idle=30"
        "&keepalives_interval=10"
        "&keepalives_count=5"
    )

# Create a global connection pool
pool = ConnectionPool(
    conninfo=db_url,
    min_size=1,
    max_size=10,
    max_lifetime=60 * 60,  # recycle connections every 1 hour
    max_idle=300,          # close if idle > 5 min
    timeout=10,            # max 10s to acquire a connection
)

def ensure_schema():
    """
    Lightweight check that the DB is reachable.
    Your real schema-creation logic can live elsewhere.
    """
    with pool.connection() as conn:
        conn.execute("SELECT 1")
