import { Telegraf, Markup } from 'telegraf';
import { BotContext, UserState } from '../types';
import { Database } from '../database';
import { PRICES } from '../constants';
import { processVideoGeneration } from '../services/klingService';
import { config } from '../config';

const VIDEO_FILE_ID = config.videoFileId;
const PHOTO_FILE_ID = config.photoFileId;

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
📸 <b>Наш бот умеет оживлять и реставрировать фото!</b>

Вот как создать своё анимированное фото:

1️⃣ <b><i>Отправьте одну фотографию* в бот.</i></b>
2️⃣ <b><i>Опишите</i></b>, что именно должно произойти на изображении — движение, эмоции, детали, любые пожелания ✨
3️⃣ <b><i>Немного подождите</i></b> — примерно через 3 минуты бот отправит вам готовое видео 🎬⚡️

🎁 <b>Хотите видео "под ключ"?</b>
Нажмите кнопку <b><i>«Заказать видео под ключ»</i></b>, и мы создадим его полностью для вас!

❗️* - <b>бот оживляет только одно фото за раз</b>☝🏻

<blockquote>💰 Ваш баланс: ${balance.toFixed(2)} ₽
📹 Оживление 1 фото = ${PRICES.PHOTO_ANIMATION}₽</blockquote>
    `.trim();
    
    // Проверяем, есть ли VIDEO_FILE_ID
    if (VIDEO_FILE_ID && VIDEO_FILE_ID.trim() !== '') {
      try {
        await ctx.telegram.sendVideo(userId, VIDEO_FILE_ID, {
          caption: photoAnimationMessage,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: '📸 Оживить фото', callback_data: 'animate_photo' }],
              [{ text: 'Видео-инструкция', callback_data: 'video_instruction' }],
              [{ text: '💳 Пополнить баланс', callback_data: 'refill_balance' }],
              [{ text: 'Заказать видео под ключ', callback_data: 'order_video' }],
              [{ text: 'Главное меню', callback_data: 'main_menu' }]
            ]
          }
        });
      } catch (error) {
        console.error('Ошибка отправки видео:', error);
        // Если не удалось отправить видео, отправляем просто текст
        await ctx.telegram.sendMessage(userId, photoAnimationMessage, {
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
      }
    } else {
      // Если VIDEO_FILE_ID не указан, просто отправляем текст
      await ctx.telegram.sendMessage(userId, photoAnimationMessage, {
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
    }
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
    
    // Проверяем, есть ли PHOTO_FILE_ID
    if (PHOTO_FILE_ID && PHOTO_FILE_ID.trim() !== '') {
      try {
        await ctx.telegram.sendPhoto(userId, PHOTO_FILE_ID, {
          caption: '📸 <b>Пример</b> ⤴️\n\nОтправьте <b><i>фотографию</i></b>, которую хотите оживить, и бот превратит её в волшебное видео ✨🎬',
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Назад', callback_data: 'photo_animation' }]
            ]
          }
        });
      } catch (error) {
        console.error('Ошибка отправки фото:', error);
        // Если не удалось отправить фото, отправляем просто текст
        await ctx.telegram.sendMessage(userId, '📸 Отправьте фотографию, которую хотите оживить, и бот превратит её в волшебное видео ✨🎬', {
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Назад', callback_data: 'photo_animation' }]
            ]
          }
        });
      }
    } else {
      // Если PHOTO_FILE_ID не указан, просто отправляем текст
      await ctx.telegram.sendMessage(userId, '📸 Отправьте фотографию, которую хотите оживить, и бот превратит её в волшебное видео ✨🎬', {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Назад', callback_data: 'photo_animation' }]
          ]
        }
      });
    }
  });

  bot.action('video_instruction', async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes('query is too old')) {
        console.error('Oshibka answerCbQuery:', error.message);
      }
    }
    
    const userId = ctx.from?.id;
    if (!userId) return;
    
    await ctx.telegram.sendVideo(
      userId,
      config.videoInstructionFileId,
      {
        caption: '🎬 <b>Видео-инструкция по генерации фото</b>\n\nСмотрите короткое видео, чтобы легко и быстро понять, как оживлять свои фотографии и получать потрясающие результаты ✨📸',
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Назад', callback_data: 'photo_animation' }]
          ]
        }
      }
    );
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
😍 Каждая семья — это история, которую стоит сохранить

Выполнили заказ для Светланы,  сделали настоящее чудо — вдохнули жизнь в старые фото и записали песню о семье 💞

Теперь это не просто кадры, а целая история в музыке и образах.

💌 Хочешь сохранить свои воспоминания так же красиво? Пиши @obrabotych_support
  `.trim();

  await ctx.telegram.sendVideo(
    userId,
    config.orderVideoFileId,
    {
      caption: orderVideoMessage,
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Главное меню', callback_data: 'main_menu' }]
        ]
      }
    }
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
