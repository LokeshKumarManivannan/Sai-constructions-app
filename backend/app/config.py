from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://sai:sai@localhost:5432/sai"
    jwt_secret: str = "dev-only-secret-change-me-in-production-0000"
    jwt_algorithm: str = "HS256"
    access_token_days: int = 30

    otp_ttl_seconds: int = 300
    otp_max_attempts: int = 5
    # "console" logs the code (dev only). Real providers (MSG91, Firebase) plug in later.
    sms_provider: str = "console"
    # Dev convenience: return the OTP in the API response. Must be false in production.
    dev_expose_otp: bool = True

    invite_ttl_days: int = 7
    # Base URL the invite link points to (app landing / web app).
    app_base_url: str = "http://localhost:8081"

    cors_origins: list[str] = ["http://localhost:8081", "http://localhost:19006"]


settings = Settings()
