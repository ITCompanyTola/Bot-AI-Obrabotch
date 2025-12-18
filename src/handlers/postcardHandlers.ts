import { Telegraf } from 'telegraf';
import { BotContext, UserState } from '../types';
import { Database } from '../database';
import { PRICES } from '../constants';

const EXAMPLE_POSTCARD: string = 'AgACAgIAAxkBAAIGhWlAIxZIpY4AAZ9uqx4rBQZGsKDvGAACyg5rG-3UAAFKLeXPpsSJVG0BAAMCAAN4AAM2BA'; // Загрузить и вставить свое фото
const POSTCARD_INSTRUCTION: string = 'BAACAgIAAxkBAAIG-GlASMGo3MjJcmQ97JvBvrpEboDhAAJZiwACGMQJSrcljU_f0NikNgQ'; // Загрузить и вставить свое видео

export function registerPostcardHandlers(bot: Telegraf<BotContext>, userStates: Map<number, UserState>) {
  bot.action('postcard', async (ctx) => {
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
Начало открытки`.trim();

    await ctx.telegram.sendMessage(userId, photoRestorationMessage, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{text: 'Создать открытку', callback_data: 'postcard_text'}],
          [{text: 'Открытка из фото', callback_data: 'postcard_photo'}],
          [{text: 'Главное меню', callback_data: 'main_menu'}],
        ]
      }
    });
  });

  bot.action('postcard_text', async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes('query is too old')) {
        console.error('Ошибка answerCbQuery:', error.message);
      }
    }

    const userId = ctx.from?.id;
    if (!userId) return;

    const message = 'Создать открытку';

    await ctx.reply(message, {
      reply_markup: {
        inline_keyboard: [
          [{text: 'Создать открытку', callback_data: 'postcard_text_start'}],
          [{text: 'Видео-инструкция', callback_data: 'postcard_text_instruction'}],
          [{text: 'Пополнить баланс', callback_data: 'refill_balance_from_postcard_text'}],
          [{text: 'Назад', callback_data: 'postcard'}]
        ]
      }
    })
  });

  bot.action('postcard_text_start', async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes('query is too old')) {
        console.error('Ошибка answerCbQuery:', error.message);
      }
    }

    const userId = ctx.from?.id;
    if (!userId) return;

    const message = 'Введите текст для генерации октрытки';

    if (await Database.hasEnoughBalance(userId, PRICES.POSTCARD)) {
      userStates.set(userId, {
        step: 'waiting_postcard_text',
      });

      await ctx.reply(message, {
        reply_markup: {
          inline_keyboard: [
            [{text: 'Назад', callback_data: 'postcard_text'}]
          ]
        }
      })
    } else {
      const balance = await Database.getUserBalance(userId);

    const paymentMessage = `
💰 Ваш баланс: ${balance.toFixed(2)} ₽
📸 Создание 1 Открытки = ${PRICES.POSTCARD}₽
    
Выберете способ оплаты ⤵️`.trim();
    
    await ctx.telegram.sendMessage(userId, paymentMessage, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{text: 'Оплата картой', callback_data: 'refill_balance_from_postcard'}],
          [{text: 'Главное меню', callback_data: 'main_menu'}]
        ]
      }
    });
    }
  });

  bot.action('postcard_photo', async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes('query is too old')) {
        console.error('Ошибка answerCbQuery:', error.message);
      }
    }
    
    const userId = ctx.from?.id;
    if (!userId) return;

    const message = 'Создать открытку из фото';
    await ctx.reply(message, {
      reply_markup: {
        inline_keyboard: [
          [{text: 'Создать открытку', callback_data: 'postcard_photo_start'}],
          [{text: 'Видео-инструкция', callback_data: 'postcard_photo_instruction'}],
          [{text: 'Пополнить баланс', callback_data: 'refill_balance_from_postcard_photo'}],
          [{text: 'Назад', callback_data: 'postcard'}]
        ]
      }
    });
  })

  bot.action('postcard_photo_start', async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes('query is too old')) {
        console.error('Ошибка answerCbQuery:', error.message);
      }
    }

    const userId = ctx.from?.id;
    if (!userId) return;

    const message = 'Отправьте фото для создания из него открытки';
    
    if (await Database.hasEnoughBalance(userId, PRICES.POSTCARD)) {
      userStates.set(userId, {
        step: 'waiting_postcard_photo',
      });
      await ctx.reply(message, {
        reply_markup: {
          inline_keyboard: [
            [{text: 'Назад', callback_data: 'postcard_photo'}]
          ]
        }
      });
    } else {
      const balance = await Database.getUserBalance(userId);

    const paymentMessage = `
💰 Ваш баланс: ${balance.toFixed(2)} ₽
📸 Создание 1 Открытки = ${PRICES.POSTCARD}₽
    
Выберете способ оплаты ⤵️`.trim();
    
    await ctx.telegram.sendMessage(userId, paymentMessage, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{text: 'Оплата картой', callback_data: 'refill_balance_from_postcard'}],
          [{text: 'Главное меню', callback_data: 'main_menu'}]
        ]
      }
    });
    }
  });
}
