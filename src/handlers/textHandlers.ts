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
      // Игнорируем текст от пользователя, ждем нажатия кнопки
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
    
    // УБРАНО ДВОЙНОЕ СПИСАНИЕ - списание происходит внутри processVideoGeneration
    processVideoGeneration(ctx, userId, userState.photoFileId, prompt);
    
    userStates.delete(userId);
  });
}

2. src/handlers/musicCreation.ts
typescriptimport { Telegraf, Markup } from 'telegraf';
import { BotContext, UserState } from '../types';
import { Database } from '../database';
import { PRICES } from '../constants';
import { processMusicGeneration } from '../services/sunoService';

async function showMusicAdvancedParams(ctx: any) {
  const advancedParamsMessage = `— Вы можете воспользоваться расширенными параметрами (выбор вокального пола, странность, влияние стиля) или пропустить этот шаг.`;
  
  await ctx.reply(
    advancedParamsMessage,
    Markup.inlineKeyboard([
      [Markup.button.callback('Пропустить', 'music_skip_params')],
      [Markup.button.callback('Назад', 'music_back_to_style')]
    ])
  );
}

async function handleMusicStyleSelection(ctx: any, userId: number, userStates: Map<number, UserState>, style: string) {
  try {
    await ctx.answerCbQuery();
  } catch (error: any) {
    if (!error.description?.includes('query is too old')) {
      console.error('Ошибка answerCbQuery:', error.message);
    }
  }
  
  const userState = userStates.get(userId);
  if (userState) {
    userState.musicStyle = style;
    userStates.set(userId, userState);
  }
  
  if (!userState?.musicText || !userState?.musicStyle) {
    await ctx.editMessageText('❌ Ошибка: не найдены данные для генерации. Начните сначала.');
    userStates.delete(userId);
    return;
  }
  
  const balance = await Database.getUserBalance(userId);
  const hasBalance = await Database.hasEnoughBalance(userId, PRICES.MUSIC_CREATION);
  
  if (!hasBalance) {
    const paymentMessage = `
💰 Ваш баланс: ${balance.toFixed(2)} ₽
🎵 Создание 1 трека = ${PRICES.MUSIC_CREATION}₽

Выберете способ оплаты ⤵️
    `.trim();

    await ctx.editMessageText(
      paymentMessage,
      Markup.inlineKeyboard([
        [Markup.button.callback('Оплата картой', 'refill_balance_from_music')],
        [Markup.button.callback('Главное меню', 'main_menu')]
      ])
    );
    return;
  }
  
  await ctx.editMessageText('⏳ Начинаю генерацию музыки... Это займет около 2 минут.');
  
  // УБРАНО ДВОЙНОЕ СПИСАНИЕ - списание происходит внутри processMusicGeneration
  processMusicGeneration(ctx, userId, userState.musicText, userState.musicStyle);
  
  userStates.delete(userId);
}

export function registerMusicCreationHandlers(bot: Telegraf<BotContext>, userStates: Map<number, UserState>) {
  bot.action('music_creation', async (ctx) => {
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
    
    const musicCreationMessage = `
🎵 <b>Наш бот умеет создавать невероятную музыку!</b>

Вот как написать свою песню:

1️⃣ <b><i>Отправьте сообщение</i></b> с описанием того, какую музыку хотите получить.
Укажите тему, жанр, стиль, язык вокала, инструменты — любые детали, которые важны именно вам 🎼✨
2️⃣ <b><i>Подождите немного</i></b> — в течение примерно 2 минут бот создаст и отправит вам готовый трек 🎧⚡️

<blockquote>💰 Ваш баланс: ${balance.toFixed(2)} ₽
🎵 Создать 1 трек = ${PRICES.MUSIC_CREATION}₽</blockquote>
    `.trim();

    await ctx.editMessageText(
      musicCreationMessage,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🎶 Начать творить', 'start_music_creation')],
          [Markup.button.callback('Видео-инструкция', 'music_video_instruction')],
          [Markup.button.callback('💳 Пополнить баланс', 'refill_balance_from_music')],
          [Markup.button.callback('Главное меню', 'main_menu')]
        ])
      }
    );
  });

  bot.action('start_music_creation', async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes('query is too old')) {
        console.error('Ошибка answerCbQuery:', error.message);
      }
    }
    
    const userId = ctx.from?.id;
    if (userId) {
      userStates.set(userId, { step: 'waiting_music_text' });
    }
    
    await ctx.editMessageText(
      'Отправьте ниже <b><i>1–2 предложения</i></b> о том, какую музыку хотите создать, или напишите полный текст для будущего трека 🎵',
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('Назад', 'music_creation')]
        ])
      }
    );
  });

  bot.action('music_video_instruction', async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes('query is too old')) {
        console.error('Ошибка answerCbQuery:', error.message);
      }
    }
    await ctx.reply('🎬 <b>Видео-инструкция по созданию музыки</b>\n\nСмотрите короткое видео, чтобы легко и быстро понять, как написать песню, выбрать стиль и получить готовый трек 🎵✨', { 
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('Назад', 'music_creation')]
      ])
    });
  });

  bot.action('music_style_pop', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;
    await handleMusicStyleSelection(ctx, userId, userStates, 'Поп');
  });

  bot.action('music_style_kpop', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;
    await handleMusicStyleSelection(ctx, userId, userStates, 'К-поп');
  });

  bot.action('music_style_rnb', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;
    await handleMusicStyleSelection(ctx, userId, userStates, 'R&B');
  });

  bot.action('music_style_hiphop', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;
    await handleMusicStyleSelection(ctx, userId, userStates, 'Хип-хоп');
  });

  bot.action('music_style_dance', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;
    await handleMusicStyleSelection(ctx, userId, userStates, 'Дэнс');
  });

  bot.action('music_back_to_style', async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes('query is too old')) {
        console.error('Ошибка answerCbQuery:', error.message);
      }
    }
    
    const styleMessage = `— Выберите <b><i>музыкальный стиль</i></b> из предложенных вариантов`;
    
    await ctx.editMessageText(
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
  });
}

export { showMusicAdvancedParams };
