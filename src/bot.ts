import { Telegraf } from 'telegraf';
import { config } from './config';
import { BotContext, UserState } from './types';
import { Database } from './database';
import { registerAllHandlers } from './handlers';
import webhookApp from './webhook';

const bot = new Telegraf<BotContext>(config.botToken);

const userStates = new Map<number, UserState>();

Database.initialize().catch(console.error);

// TEMPORARY HANDLER FOR GETTING VIDEO FILE_ID
bot.on('video', async (ctx) => {
  const video = ctx.message.video;
  await ctx.reply(
    `Video File ID:\n\n${video.file_id}\n\nCopy this ID and add to .env file`,
    { parse_mode: 'HTML' }
  );
  console.log('Video File ID:', video.file_id);
});

// TEMPORARY HANDLER FOR GETTING PHOTO FILE_ID
bot.on('photo', async (ctx) => {
  const photo = ctx.message.photo[ctx.message.photo.length - 1];
  await ctx.reply(
    `Photo File ID:\n\n${photo.file_id}\n\nCopy this ID and add to .env file`,
    { parse_mode: 'HTML' }
  );
  console.log('Photo File ID:', photo.file_id);
});

registerAllHandlers(bot, userStates);

// Zapusk webhook servera dlya priema platezhey
const PORT = process.env.PORT || 3000;
webhookApp.listen(PORT, () => {
  console.log(`Webhook server zapushen na portu ${PORT}`);
});

// Eksportiruem bot dlya ispolzovaniya v webhook
export { bot };

bot.launch()
  .then(() => console.log('Bot zapushen'))
  .catch((err) => console.error('Oshibka:', err));

process.once('SIGINT', async () => {
  await Database.close();
  bot.stop('SIGINT');
});

process.once('SIGTERM', async () => {
  await Database.close();
  bot.stop('SIGTERM');
});
