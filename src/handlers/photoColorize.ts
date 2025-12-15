import { Telegraf } from 'telegraf';
import { BotContext, UserState } from '../types';
import { Database } from '../database';
import { PRICES } from '../constants';


const EXAMPLE_PHOTO_COLORIZE: string = 'AgACAgIAAxkBAAIGhGlAIs00mw5gM4m18PZee-1LvrC6AALHDmsb7dQAAUrwAZeP0-rZ7wEAAwIAA3kAAzYE'; // Загрузить и вставить свое фото
const PHOTO_COLORIZE_INSTRUCTION: string = ''; // Загрузить и вставить свое видео

export function registerPhotoColorizeHandlers(bot: Telegraf<BotContext>, userState: Map<number, UserState>) {
  bot.action('photo_colorize', async (ctx) => {
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

    const photoColorizeMessage = `
🎨 <b>Наш Бот умеет делать волшебное перевоплощение: из чёрно-белого фото — в цветное!</b>

Вот как сгенерировать цветное фото:

1️⃣ Нажмите ниже кнопку -\n<b>«🎨 Сделать цветным фото»</b>
2️⃣ <i><b>Отправьте одну ч/б фотографию* в бот</b></i>
3️⃣ <i><b>Немного подождите</b></i> — примерно через 3 минуты бот отправит вам готовое фото 🏞⚡️

💰 Ваш баланс: ${balance.toFixed(2)} ₽
🎨 Генерация 1 цветного фото = ${PRICES.PHOTO_COLORIZE}₽

❗️* - <b>бот генерирует только одно цветное фото за раз</b>☝🏻`.trim();

    await ctx.telegram.sendMessage(userId, photoColorizeMessage, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{text: '🎨 Сделать цветным фото', callback_data: 'photo_colorize_start'}],
          [{text: '💳 Пополнить баланс', callback_data: 'refill_balance_from_colorize'}],
          [{text: 'Видео-инструкция', callback_data: 'photo_colorize_instruction'}],
          [{text: 'Главное меню', callback_data: 'main_menu'}],
        ]
      }
    });
  });

  bot.action('photo_colorize_start', async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes('query is too old')) {
        console.error('Ошибка answerCbQuery:', error.message);
      }
    }

    const userId = ctx.from?.id;
    if (!userId) return;

    const hasEnoughBalance = await Database.hasEnoughBalance(userId, PRICES.PHOTO_COLORIZE);

    if (hasEnoughBalance) {
      userState.set(userId, {step: 'waiting_for_colorize_photo'});

    const photoColorizeWaitingMessage = `
<b>📸 Пример ⤴️</b>

Отправьте <b><i>ч/б фотографию</i></b> — бот создаст ее цветную версию ✨🏞
    `.trim();
    const colorizeMessageWithoutExample = `
Отправьте <b><i>ч/б фотографию</i></b>, — бот создаст ее цветную версию ✨🏞
    `.trim();

    if (EXAMPLE_PHOTO_COLORIZE && EXAMPLE_PHOTO_COLORIZE.trim() !== '') {
      try {
        await ctx.telegram.sendPhoto(userId, EXAMPLE_PHOTO_COLORIZE, {
          caption: photoColorizeWaitingMessage,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{text: 'Назад', callback_data: 'photo_colorize'}]
            ]
          }
        });
      } catch (error) {
        console.error('Ошибка отправки фото для окрашивания: ', error);
        await ctx.telegram.sendMessage(userId, colorizeMessageWithoutExample, {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{text: 'Назад', callback_data: 'photo_colorize'}]
            ] 
          }
        });
      }
      return;
    } else {
      await ctx.telegram.sendMessage(userId, colorizeMessageWithoutExample, {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{text: 'Назад', callback_data: 'photo_colorize'}]
            ] 
          }
      });
      return;
    }
    }

    const balance = await Database.getUserBalance(userId);

    const paymentMessage = `
💰 Ваш баланс: ${balance.toFixed(2)} ₽
📸 Геренация 1 цветного фото = ${PRICES.PHOTO_COLORIZE}₽
    
Выберете способ оплаты ⤵️`.trim();
    
    await ctx.telegram.sendMessage(userId, paymentMessage, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{text: 'Оплата картой', callback_data: 'refill_balance_from_colorize'}],
          [{text: 'Главное меню', callback_data: 'main_menu'}]
        ]
      }
    });
  });

  bot.action('photo_colorize_instruction', async (ctx) => {
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
<b>🎬 Видео-инструкция по добавлению цвета на фото</b>

Смотрите короткое видео, чтобы легко и быстро понять, как добавить цвета на свои фотографии и получать потрясающие результаты ✨📸
`.trim();

    const sendErrorMessage = async (): Promise<void> => {
      const instructionErrorMessage = 'Ошибка загрузки видео. Пожалуйста вернитесь назад.'
      await ctx.telegram.sendMessage(userId, instructionErrorMessage, {
        reply_markup: {
          inline_keyboard: [
            [{text: 'Назад', callback_data: 'photo_colorize'}]
          ]
        }
      });
    }

    if (PHOTO_COLORIZE_INSTRUCTION && PHOTO_COLORIZE_INSTRUCTION.trim() !== '') {
      try {
        await ctx.telegram.sendVideo(userId, PHOTO_COLORIZE_INSTRUCTION, {
          caption: photoRestorationInstructionMessage,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{text: 'Назад', callback_data: 'photo_colorize'}]
            ] 
          }
        });
      } catch (error) {
          console.error('Ошибка отправки инструкции к окрашиванию фото', error);
          sendErrorMessage();
        }
    } else {
      sendErrorMessage();
    }
  });
}
