import { Telegraf } from 'telegraf';
import { config } from './src/config';

const bot = new Telegraf(config.botToken);

bot.on('video', (ctx) => {
  const fileId = ctx.message.video.file_id;
  console.log('📹 VIDEO FILE_ID:', fileId);
  
  ctx.reply(`📹 <b>VIDEO FILE_ID:</b>\n\n<code>${fileId}</code>\n\nСкопируйте этот ID для использования в боте`, {
    parse_mode: 'HTML'
  });
});

bot.on('photo', (ctx) => {
  const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
  console.log('📸 PHOTO FILE_ID:', fileId);
  
  ctx.reply(`📸 <b>PHOTO FILE_ID:</b>\n\n<code>${fileId}</code>\n\nСкопируйте этот ID для использования в боте`, {
    parse_mode: 'HTML'
  });
});

bot.on('audio', (ctx) => {
  const fileId = ctx.message.audio.file_id;
  console.log('🎵 AUDIO FILE_ID:', fileId);
  
  ctx.reply(`🎵 <b>AUDIO FILE_ID:</b>\n\n<code>${fileId}</code>\n\nСкопируйте этот ID для использования в боте`, {
    parse_mode: 'HTML'
  });
});

bot.on('document', (ctx) => {
  const fileId = ctx.message.document.file_id;
  console.log('📄 DOCUMENT FILE_ID:', fileId);
  
  ctx.reply(`📄 <b>DOCUMENT FILE_ID:</b>\n\n<code>${fileId}</code>\n\nСкопируйте этот ID для использования в боте`, {
    parse_mode: 'HTML'
  });
});

bot.launch();
console.log('✅ Бот запущен! Отправьте любой файл, чтобы получить его FILE_ID');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
