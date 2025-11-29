-- Создание таблицы пользователей
CREATE TABLE IF NOT EXISTS users (
  id BIGINT PRIMARY KEY,
  username VARCHAR(255),
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  balance NUMERIC(10, 2) DEFAULT 0.00 NOT NULL,
  total_generations INTEGER DEFAULT 0 NOT NULL,
  policy_accepted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Создание таблицы транзакций
CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('generation', 'refill', 'bonus', 'pending')),
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Создание таблицы сгенерированных файлов
CREATE TABLE IF NOT EXISTS generated_files (
  id SERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  file_type VARCHAR(50) NOT NULL CHECK (file_type IN ('photo', 'music')),
  file_id VARCHAR(255) NOT NULL,
  prompt TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Создание индексов для оптимизации
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generated_files_user_id ON generated_files(user_id);
CREATE INDEX IF NOT EXISTS idx_generated_files_type ON generated_files(file_type);

-- Триггер для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();