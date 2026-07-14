from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    cerebras_api_key: str = ""
    secret_key: str = "change-this-in-production"
    database_url: str = "sqlite:///./ai_code_review.db"
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_key: str = ""  # bypasses RLS; backend-only, never expose
    upload_folder: str = "uploads"
    max_upload_size_mb: int = 10
    access_token_expire_minutes: int = 60 * 24  # 1 day

settings = Settings()

ALLOWED_EXTENSIONS = {".py", ".js", ".ts", ".jsx", ".tsx", ".java", ".cpp", ".c", ".go"}
