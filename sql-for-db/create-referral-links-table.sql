-- Создание таблицы реферальных ссылок (источников)
CREATE TABLE IF NOT EXISTS referral_sources (
  id SERIAL PRIMARY KEY,
  source_name VARCHAR(255) UNIQUE NOT NULL,
  key_substring VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Добавление колонки source_key к таблице users для связи с источником
ALTER TABLE users ADD COLUMN IF NOT EXISTS source_key VARCHAR(255);

-- Создание индекса для оптимизации поиска по источнику
CREATE INDEX IF NOT EXISTS idx_users_source_key ON users(source_key);

-- Триггер для автоматического обновления updated_at в referral_sources
CREATE OR REPLACE FUNCTION update_referral_sources_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_referral_sources_updated_at
BEFORE UPDATE ON referral_sources
FOR EACH ROW
EXECUTE FUNCTION update_referral_sources_updated_at();
