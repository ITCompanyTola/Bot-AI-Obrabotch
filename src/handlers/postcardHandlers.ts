import { Telegraf } from 'telegraf';
import { BotContext, UserState } from '../types';
import { Database } from '../database';
import { getPostcardMessage, getPostcardPhotoMessage, POSCTARD_MESSAGE, POSTCARD_MESSAGE_START, POSTCARD_PHOTO_START, POSTCARD_PHOTO_START_WIHOUT, PRICES } from '../constants';

const HERO_PHOTO_TEXT: string = 'AgACAgIAAxkBAAECXcRpSD15nEGe6b_YhiiRMHgfGnhN-QACWw9rG75EQUorhT9YX3BGFwEAAwIAA3gAAzYE';
const HERO_PHOTO_VIDEO_ID: string = 'BAACAgIAAxkBAAECaetpSXzBT3SjPpEi5XTEnSVVg5yXJwACU5EAAhKRSUrP-iMveUqEuzYE';
const EXAMPLE_POSTCARD_PHOTO_ID: string = 'AgACAgIAAxkBAAECXdFpSD25-QLIejlyURmKIPm_QOBbwgACXQ9rG75EQUq_ZhrnMheB_wEAAwIAA3gAAzYE'; // Загрузить и вставить свое фото
const POSTCARD_INSTRUCTION: string = ''; // Загрузить и вставить свое видео

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
    const postcardMessage = POSCTARD_MESSAGE;
    await ctx.telegram.sendMessage(userId, postcardMessage, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{text: '💌 Открытка из текста', callback_data: 'postcard_text'}],
          [{text: '🏞 Открытка из фото', callback_data: 'postcard_photo'}],
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

    const balance = await Database.getUserBalance(userId);

    const message = getPostcardMessage(balance);

    try {
      await ctx.replyWithPhoto(HERO_PHOTO_TEXT, {
        parse_mode: 'HTML',
        caption: message,
        reply_markup: {
          inline_keyboard: [
            [{text: '💌 Создать открытку', callback_data: 'postcard_text_start'}],
            [{text: 'Видео-инструкция', callback_data: 'postcard_text_instruction'}],
            [{text: '💳 Пополнить баланс', callback_data: 'refill_balance_from_postcard_text'}],
            [{text: 'Назад', callback_data: 'postcard'}]
          ]
        }

      })
    } catch (error: any) {
      console.log(error);
      await ctx.reply(message, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{text: '💌 Открытка из текста ', callback_data: 'postcard_text_start'}],
          [{text: 'Видео-инструкция', callback_data: 'postcard_text_instruction'}],
          [{text: '💳 Пополнить баланс', callback_data: 'refill_balance_from_postcard_text'}],
          [{text: 'Назад', callback_data: 'postcard'}]
        ]
      }
    })
    }
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

    const message = POSTCARD_MESSAGE_START;

    if (await Database.hasEnoughBalance(userId, PRICES.POSTCARD_TEXT)) {
      userStates.set(userId, {
        step: 'waiting_postcard_text',
      });

      await ctx.reply(message, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{text: 'Назад', callback_data: 'postcard_text'}]
          ]
        }
      })
    } else {
      const balance = await Database.getUserBalance(userId);

    const paymentMessage = `
💰 Ваш баланс: ${balance.toFixed(2)}₽
💌 Генерация 1 Открытки: ${PRICES.POSTCARD_TEXT.toFixed(2)}₽
    
Выберете способ оплаты ⤵️`.trim();
    
    await ctx.telegram.sendMessage(userId, paymentMessage, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{text: 'Оплата картой', callback_data: 'refill_balance_from_postcard_text'}],
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

    const balance = await Database.getUserBalance(userId);

    const message = getPostcardPhotoMessage(balance);
    
    try {
      await ctx.replyWithVideo(HERO_PHOTO_VIDEO_ID, {
        parse_mode: 'HTML',
        caption: message,
        reply_markup: {
          inline_keyboard: [
            [{text: '🏞 Создать открытку', callback_data: 'postcard_photo_start'}],
            [{text: 'Видео-инструкция', callback_data: 'postcard_photo_instruction'}],
            [{text: '💳 Пополнить баланс', callback_data: 'refill_balance_from_postcard_photo'}],
            [{text: 'Назад', callback_data: 'postcard'}]
          ]
        }
      })
    } catch(error: any) {
      await ctx.reply(message, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{text: '💌 Создать открытку  ', callback_data: 'postcard_photo_start'}],
          [{text: 'Видео-инструкция', callback_data: 'postcard_photo_instruction'}],
          [{text: '💳 Пополнить баланс', callback_data: 'refill_balance_from_postcard_photo'}],
          [{text: 'Назад', callback_data: 'postcard'}]
        ]
      }
    });
    }
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

    const message = POSTCARD_PHOTO_START;
    
    if (await Database.hasEnoughBalance(userId, PRICES.POSTCARD_PHOTO)) {
      userStates.set(userId, {
        step: 'waiting_postcard_photo',
      });
      if (EXAMPLE_POSTCARD_PHOTO_ID && EXAMPLE_POSTCARD_PHOTO_ID.length > 0) {
        try {
          await ctx.replyWithPhoto(EXAMPLE_POSTCARD_PHOTO_ID, {
          caption: message,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{text: 'Назад', callback_data: 'postcard_photo'}]
            ]
          }
        });
        } catch (error: any) {
          const messageWitoutExample = POSTCARD_PHOTO_START_WIHOUT;
          await ctx.reply(messageWitoutExample, {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [{text: 'Назад', callback_data: 'postcard_photo'}]
              ]
            }
          });
        }
        return;
      }
      await ctx.reply(message, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{text: 'Назад', callback_data: 'postcard_photo'}]
          ]
        }
      });
    } else {
      const balance = await Database.getUserBalance(userId);

    const paymentMessage = `
💰 Ваш баланс: ${balance.toFixed(2)}₽
🏞 Создание 1 Открытки: ${PRICES.POSTCARD_PHOTO.toFixed(2)}₽
    
Выберете способ оплаты ⤵️`.trim();
    
    await ctx.telegram.sendMessage(userId, paymentMessage, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{text: 'Оплата картой', callback_data: 'refill_balance_from_postcard_photo'}],
          [{text: 'Главное меню', callback_data: 'main_menu'}]
        ]
      }
    });
    }
  });
}
