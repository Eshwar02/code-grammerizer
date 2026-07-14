from supabase import create_client, Client
from config import settings

_client: Client | None = None

def get_supabase() -> Client:
    global _client
    if _client is None:
        # Prefer the service_role key (bypasses RLS). Fall back to anon so the
        # backend keeps working if the service key is not configured yet.
        key = settings.supabase_service_key or settings.supabase_anon_key
        _client = create_client(settings.supabase_url, key)
    return _client
