import { Telegraf } from 'telegraf';
import { BotContext, UserState } from '../types';
import { Database } from '../database';
import { DED_MOROZ_GENERATION_EXAMPLE, DED_MOROZ_INSTRUCTION, DED_MOROZ_MESSAGE, DED_MOROZ_REVIVE_EXAMPLE, dedMorozGeneration, dedMorozRevive, PRICES } from '../constants';import { text } from 'stream/consumers';
;

const PHOTO_GENERATION_EXAMPLE_ID: string = '';
const PHOTO_REVIVE_EXAMPLE_ID: string = '';

const VIDEO_INSTRUCTION_ID: string = '';

export function registerDMHandlers(bot: Telegraf<BotContext>, userStates: Map<number, UserState>) {
  bot.action('ded_moroz', async (ctx) => {
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
    
    const dedMorozMessage = DED_MOROZ_MESSAGE;
    
    await ctx.editMessageText(DED_MOROZ_MESSAGE, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Генерация Д.Мороза', callback_data: 'ded_moroz_generate' }],
          [{ text: 'Оживление Д.Мороза', callback_data: 'ded_moroz_animate' }],
          [{ text: 'Видео-инструкция', callback_data: 'ded_moroz_instruction' }],
          [{ text: 'Главное меню', callback_data: 'main_menu' }]
        ]
      }
    });
  });

  bot.action('ded_moroz_generate', async (ctx) => {
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

    const message = dedMorozGeneration(balance);
    
    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Генерация Д.Мороза', callback_data: 'ded_moroz_generate_start' }],
          [{text: '💳 Пополнить баланс', callback_data: 'refill_balance_from_dm_photo'}],
          [{ text: 'Назад', callback_data: 'ded_moroz' }]
        ]
      }
    });
      
  });

  bot.action('ded_moroz_generate_start', async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes('query is too old')) {
        console.error('Oshibka answerCbQuery:', error.message);
      }
    }
    
    const userId = ctx.from?.id;
    if (!userId) return;

    const hasEnoughBalance = await Database.hasEnoughBalance(userId, PRICES.DED_MOROZ_PHOTO);

    if (hasEnoughBalance) {
      userStates.set(userId, { step: 'waiting_DM_photo_generation' });

      const message = DED_MOROZ_GENERATION_EXAMPLE;
      
      if (PHOTO_GENERATION_EXAMPLE_ID && PHOTO_GENERATION_EXAMPLE_ID.length > 0) {
        await ctx.telegram.sendPhoto(userId, PHOTO_GENERATION_EXAMPLE_ID, {
          caption: message,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Назад', callback_data: 'ded_moroz_generate' }]
            ]
          }
        });
      } else {
        await ctx.editMessageText(message.substring(21), {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Назад', callback_data: 'ded_moroz_generate' }]
            ]
          }
        });
      }
      return;
    }

    const balance = await Database.getUserBalance(userId);

    const paymentMessage = `
💰 Ваш баланс: ${balance.toFixed(2)} ₽
🎅 Геренация 1 фото = ${PRICES.DED_MOROZ_PHOTO}₽
    
Выберете способ оплаты ⤵️`.trim();
    
    await ctx.telegram.sendMessage(userId, paymentMessage, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{text: 'Оплата картой', callback_data: 'refill_balance_from_dm_photo'}],
          [{text: 'Главное меню', callback_data: 'main_menu'}]
        ]
      }
    });
  });

  bot.action('ded_moroz_animate', async (ctx) => {
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

    const message = dedMorozRevive(balance);

    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Оживление Д.Мороза', callback_data: 'ded_moroz_animate_start' }],
          [{text: '💳 Пополнить баланс', callback_data: 'refill_balance_from_dm_video'}],
          [{ text: 'Назад', callback_data: 'ded_moroz' }]
        ]
      }
    });
  });

  bot.action('ded_moroz_animate_start', async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes('query is too old')) {
        console.error('Ошибка answerCbQuery:', error.message);
      }
    }
    
    const userId = ctx.from?.id;
    if (!userId) return;

    const hasEnoughBalance = await Database.hasEnoughBalance(userId, PRICES.DED_MOROZ_VIEDO);

    if (hasEnoughBalance) {
      userStates.set(userId, { step: 'waiting_DM_photo_for_video' });

      const message = DED_MOROZ_REVIVE_EXAMPLE;

      if (PHOTO_REVIVE_EXAMPLE_ID && PHOTO_REVIVE_EXAMPLE_ID.length > 0) {
        await ctx.telegram.sendPhoto(userId, PHOTO_REVIVE_EXAMPLE_ID, {
          caption: message,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Назад', callback_data: 'ded_moroz_animate' }]
            ]
          }
        });
      } else {
        await ctx.editMessageText(message.substring(21), {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Назад', callback_data: 'ded_moroz_animate' }]
            ]
          }
        });
      }
      return;
    }

    const balance = await Database.getUserBalance(userId);

    const paymentMessage = `
💰 Ваш баланс: ${balance.toFixed(2)} ₽
🎅 Геренация 1 видео = ${PRICES.DED_MOROZ_VIEDO}₽
    
Выберете способ оплаты ⤵️`.trim();
    
    await ctx.telegram.sendMessage(userId, paymentMessage, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{text: 'Оплата картой', callback_data: 'refill_balance_from_dm_video'}],
          [{text: 'Главное меню', callback_data: 'main_menu'}]
        ]
      }
    });
  });

  bot.action('ded_moroz_instruction', async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes('query is too old')) {
        console.error('Ошибка answerCbQuery:', error.message);
      }
    }
    
    const userId = ctx.from?.id;
    if (!userId) return;

    const message = DED_MOROZ_INSTRUCTION;
    
    if (VIDEO_INSTRUCTION_ID && VIDEO_INSTRUCTION_ID.length > 0) {
      await ctx.telegram.sendVideo(userId, VIDEO_INSTRUCTION_ID, {
        caption: message,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Назад', callback_data: 'ded_moroz' }]
          ]
        }
      });
    } else {
      await ctx.editMessageText('Ошибка загрузки видео!', {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Назад', callback_data: 'ded_moroz' }]
          ]
        }
      });
    }
  });
}
