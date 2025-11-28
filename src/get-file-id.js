const { Telegraf } = require('telegraf');

const bot = new Telegraf('8338954123:AAEyaIWdOYYOjtsKtmWUEFezRSX5xE0dE8s');

bot.on('video', (ctx) => {
  console.log('📹 FILE_ID:', ctx.message.video.file_id);
  ctx.reply(`FILE_ID: ${ctx.message.video.file_id}`);
});

bot.launch();
console.log('✅ Бот запущен. Отправьте видео, чтобы получить file_id');
