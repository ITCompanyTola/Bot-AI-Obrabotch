import { Telegraf, Markup } from 'telegraf';
import { BotContext, UserState } from '../types';
import { Database } from '../database';
import { PRICES } from '../constants';
import { processVideoGeneration } from '../services/klingService';
import { showMusicAdvancedParams } from './musicCreation';

export function registerTextHandlers(bot: Telegraf<BotContext>, userStates: Map<number, UserState>) {
  bot.on('photo', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;
    
    const userState = userStates.get(userId);
    if (userState?.step !== 'waiting_photo') return;
    
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
  });
  bot.on('text', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;
    
    const userState = userStates.get(userId);
    
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
              Markup.button.callback('Рок', 'music_style_rock'),
              Markup.button.callback('Поп', 'music_style_pop'),
              Markup.button.callback('Гоп', 'music_style_gop')
            ],
            [Markup.button.callback('Назад', 'start_music_creation')]
          ])
        }
      );
      return;
    }
    
    if (userState?.step === 'waiting_music_style') {
      const customStyle = ctx.message.text;
      
      userState.musicStyle = customStyle;
      userStates.set(userId, userState);
      
      console.log(`🎵 Выбран пользовательский стиль: "${customStyle}"`);
      
      await showMusicAdvancedParams(ctx);
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
    
    processVideoGeneration(ctx, userId, userState.photoFileId, prompt);
    
    userStates.delete(userId);
  });
}