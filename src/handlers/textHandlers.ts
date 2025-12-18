import { Telegraf, Markup } from 'telegraf';
import { BotContext, UserState } from '../types';
import { Database } from '../database';
import { PRICES } from '../constants';
import { processVideoGeneration } from '../services/klingService';
import { logToFile } from '../bot';
import { processPhotoRestoration, processDMPhotoCreation } from '../services/nanoBananaService';
import { processPhotoColorize } from '../services/nanoBananaProService';
import { broadcastMessageHandler, broadcastPhotoHandler, broadcastVideoHandler } from './broadcast';
import { processVideoDMGeneration } from '../services/veoService';
import { updatePrompt } from '../services/openaiService';

function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function registerTextHandlers(bot: Telegraf<BotContext>, userStates: Map<number, UserState>) {
  bot.on('photo', async (ctx) => {
    console.log(ctx.message.photo[ctx.message.photo.length - 1].file_id);
    const userId = ctx.from?.id;
    if (!userId) return;
    
    const userState = userStates.get(userId);
    if (userState?.step === 'waiting_photo') {
      const photo = ctx.message.photo[ctx.message.photo.length - 1];
    
      userStates.set(userId, {
        step: 'waiting_description',
        photoFileId: photo.file_id
      });
    
      const descriptionMessage = `
🖼 <b>Опишите, как должна ожить фотография</b>

Укажите, что именно должно происходить с каждым человеком на фото: отдельно или все вместе.

<b>Например:</b>
- Улыбается в камеру без видимых зубов;
- Показывает язык на камеру;
- Машет рукой в камеру;
- Нежно обнимает человека и целует его;
…и любые другие подобные действия ✨

❗️<b>Важно:</b>

- <b><i>Не присылайте 18+ контент</i></b> и описания соответствующих действий. Такие запросы не обрабатываются, и оплата за генерацию возвращена не будет.

- <b><i>Допустимо</i></b> присылать фото в купальнике или белье с нейтральным описанием вроде "Позирует на камеру" — мы не звери 😅

- <b><i>Не пишите слишком длинный и сложный запрос</i></b>, это всего лишь оживление фотографии до 5 секунд, а не сложный видеоролик
    `.trim();

      await ctx.reply(descriptionMessage, { parse_mode: 'HTML' });
    }

    if (userState?.step === 'waiting_for_restoration_photo') {
      const photo = ctx.message.photo[ctx.message.photo.length - 1];
      const prompt = 'Restore this old photo: improve sharpness, remove defects, but preserve the original colors without recoloring.';

      processPhotoRestoration(ctx, userId, photo.file_id, prompt);

      userStates.delete(userId);
    }

    if (userState?.step === 'waiting_for_colorize_photo') {
      const photo = ctx.message.photo[ctx.message.photo.length - 1];
      const prompt = 'Convert a black-and-white photo to color and improve the quality and clarity of the photo';

      processPhotoColorize(ctx, userId, photo.file_id, prompt);
    }


    // Выполняется один раз
    if (userState?.step === 'waiting_DM_photo_generation') {
      const photo = ctx.message.photo[ctx.message.photo.length - 1];
      const prompt = 'Russian Father Frost, long red coat down to the floor, thick white fur trim, gold braid, red belt, tall red hat with fur and gold trim, very long curly white beard down to his waist, red mittens with fur, majestic posture, photorealistic, premium class. Santa Claus should be approximately 165 cm tall and fit well into the loaded image';

      userStates.set(userId, {
        ...userState,
        photoFileId: photo.file_id
      });
      const newUserState = userStates.get(userId);
      if (newUserState === undefined) return;
      processDMPhotoCreation(ctx, userId, newUserState, prompt);
    }

    if (userState?.step === 'waiting_broadcast_photo') {
      broadcastPhotoHandler(ctx, userId, userState);
    }
  });

  bot.on('text', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;
    
    const userState = userStates.get(userId);

    if (userState?.step === 'waiting_broadcast_message') {
      broadcastMessageHandler(ctx, userId, userState);
      return;
    }

    if (userState?.step === 'waiting_postcard_text') {
      const prompt = ctx.message.text.trim();
      
      return;
    }

    if (userState?.step === 'waiting_DM_text') {
      const prompt = ctx.message.text.trim();

      console.log(`📝 Сохранен промпт для пользователя ${userId}: "${prompt}"`);

      if (userState.dmPhotoFileId) {
        processVideoDMGeneration(ctx, userId, userState.dmPhotoFileId, prompt);
      } else {
        await ctx.reply('❌ Произошла ошибка. Попробуйте снова.');
      }

      userStates.delete(userId);
      return;
    }
    
    if (userState?.step === 'waiting_email') {
      const email = ctx.message.text.trim();
      
      if (!validateEmail(email)) {
        await ctx.reply('❌ Неверный формат email. Пожалуйста, введите корректный email адрес:');
        return;
      }
      
      await Database.saveUserEmail(userId, email);
      logToFile(`✅ Email сохранен для пользователя ${userId}: ${email}`);
      
      const amount = userState.pendingPaymentAmount;
      if (!amount) {
        await ctx.reply('❌ Произошла ошибка. Попробуйте снова.');
        userStates.delete(userId);
        return;
      }
      
      let backAction = 'refill_balance';
      if (userState.refillSource === 'profile') {
        backAction = 'refill_balance_from_profile';
      } else if (userState.refillSource === 'music') {
        backAction = 'refill_balance_from_music';
      } else if (userState?.refillSource === 'restoration') {
        backAction = 'refill_balance_from_restoration';
      } else if (userState?.refillSource === 'colorize') {
        backAction = 'refill_balance_from_colorize';
      } else if (userState?.refillSource === 'dm') {
        backAction = 'refill_balance_from_dm';
      }
      
      userStates.set(userId, {
        ...userState,
        step: null,
        pendingPaymentAmount: undefined
      });
      
      const { showPaymentMessage } = await import('./payment');
      await showPaymentMessage(ctx, amount, userStates, backAction, true);
      return;
    }
    
    if (userState?.step === 'waiting_music_text') {
      const musicText = ctx.message.text;
      
      userStates.set(userId, {
        step: 'waiting_music_style',
        musicText: musicText
      });
      
      console.log(`🎵 Сохранен текст музыки для пользователя ${userId}: "${musicText}"`);
      
      const styleMessage = `— Выберите <b><i>музыкальный стиль</i></b> из предложенных вариантов`;
      
      await ctx.reply(
        styleMessage,
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [
              Markup.button.callback('Поп', 'music_style_pop'),
              Markup.button.callback('К-поп', 'music_style_kpop'),
              Markup.button.callback('R&B', 'music_style_rnb')
            ],
            [
              Markup.button.callback('Хип-хоп', 'music_style_hiphop'),
              Markup.button.callback('Дэнс', 'music_style_dance')
            ],
            [Markup.button.callback('Назад', 'start_music_creation')]
          ])
        }
      );
      return;
    }
    
    if (userState?.step === 'waiting_music_style') {
      return;
    }
    
    if (userState?.step !== 'waiting_description' || !userState.photoFileId) return;
    
    const prompt = ctx.message.text;

    await ctx.reply('📝 Пожалуйста, подождите... Ваш промпт улучшается');

    const updatedPromptMessage = await updatePrompt(prompt);

    userStates.set(userId, {
      ...userState,
      prompt: prompt,
      generatedPrompt: updatedPromptMessage
    })

    const message = `Ваш промпт:\n${prompt}\n\nОтредактированный промпт:\n${updatedPromptMessage}`
    await ctx.reply(message, {
      reply_markup: {
        inline_keyboard: [
          [{text: 'Оставляем', callback_data: 'confirm_ai_prompt'}],
          [{text: 'Пересгенерировать', callback_data: 'regenerate_prompt'}],
          [{text: 'Использовать свой', callback_data: 'confirm_prompt'}],
        ]
      }
    })
  });

  bot.on('video', (ctx) => {
    console.log('Видео получено', ctx.message.video.file_id);
    const userId = ctx.from?.id;
    if (!userId) return;
    
    const userState = userStates.get(userId);
    if (!userState) return;
    
    if (userState?.step !== 'waiting_broadcast_video') return;

    broadcastVideoHandler(ctx, userId, userState);
  });

  bot.action('regenerate_prompt', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from?.id;
    if (!userId) return;
    const userState = userStates.get(userId);
    if (!userState || !userState.prompt) return;
    
    await ctx.reply('📝 Пожалуйста, подождите... Ваш промпт улучшается');

    const updatedPromptMessage = await updatePrompt(userState.prompt);

    userStates.set(userId, {
      ...userState,
      generatedPrompt: updatedPromptMessage
    })

    const message = `Ваш промпт:\n${userState.prompt}\n\nОтредактированный промпт:\n${updatedPromptMessage}`
    await ctx.reply(message, {
      reply_markup: {
        inline_keyboard: [
          [{text: 'Оставляем', callback_data: 'confirm_ai_prompt'}],
          [{text: 'Пересгенерировать', callback_data: 'regenerate_prompt'}],
          [{text: 'Использовать свой', callback_data: 'confirm_prompt'}],
        ]
      }
    })
  });

  bot.action('confirm_prompt', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from?.id;
    if (!userId) return;
    const userState = userStates.get(userId);
    if (!userState) return;
    
    console.log(`📝 Сохранен промпт для пользователя ${userId}: "${userState.generatedPrompt}"`);
    
    const balance = await Database.getUserBalance(userId);
    const hasBalance = await Database.hasEnoughBalance(userId, PRICES.PHOTO_ANIMATION);
    
    if (!hasBalance) {
      const paymentMessage = `
<blockquote>💰 Ваш баланс: ${balance.toFixed(2)} ₽
📹 Оживление 1 фото = ${PRICES.PHOTO_ANIMATION}₽ / $1</blockquote>

Выберете способ оплаты ⤵️
      `.trim();

      await ctx.reply(
        paymentMessage,
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('Оплата картой', 'refill_balance')],
            [Markup.button.callback('Главное меню', 'main_menu')]
          ])
        }
      );
      return;
    }
    
    await ctx.reply('⏳ Начинаю генерацию... Это займет около 3 минут.');
    
    if (userState.photoFileId == undefined || userState.generatedPrompt == undefined) return;
    processVideoGeneration(ctx, userId, userState.photoFileId, userState.generatedPrompt);
    
    userStates.delete(userId);
  });

  bot.action('confirm_ai_prompt', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from?.id;
    if (!userId) return;
    const userState = userStates.get(userId);
    if (!userState) return;
    
    console.log(`📝 Сохранен промпт для пользователя ${userId}: "${userState.generatedPrompt}"`);
    
    const balance = await Database.getUserBalance(userId);
    const hasBalance = await Database.hasEnoughBalance(userId, PRICES.PHOTO_ANIMATION);
    
    if (!hasBalance) {
      const paymentMessage = `
<blockquote>💰 Ваш баланс: ${balance.toFixed(2)} ₽
📹 Оживление 1 фото = ${PRICES.PHOTO_ANIMATION}₽ / $1</blockquote>

Выберете способ оплаты ⤵️
      `.trim();

      await ctx.reply(
        paymentMessage,
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('Оплата картой', 'refill_balance')],
            [Markup.button.callback('Главное меню', 'main_menu')]
          ])
        }
      );
      return;
    }
    
    await ctx.reply('⏳ Начинаю генерацию... Это займет около 3 минут.');
    
    if (userState.photoFileId == undefined || userState.generatedPrompt == undefined) return;
    processVideoGeneration(ctx, userId, userState.photoFileId, userState.generatedPrompt);
    
    userStates.delete(userId);
  });
}
