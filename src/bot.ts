import { Telegraf } from 'telegraf';
import { config } from './config';
import { BotContext, UserState } from './types';
import { Database } from './database';
import { registerAllHandlers } from './handlers';

const bot = new Telegraf<BotContext>(config.botToken);

const userStates = new Map<number, UserState>();

Database.initialize().catch(console.error);

registerAllHandlers(bot, userStates);


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