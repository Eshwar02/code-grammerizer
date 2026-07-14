from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    cerebras_api_key: str = ""      # gpt-oss  -> review + suggestions
    mistral_api_key: str = ""       # codestral -> code writing / docs
    groq_api_key: str = ""          # fallback provider
    github_token: str = ""          # optional, only for private repo pulls
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

# --- Small-repo pull limits (keep review cheap + fast) ---
REPO_MAX_FILES = 40
REPO_MAX_FILE_BYTES = 100 * 1024        # 100 KB per file
REPO_MAX_TOTAL_BYTES = 500 * 1024       # 500 KB whole project
REPO_SKIP_DIRS = {".git", "node_modules", "venv", ".venv", "dist", "build",
                  "vendor", "__pycache__", ".next", "target", "out", ".idea"}
