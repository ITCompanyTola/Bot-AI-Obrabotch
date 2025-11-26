import { Telegraf, Markup } from 'telegraf';
import { BotContext, UserState } from '../types';
import { Database } from '../database';
import { PRICES } from '../constants';
import { processVideoGeneration } from '../services/klingService';

const VIDEO_FILE_ID = 'BAACAgIAAxkBAAIBH2km5Rt3UcQ7DKMRkBqXL24VltNCAAL4hwACoGQ5SQmm0Y-dteu1NgQ';
const PHOTO_FILE_ID = 'AgACAgIAAxkBAAMLaSZOu8yXsSJKGncuKt58JtsmMXUAAkgSaxuNDDFJNu-IvUjWSRABAAMCAAN5AAM2BA';

export function registerPhotoAnimationHandlers(bot: Telegraf<BotContext>, userStates: Map<number, UserState>) {
  bot.action('photo_animation', async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes('query is too old')) {
        console.error('Ошибка answerCbQuery:', error.message);
      }
    }
    
    const userId = ctx.from?.id;
    if (!userId) return;

    const balance = await Database.getUserBalance(userId);
    
    const photoAnimationMessage = `
Наш Бот умеет оживлять и реставрировать фото!

Инструкция по оживлению фото:
1) Отправьте фото в бот
2) Напишите описание того, что должно произойти на фото
3) Ожидайте готовое видео (в течение 3 минут бот пришлет ваше видео)

Также вы можете заказать видео под ключ (по кнопке "🎁 Заказать видео под ключ"), и мы сами его для вас сделаем

<blockquote>💰 Ваш баланс: ${balance.toFixed(2)} ₽
📹 Оживление 1 фото = ${PRICES.PHOTO_ANIMATION}₽</blockquote>
    `.trim();
    
    await ctx.telegram.sendVideo(userId, VIDEO_FILE_ID, {
      caption: photoAnimationMessage,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📸 Оживить фото', callback_data: 'animate_photo' }],
          [{ text: 'Видео-инструкция', callback_data: 'video_instruction' }],
          [{ text: 'Пополнить баланс', callback_data: 'refill_balance' }],
          [{ text: 'Заказать видео под ключ', callback_data: 'order_video' }],
          [{ text: 'Главное меню', callback_data: 'main_menu' }]
        ]
      }
    });
  });

  bot.action('animate_photo', async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes('query is too old')) {
        console.error('Ошибка answerCbQuery:', error.message);
      }
    }
    
    const userId = ctx.from?.id;
    if (userId) {
      userStates.set(userId, { step: 'waiting_photo' });
    }
    
    await ctx.telegram.sendPhoto(userId, PHOTO_FILE_ID, {
      caption: 'Пример ⤴️\n\nПришлите фотографию, которую хотите оживить',
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Назад', callback_data: 'photo_animation' }]
        ]
      }
    });
  });

  bot.action('video_instruction', async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes('query is too old')) {
        console.error('Ошибка answerCbQuery:', error.message);
      }
    }
    await ctx.reply('🎬 Видео-инструкция...');
  });

  bot.action('order_video', async (ctx) => {
  try {
    await ctx.answerCbQuery();
  } catch (error: any) {
    if (!error.description?.includes('query is too old')) {
      console.error('Ошибка answerCbQuery:', error.message);
    }
  }
  
  const userId = ctx.from?.id;
  if (!userId) return;
  
  const orderVideoMessage = `
🎁 Пример готового видеоподарка ⤴️

Хотите трогательный подарок, но нет времени или желания самим оживлять фото и монтировать видео? Мы всё сделаем за вас!

💖 Это идеально для:
- подарка маме или бабушке (гарантированы слёзы счастья)
- годовщины или свадьбы (романтика и эмоции)
- дня рождения (память, которая останется навсегда)
- сохранения истории семьи

✨ Что вы получаете:
✔️ Мы сами оживляем ваши фото
✔️ Монтируем их в красивое видео
✔️ Добавляем музыку, которая трогает душу
✔️ Отправляем вам готовый ролик, готовый для показа или подарка

📸 Вам остаётся только отправить фотографии — всё остальное мы берём на себя.
  `.trim();

  await ctx.telegram.sendMessage(
    userId,
    orderVideoMessage,
    Markup.inlineKeyboard([
      [Markup.button.url('Заказать видео подарок', 'https://t.me/khodunow')],
      [Markup.button.callback('Главное меню', 'main_menu')]
    ])
  );
});

  bot.action('order_video_gift', async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes('query is too old')) {
        console.error('Ошибка answerCbQuery:', error.message);
      }
    }
    
    const userId = ctx.from?.id;
    if (!userId) return;
    
    await ctx.telegram.sendMessage(
      userId,
      '💬 Свяжитесь с нами для заказа видео подарка:',
      Markup.inlineKeyboard([
        [Markup.button.url('Написать', 'https://t.me/khodunow')],
        [Markup.button.callback('Главное меню', 'main_menu')]
      ])
    );
  });

  bot.action('start_generation', async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes('query is too old')) {
        console.error('Ошибка answerCbQuery:', error.message);
      }
    }
    
    const userId = ctx.from?.id;
    if (!userId) return;
    
    const userState = userStates.get(userId);
    
    if (!userState?.photoFileId || !userState?.prompt) {
      await ctx.reply('❌ Ошибка: не найдены данные для генерации. Начните сначала с команды /start');
      userStates.delete(userId);
      return;
    }
    
    const prompt = userState.prompt;
    const photoFileId = userState.photoFileId;
    
    const hasBalance = await Database.hasEnoughBalance(userId, PRICES.PHOTO_ANIMATION);
    
    if (!hasBalance) {
      const balance = await Database.getUserBalance(userId);
      await ctx.telegram.sendMessage(
        userId,
        `❌ Недостаточно средств!\n\n<blockquote>💰 Ваш баланс: ${balance.toFixed(2)} ₽
📹 Требуется: ${PRICES.PHOTO_ANIMATION} ₽</blockquote>`,
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('💳 Пополнить баланс', 'refill_balance')],
            [Markup.button.callback('Главное меню', 'main_menu')]
          ])
        }
      );
      return;
    }
    
    const deducted = await Database.deductBalance(
      userId,
      PRICES.PHOTO_ANIMATION,
      `Оживление фото: ${prompt.substring(0, 50)}...`
    );
    
    if (!deducted) {
      await ctx.reply('❌ Ошибка списания средств. Попробуйте позже.');
      userStates.delete(userId);
      return;
    }
    
    await ctx.telegram.sendMessage(userId, '⏳ Начинаю генерацию... Это займет около 3 минут.');
    
    processVideoGeneration(ctx, userId, photoFileId, prompt);
    
    userStates.delete(userId);
  });
}