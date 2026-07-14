import threading

from supabase import create_client, Client
from config import settings

# FastAPI runs sync endpoints in a worker threadpool. A single shared Supabase
# client reuses one httpx (HTTP/2) connection pool across threads, which corrupts
# under concurrent writes ("Received pseudo-header in trailer"). Give each worker
# thread its own client so connections are never shared mid-flight.
_local = threading.local()


def get_supabase() -> Client:
    client = getattr(_local, "client", None)
    if client is None:
        # Prefer the service_role key (bypasses RLS). Fall back to anon so the
        # backend keeps working if the service key is not configured yet.
        key = settings.supabase_service_key or settings.supabase_anon_key
        client = create_client(settings.supabase_url, key)
        _local.client = client
    return client
