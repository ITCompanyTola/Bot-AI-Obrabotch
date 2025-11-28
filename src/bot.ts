import { Telegraf } from 'telegraf';
import { config } from './config';

const bot = new Telegraf(config.botToken);

// ВРЕМЕННЫЕ ОБРАБОТЧИКИ ДЛЯ ПОЛУЧЕНИЯ FILE_ID
bot.on('video', (ctx) => {
  const fileId = ctx.message.video.file_id;
  console.log('📹 VIDEO FILE_ID:', fileId);
  
  ctx.reply(`📹 <b>VIDEO FILE_ID:</b>\n\n<code>${fileId}</code>\n\nСкопируйте этот ID`, {
    parse_mode: 'HTML'
  });
});

bot.on('photo', (ctx) => {
  const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
  console.log('📸 PHOTO FILE_ID:', fileId);
  
  ctx.reply(`📸 <b>PHOTO FILE_ID:</b>\n\n<code>${fileId}</code>\n\nСкопируйте этот ID`, {
    parse_mode: 'HTML'
  });
});

bot.on('audio', (ctx) => {
  const fileId = ctx.message.audio.file_id;
  console.log('🎵 AUDIO FILE_ID:', fileId);
  
  ctx.reply(`🎵 <b>AUDIO FILE_ID:</b>\n\n<code>${fileId}</code>\n\nСкопируйте этот ID`, {
    parse_mode: 'HTML'
  });
});

bot.launch()
  .then(() => console.log('✅ Временный бот запущен для получения FILE_ID'))
  .catch((err) => console.error('❌ Ошибка:', err));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
