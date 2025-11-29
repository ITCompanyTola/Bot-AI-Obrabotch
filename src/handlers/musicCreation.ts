import { Telegraf, Markup } from 'telegraf';
import { BotContext, UserState } from '../types';
import { Database } from '../database';
import { PRICES } from '../constants';
import { processMusicGeneration } from '../services/sunoService';
import { config } from '../config';

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
        console.error('Oshibka answerCbQuery:', error.message);
      }
    }
    
    const userId = ctx.from?.id;
    if (!userId) return;
    
    await ctx.telegram.sendVideo(
      userId,
      config.musicInstructionFileId,
      {
        caption: '🎬 <b>Видео-инструкция по созданию музыки</b>\n\nСмотрите короткое видео, чтобы легко и быстро понять, как написать песню, выбрать стиль и получить готовый трек 🎵✨',
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Назад', callback_data: 'music_creation' }]
          ]
        }
      }
    );
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
          [Markup.button.callback('Оплата картой', 'refill_balance_from_music')],
          [Markup.button.callback('Главное меню', 'main_menu')]
        ])
      );
      return;
    }
    
    await ctx.editMessageText('⏳ Начинаю генерацию музыки... Это займет около 2 минут.');
    
    processMusicGeneration(ctx, userId, userState.musicText, userState.musicStyle);
    
    userStates.delete(userId);
  });

  bot.action('music_style_kpop', async (ctx) => {
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
      userState.musicStyle = 'К-поп';
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
    
    processMusicGeneration(ctx, userId, userState.musicText, userState.musicStyle);
    
    userStates.delete(userId);
  });

  bot.action('music_style_rnb', async (ctx) => {
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
      userState.musicStyle = 'R&B';
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
    
    processMusicGeneration(ctx, userId, userState.musicText, userState.musicStyle);
    
    userStates.delete(userId);
  });

  bot.action('music_style_hiphop', async (ctx) => {
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
      userState.musicStyle = 'Хип-хоп';
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
    
    processMusicGeneration(ctx, userId, userState.musicText, userState.musicStyle);
    
    userStates.delete(userId);
  });

  bot.action('music_style_dance', async (ctx) => {
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
      userState.musicStyle = 'Дэнс';
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
