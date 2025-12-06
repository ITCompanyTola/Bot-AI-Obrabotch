-- Удаляем старый constraint
ALTER TABLE generated_files 
DROP CONSTRAINT generated_files_file_type_check;

-- Создаем новый constraint с добавленным значением 'restoration'
ALTER TABLE generated_files 
ADD CONSTRAINT generated_files_file_type_check 
CHECK (file_type IN ('photo', 'music', 'restoration'));

-- Обновляем индекс
DROP INDEX IF EXISTS idx_generated_files_type;
CREATE INDEX idx_generated_files_type ON generated_files(file_type);