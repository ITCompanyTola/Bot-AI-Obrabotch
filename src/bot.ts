import { Telegraf } from 'telegraf';
import { config } from './config';
import { BotContext, UserState } from './types';
import { Database } from './database';
import { registerAllHandlers } from './handlers';
import webhookApp from './webhook';

const bot = new Telegraf<BotContext>(config.botToken);

const userStates = new Map<number, UserState>();

Database.initialize().catch(console.error);

registerAllHandlers(bot, userStates);

// Запуск webhook сервера для приёма платежей
const PORT = process.env.PORT || 3000;
webhookApp.listen(PORT, () => {
  console.log(`🌐 Webhook сервер запущен на порту ${PORT}`);
});

// Экспортируем bot для использования в webhook
export { bot };

bot.launch()
  .then(() => console.log('✅ Бот запущен'))
  .catch((err) => console.error('❌ Ошибка:', err));

process.once('SIGINT', async () => {
  await Database.close();
  bot.stop('SIGINT');
});

process.once('SIGTERM', async () => {
  await Database.close();
  bot.stop('SIGTERM');
});