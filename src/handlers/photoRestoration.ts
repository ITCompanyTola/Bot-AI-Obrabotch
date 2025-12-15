import { Telegraf } from 'telegraf';
import { BotContext, UserState } from '../types';
import { Database } from '../database';
import { PRICES } from '../constants';

const EXAMPLE_PHOTO_RESTORATION: string = 'AgACAgIAAxkBAAIGhWlAIxZIpY4AAZ9uqx4rBQZGsKDvGAACyg5rG-3UAAFKLeXPpsSJVG0BAAMCAAN4AAM2BA'; // Загрузить и вставить свое фото
const PHOTO_RESTORATION_INSTRUCTION: string = 'BAACAgIAAxkBAAIG-GlASMGo3MjJcmQ97JvBvrpEboDhAAJZiwACGMQJSrcljU_f0NikNgQ'; // Загрузить и вставить свое видео

export function registerPhotoRestorationHandlers(bot: Telegraf<BotContext>, userState: Map<number, UserState>) {
  bot.action('photo_restoration', async (ctx) => {
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

    const photoRestorationMessage = `
<b>✨ Наш Бот умеет реставрировать фото!</b>

Вот как восстановить своё фото:

1️⃣ Нажмите ниже кнопку - \n<b>«✨ Реставрировать фото»</b>
2️⃣ <i><b>Отправьте одну фотографию* в бот</b></i>
3️⃣ <i><b>Немного подождите</b></i> — примерно через 3 минуты бот отправит вам готовое фото 🏞⚡️

<blockquote>💰 Ваш баланс: ${balance.toFixed(2)} ₽
✨ Реставрация 1 фото = ${PRICES.PHOTO_RESTORATION}₽</blockquote>

❗️* - <b>бот восстанавливает только одно фото за раз</b>☝🏻`.trim();

    await ctx.telegram.sendMessage(userId, photoRestorationMessage, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{text: '✨ Реставрировать фото', callback_data: 'photo_restoration_start'}],
          [{text: '💳 Пополнить баланс', callback_data: 'refill_balance_from_restoration'}],
          [{text: 'Видео-инструкция', callback_data: 'photo_restoration_instruction'}],
          [{text: 'Главное меню', callback_data: 'main_menu'}],
        ]
      }
    });
  });

  bot.action('photo_restoration_start', async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes('query is too old')) {
        console.error('Ошибка answerCbQuery:', error.message);
      }
    }

    const userId = ctx.from?.id;
    if (!userId) return;

    const hasEnoughBalance = await Database.hasEnoughBalance(userId, PRICES.PHOTO_RESTORATION);

    if (hasEnoughBalance) {
      userState.set(userId, {step: 'waiting_for_restoration_photo'});

    const photoRestorationWaitingMessage = `
<b>📸 Пример ⤴️</b>

Отправьте <b><i>фотографию</i></b> которую нужно восстановить — бот устранит шум, повреждения и повысит качество изображения ✨🏞
    `.trim();
    const restorationMessageWithoutExample = `
Отправьте <b><i>фотографию</i></b>, которую нужно восстановить — бот устранит шум, повреждения и повысит качество изображения ✨🏞
    `.trim();

    if (EXAMPLE_PHOTO_RESTORATION && EXAMPLE_PHOTO_RESTORATION.trim() !== '') {
      try {
        await ctx.telegram.sendPhoto(userId, EXAMPLE_PHOTO_RESTORATION, {
          caption: photoRestorationWaitingMessage,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{text: 'Назад', callback_data: 'photo_restoration'}]
            ]
          }
        });
      } catch (error) {
        console.error('Ошибка отправки фото для реставрации: ', error);
        await ctx.telegram.sendMessage(userId, restorationMessageWithoutExample, {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{text: 'Назад', callback_data: 'photo_restoration'}]
            ] 
          }
        });
      }
      return;
    } else {
      await ctx.telegram.sendMessage(userId, restorationMessageWithoutExample, {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{text: 'Назад', callback_data: 'photo_restoration'}]
            ] 
          }
      });
      return;
    }
    }

    const balance = await Database.getUserBalance(userId);

    const paymentMessage = `
💰 Ваш баланс: ${balance.toFixed(2)} ₽
📸 Создание 1 Реставрации = ${PRICES.PHOTO_RESTORATION}₽
    
Выберете способ оплаты ⤵️`.trim();
    
    await ctx.telegram.sendMessage(userId, paymentMessage, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{text: 'Оплата картой', callback_data: 'refill_balance_from_restoration'}],
          [{text: 'Главное меню', callback_data: 'main_menu'}]
        ]
      }
    });
  });

  bot.action('photo_restoration_instruction', async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes('query is too old')) {
        console.error('Ошибка answerCbQuery:', error.message);
      }
    }

    const userId = ctx.from?.id;
    if (!userId) return;

    const photoRestorationInstructionMessage = `
<b>🎬 Видео-инструкция по реставрации фото</b>

Смотрите короткое видео, чтобы легко и быстро понять, как реставрировать свои фотографии и получать потрясающие результаты ✨📸
    `.trim();

    const sendErrorMessage = async (): Promise<void> => {
      const instructionErrorMessage = 'Ошибка загрузки видео. Пожалуйста вернитесь назад.'
      await ctx.telegram.sendMessage(userId, instructionErrorMessage, {
        reply_markup: {
          inline_keyboard: [
            [{text: 'Назад', callback_data: 'photo_restoration'}]
          ]
        }
      });
    }

    if (PHOTO_RESTORATION_INSTRUCTION && PHOTO_RESTORATION_INSTRUCTION.trim() !== '') {
      try {
        await ctx.telegram.sendVideo(userId, PHOTO_RESTORATION_INSTRUCTION, {
          caption: photoRestorationInstructionMessage,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{text: 'Назад', callback_data: 'photo_restoration'}]
            ] 
          }
        });
      } catch (error) {
          console.error('Ошибка отправки инструкции к реставрации фото', error);
          sendErrorMessage();
        }
    } else {
      sendErrorMessage();
    }
  });
}
