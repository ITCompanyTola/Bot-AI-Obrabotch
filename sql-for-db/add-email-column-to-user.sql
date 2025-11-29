-- Добавление поля email в таблицу users
ALTER TABLE public.users
ADD COLUMN email VARCHAR(255) NULL;