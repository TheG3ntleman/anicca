from dataclasses import dataclass

@dataclass
class Settings:
    APP_NAME: str = "anicca"
    DEBUG: bool = False

settings = Settings()