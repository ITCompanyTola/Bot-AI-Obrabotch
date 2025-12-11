import { Telegraf, Markup } from 'telegraf';
import { BotContext, UserState } from '../types';
import { Database } from '../database';
import { PRICES } from '../constants';
import { processVideoGeneration } from '../services/klingService';
import { logToFile } from '../bot';
import { processPhotoRestoration } from '../services/nanoBananaService';
import { processPhotoColorize } from '../services/nanoBananaProService';

function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function registerTextHandlers(bot: Telegraf<BotContext>, userStates: Map<number, UserState>) {
  bot.on('photo', async (ctx) => {
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
Например:
Позирует на камеру
- Показывает язык
- Машет рукой
- Выходит из кадра
- Девушка обнимает мужчину
- Внук целует бабушку в щеку
…и любые другие подобные действия ✨

❗️<b>Важно:</b>

- <b><i>Не присылайте 18+ контент</i></b> и описания соответствующих действий. Такие запросы не обрабатываются, и оплата за генерацию возвращена не будет.

- <b><i>Допустимо</i></b> присылать фото в купальнике или белье с нейтральным описанием вроде "Позирует на камеру" — мы не звери 😅
    `.trim();

      await ctx.reply(descriptionMessage, { parse_mode: 'HTML' });
    }

    if (userState?.step === 'waiting_for_restoration_photo') {
      const photo = ctx.message.photo[ctx.message.photo.length - 1];
      const prompt = 'Restore the photo';

      processPhotoRestoration(ctx, userId, photo.file_id, prompt);

      userStates.delete(userId);
    }

    if (userState?.step === 'waiting_for_colorize_photo') {
      const photo = ctx.message.photo[ctx.message.photo.length - 1];
      const prompt = 'Restore this old photo: improve sharpness, remove defects, but preserve the original colors without recoloring.';

      processPhotoColorize(ctx, userId, photo.file_id, prompt);
    }
  });

  bot.on('text', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;
    
    const userState = userStates.get(userId);
    
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
    
    userStates.set(userId, {
      step: 'waiting_payment',
      photoFileId: userState.photoFileId,
      prompt: prompt
    });
    
    console.log(`📝 Сохранен промпт для пользователя ${userId}: "${prompt}"`);
    
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
    
    processVideoGeneration(ctx, userId, userState.photoFileId, prompt);
    
    userStates.delete(userId);
  });
}
