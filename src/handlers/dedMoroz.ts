import { Telegraf } from 'telegraf';
import { BotContext, UserState } from '../types';
import { Database } from '../database';
import { DED_MOROZ_INSTRUCTION, dedMorozStartMessage, dedMorozStartMessageWithoutPhoto, getDedMorozMessage, PRICES } from '../constants';
import { processDMPhotoCreation } from '../services/nanoBananaService';

const PHOTO_GENERATION_EXAMPLE_ID: string = 'AgACAgIAAxkBAAIH0mlBg6y50IezM_kY_My77ebA96oMAAI9Emsb7dQISjIqf-2iAAHmGgEAAwIAA3kAAzYE';
const VIDEO_EXAMPLE_ID: string = 'BAACAgIAAxkDAAIIAmlBjEHGqE6ISIeXUTxsODb5MlSBAALIlwACPZUQSqqFRol_8fhoNgQ';
const VIDEO_INSTRUCTION_ID: string = 'BAACAgIAAxkBAAII5GlCrrE10M9OA4c_g16cPWvWJM5rAALYjAACzBkZSiWoTfr9I-2PNgQ';

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
    
    const dedMorozMessage = getDedMorozMessage(balance);
    
    if (VIDEO_EXAMPLE_ID && VIDEO_EXAMPLE_ID.length > 0) {
      await ctx.telegram.sendVideo(userId, VIDEO_EXAMPLE_ID, {
        caption: dedMorozMessage,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🎅 Поздравление Д.Мороза', callback_data: 'ded_moroz_start' }],
            [{ text: 'Видео-инструкция', callback_data: 'ded_moroz_instruction' }],
            [{ text: '💳 Пополнить баланс', callback_data: 'refill_balance_from_dm' }],
            [{ text: 'Главное меню', callback_data: 'main_menu' }]
          ]
        }
      });
      return;
    }
    await ctx.telegram.sendMessage(userId, dedMorozMessage, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🎅 Поздравление Д.Мороза', callback_data: 'ded_moroz_start' }],
          [{ text: 'Видео-инструкция', callback_data: 'ded_moroz_instruction' }],
          [{ text: '💳 Пополнить баланс', callback_data: 'refill_balance_from_dm' }],
          [{ text: 'Главное меню', callback_data: 'main_menu' }]
        ]
      }
    });
  });

  bot.action('ded_moroz_start', async (ctx) => {
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

    if (await Database.hasEnoughBalance(userId, PRICES.DED_MOROZ)) {
      const message = dedMorozStartMessage;

      userStates.set(userId, {
        step: 'waiting_DM_photo_generation',
        freeGenerations: 2
      });
      if (PHOTO_GENERATION_EXAMPLE_ID && PHOTO_GENERATION_EXAMPLE_ID.length > 0) {
        await ctx.telegram.sendPhoto(userId, PHOTO_GENERATION_EXAMPLE_ID, {
          caption: message,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Назад', callback_data: 'ded_moroz' }]
            ]
          }
        });
      } else {
        const message = dedMorozStartMessageWithoutPhoto
        await ctx.telegram.sendMessage(userId, message, {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Назад', callback_data: 'ded_moroz' }]
            ]
          }
        })
      }
      
      return;
    } else {

      const paymentMessage = `
💰 Ваш баланс: ${balance.toFixed(2)} ₽
🎅 Поздравление Д.Мороза = ${PRICES.DED_MOROZ}₽
    
Выберете способ оплаты ⤵️`.trim();
    
      await ctx.telegram.sendMessage(userId, paymentMessage, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{text: 'Оплата картой', callback_data: 'refill_balance_from_dm'}],
            [{text: 'Главное меню', callback_data: 'main_menu'}]
          ]
        }
      });
    }
  });

  bot.action('repeat_dm', async (ctx) => {
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
    if (!userState || !userState.photoFileId) return;
    const prompt = 'Russian Father Frost, long red coat down to the floor, thick white fur trim, gold braid, red belt, tall red hat with fur and gold trim, very long curly white beard down to his waist, red mittens with fur, majestic posture, photorealistic, premium class. Santa Claus should be approximately 165 cm tall and fit well into the loaded image';
    
    processDMPhotoCreation(ctx, userId, userState, prompt);
  });

  bot.action('confirm_dm', async (ctx) => {
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
    if (!userState || !userState.photoFileId) return;

    const message = `
🖼 <b>Опишите, какое поздравление должно быть от Деда Мороза по нашему примеру</b>

Пример описания для поздравления:
<pre><code>Привет, 'Имя ребенка'!\nПоздравляю тебя С Новым годом!\nПусть сбудутся все мечты, а чудеса и радость всегда будут рядом</code></pre>

❗️<b>Важно:</b>

- Пожалуйста, <b><i>не пишите слишком длинный текст</i></b> — видео длится до 8 секунд, короткие пожелания звучат волшебнее! ✨`.trim();

    userStates.set(userId, {
      ...userState,
      step: 'waiting_DM_text',
    })
    await ctx.telegram.sendMessage(userId, message, {
      parse_mode: 'HTML',
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
      await ctx.telegram.sendMessage(userId,'Ошибка загрузки видео!', {
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
