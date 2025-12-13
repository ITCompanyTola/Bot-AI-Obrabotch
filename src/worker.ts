import { Database } from './database';
import { MailingWorker } from './services/mailing-worker.service';
import fs from 'fs';
import path from 'path';

// Функция логирования в файл
function logToFile(message: string, type: 'info' | 'error' = 'info') {
  const logDir = path.join(__dirname, '../logs');
  const logFile = path.join(logDir, 'worker.log');
  
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString();
  const prefix = type === 'error' ? '❌' : 'ℹ️';
  const logMessage = `[${timestamp}] ${prefix} ${message}\n`;
  
  fs.appendFileSync(logFile, logMessage);
  
  // Также выводим в консоль
  if (type === 'error') {
    console.error(logMessage.trim());
  } else {
    console.log(logMessage.trim());
  }
}

async function startWorker() {
  try {
    logToFile('🚀 Запуск воркера рассылок...');
    
    await Database.initialize();
    logToFile('✅ Подключение к PostgreSQL успешно');

    const worker = new MailingWorker();
    logToFile('✅ Воркер рассылок инициализирован');

    process.once('SIGINT', async () => {
      logToFile('🛑 Получен SIGINT, останавливаем воркер...');
      await worker.stop();
      await Database.close();
      logToFile('✅ Воркер корректно остановлен');
      process.exit(0);
    });

    process.once('SIGTERM', async () => {
      logToFile('🛑 Получен SIGTERM, останавливаем воркер...');
      await worker.stop();
      await Database.close();
      logToFile('✅ Воркер корректно остановлен');
      process.exit(0);
    });

    process.on('uncaughtException', (error) => {
      logToFile(`💥 Необработанное исключение: ${error.message}`, 'error');
      console.error(error.stack);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logToFile(`⚠️ Необработанный промис: ${reason}`, 'error');
    });

  } catch (error: any) {
    logToFile(`❌ Критическая ошибка запуска воркера: ${error.message}`, 'error');
    console.error(error.stack);
    process.exit(1);
  }
}

startWorker();