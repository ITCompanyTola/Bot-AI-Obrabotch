-- Таблица для хранения данных рассылки
CREATE TABLE IF NOT EXISTS mailing_data (
  id SERIAL PRIMARY KEY,
  admin_id BIGINT NOT NULL,
  message TEXT NOT NULL,
  entities JSONB,
  photo_file_id VARCHAR(255),
  video_file_id VARCHAR(255),
  total_users INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  blocked_count INTEGER DEFAULT 0,
  status VARCHAR(50) DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Таблица для логирования отправки конкретным пользователям
CREATE TABLE IF NOT EXISTS mailing_tasks (
  id SERIAL PRIMARY KEY,
  mailing_id INTEGER NOT NULL,
  user_id BIGINT NOT NULL,
  status VARCHAR(50) NOT NULL CHECK (status IN ('sent', 'failed', 'blocked')),
  attempts INTEGER DEFAULT 1,
  error_message TEXT,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (mailing_id) REFERENCES mailing_data(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Индексы для оптимизации
CREATE INDEX IF NOT EXISTS idx_mailing_data_admin_id ON mailing_data(admin_id);
CREATE INDEX IF NOT EXISTS idx_mailing_data_status ON mailing_data(status);
CREATE INDEX IF NOT EXISTS idx_mailing_data_created_at ON mailing_data(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mailing_tasks_mailing_id ON mailing_tasks(mailing_id);
CREATE INDEX IF NOT EXISTS idx_mailing_tasks_user_id ON mailing_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_mailing_tasks_status ON mailing_tasks(status);
CREATE INDEX IF NOT EXISTS idx_mailing_tasks_sent_at ON mailing_tasks(sent_at DESC);