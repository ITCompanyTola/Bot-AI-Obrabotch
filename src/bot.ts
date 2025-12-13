import { Telegraf } from 'telegraf';
import { config } from './config';
import { BotContext, UserState, Broadcast } from './types';
import { Database } from './database';
import { registerAllHandlers } from './handlers';
import { mailingQueue } from './services/mailing-queue.service';
import webhookApp from './webhook';
import fs from 'fs';
import path from 'path';

const bot = new Telegraf<BotContext>(config.botToken);

const userStates = new Map<number, UserState>();
export const broadcast = new Map<number, Broadcast>();

// Функция логирования в файл
function logToFile(message: string) {
  const logDir = path.join(__dirname, '../logs');
  const logFile = path.join(logDir, 'bot.log');
  
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  
  fs.appendFileSync(logFile, logMessage);
  console.log(logMessage);
}

Database.initialize().catch((error) => {
  logToFile(`❌ Ошибка инициализации БД: ${error}`);
  console.error(error);
});

registerAllHandlers(bot, userStates);

// Запуск webhook сервера для приёма платежей
const PORT = process.env.PORT || 3000;
webhookApp.listen(PORT, () => {
  const message = `🌐 Webhook сервер запущен на порту ${PORT}`;
  logToFile(message);
  console.log(message);
});

// Экспортируем bot для использования в webhook
export { bot, logToFile };

bot.launch()
  .then(() => {
    logToFile('✅ Бот запущен');
    console.log('✅ Бот запущен');
  })
  .catch((err) => {
    logToFile(`❌ Ошибка запуска бота: ${err}`);
    console.error('❌ Ошибка:', err);
  });

process.once('SIGINT', async () => {
  await mailingQueue.close();
  await Database.close();
  bot.stop('SIGINT');
});

process.once('SIGTERM', async () => {
  await mailingQueue.close();
  await Database.close();
  bot.stop('SIGTERM');
});
