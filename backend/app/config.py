from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parents[1]
ENV_FILE = BACKEND_DIR / '.env'

load_dotenv(ENV_FILE, override=True)


class Settings(BaseSettings):
  model_config = SettingsConfigDict(
    env_file=str(ENV_FILE),
    env_file_encoding='utf-8',
    extra='ignore',
  )

  openrouter_api_key: str = Field(..., alias='OPENROUTER_API_KEY')
  openrouter_model: str = Field(
    default='qwen/qwen3-235b-a22b-2507',
    alias='OPENROUTER_MODEL',
  )
  embedding_model: str = Field(default='baai/bge-m3', alias='EMBEDDING_MODEL')
  reranker_model: str = Field(
    default='BAAI/bge-reranker-v2-m3',
    alias='RERANKER_MODEL',
  )
  host: str = Field(default='0.0.0.0', alias='HOST')
  port: int = Field(default=8001, alias='PORT')
  data_dir: Path = Field(default=BACKEND_DIR / 'data', alias='DATA_DIR')
  top_k_vector: int = Field(default=24, alias='TOP_K_VECTOR')
  top_k_bm25: int = Field(default=24, alias='TOP_K_BM25')
  top_k_rerank: int = Field(default=16, alias='TOP_K_RERANK')
  max_context_chunks: int = Field(default=6, alias='MAX_CONTEXT_CHUNKS')
  openrouter_timeout_seconds: float = Field(
    default=120.0,
    alias='OPENROUTER_TIMEOUT_SECONDS',
  )
  openrouter_max_tokens: int = Field(default=700, alias='OPENROUTER_MAX_TOKENS')

  @property
  def database_path(self) -> Path:
    return self.data_dir / 'lnreader_ai.sqlite3'


@lru_cache(maxsize=1)
def get_settings() -> Settings:
  settings = Settings()
  settings.data_dir.mkdir(parents=True, exist_ok=True)
  return settings
