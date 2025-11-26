import { Telegraf, Markup } from 'telegraf';
import { BotContext, UserState } from '../types';
import { Database } from '../database';
import { PRICES } from '../constants';
import { processMusicGeneration } from '../services/sunoService';

async function showMusicAdvancedParams(ctx: any) {
  const advancedParamsMessage = `— Вы можете воспользоваться расширенными параметрами (выбор вокального пола, странность, влияние стиля) или пропустить этот шаг.`;
  
  await ctx.editMessageText(
    advancedParamsMessage,
    Markup.inlineKeyboard([
      [Markup.button.callback('Пропустить', 'music_skip_params')],
      [Markup.button.callback('Назад', 'music_back_to_style')]
    ])
  );
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
Наш Бот умеет писать невероятные песни!

Инструкция по написанию песни:
1) Пришлите сообщение, в котором предоставьте информацию о том, какую музыку вы хотите получить. Вы можете указать тему, жанр, стиль, язык вокала, используемые инструменты и любые другие детали на ваше усмотрение.
2) Ожидайте готовую музыку (в течение 2 минут бот пришлет ваш трек)

Также вы можете заказать музыку под ключ (по кнопке "🎁 Заказать музыку под ключ"), и мы сами ее для вас сделаем

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
      '— Отправьте ниже 1-2 предложения о том, о чем хотите создать музыку или напишите полный текст для музыки',
      Markup.inlineKeyboard([
        [Markup.button.callback('Назад', 'music_creation')]
      ])
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
    await ctx.reply('🎬 Видео-инструкция по созданию музыки в разработке...');
  });

  bot.action('music_style_rock', async (ctx) => {
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
  if (userState) {
    userState.musicStyle = 'Рок';
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
        [Markup.button.callback('Оплата картой', 'refill_balance')],
        [Markup.button.callback('Главное меню', 'main_menu')]
      ])
    );
    return;
  }
  
  await ctx.editMessageText('⏳ Начинаю генерацию музыки... Это займет около 2 минут.');
  
  const deducted = await Database.deductBalance(
    userId,
    PRICES.MUSIC_CREATION,
    `Создание музыки: ${userState.musicText.substring(0, 50)}...`
  );
  
  if (!deducted) {
    await ctx.reply('❌ Ошибка списания средств. Попробуйте позже.');
    userStates.delete(userId);
    return;
  }
  
  processMusicGeneration(ctx, userId, userState.musicText, userState.musicStyle);
  
  userStates.delete(userId);
});

bot.action('music_style_pop', async (ctx) => {
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
  if (userState) {
    userState.musicStyle = 'Поп';
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
        [Markup.button.callback('Оплата картой', 'refill_balance')],
        [Markup.button.callback('Главное меню', 'main_menu')]
      ])
    );
    return;
  }
  
  await ctx.editMessageText('⏳ Начинаю генерацию музыки... Это займет около 2 минут.');
  
  const deducted = await Database.deductBalance(
    userId,
    PRICES.MUSIC_CREATION,
    `Создание музыки: ${userState.musicText.substring(0, 50)}...`
  );
  
  if (!deducted) {
    await ctx.reply('❌ Ошибка списания средств. Попробуйте позже.');
    userStates.delete(userId);
    return;
  }
  
  processMusicGeneration(ctx, userId, userState.musicText, userState.musicStyle);
  
  userStates.delete(userId);
});

bot.action('music_style_gop', async (ctx) => {
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
  if (userState) {
    userState.musicStyle = 'Гоп';
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
        [Markup.button.callback('Оплата картой', 'refill_balance')],
        [Markup.button.callback('Главное меню', 'main_menu')]
      ])
    );
    return;
  }
  
  await ctx.editMessageText('⏳ Начинаю генерацию музыки... Это займет около 2 минут.');
  
  const deducted = await Database.deductBalance(
    userId,
    PRICES.MUSIC_CREATION,
    `Создание музыки: ${userState.musicText.substring(0, 50)}...`
  );
  
  if (!deducted) {
    await ctx.reply('❌ Ошибка списания средств. Попробуйте позже.');
    userStates.delete(userId);
    return;
  }
  
  processMusicGeneration(ctx, userId, userState.musicText, userState.musicStyle);
  
  userStates.delete(userId);
});

  bot.action('music_back_to_style', async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes('query is too old')) {
        console.error('Ошибка answerCbQuery:', error.message);
      }
    }
    
    const styleMessage = `— Выберите стиль музыки из приведенного ниже списка или напишите свой`;
    
    await ctx.editMessageText(
      styleMessage,
      Markup.inlineKeyboard([
        [
          Markup.button.callback('Рок', 'music_style_rock'),
          Markup.button.callback('Поп', 'music_style_pop'),
          Markup.button.callback('Гоп', 'music_style_gop')
        ],
        [Markup.button.callback('Назад', 'start_music_creation')]
      ])
    );
  });
}

export { showMusicAdvancedParams };