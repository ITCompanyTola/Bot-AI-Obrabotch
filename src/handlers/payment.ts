import { Telegraf, Markup } from 'telegraf';
import { BotContext, UserState } from '../types';
import { Database } from '../database';
import { createPayment, checkPaymentStatus } from '../services/paymentService';
import { logToFile } from '../bot';

async function showPaymentMessage(ctx: any, amount: number, userStates: Map<number, UserState>, backAction: string) {
  const userId = ctx.from?.id;
  if (!userId) return;

  try {
    logToFile(`💳 Попытка создания платежа: userId=${userId}, amount=${amount}`);
    
    const payment = await createPayment(
      amount,
      `Пополнение баланса на ${amount}₽`,
      userId
    );

    logToFile(`✅ Платеж создан успешно: paymentId=${payment.paymentId}, url=${payment.confirmationUrl}`);

    const currentState = userStates.get(userId) || { step: null };
    userStates.set(userId, {
      ...currentState,
      paymentId: payment.paymentId,
      paymentAmount: amount
    });

    await Database.savePendingPayment(userId, payment.paymentId, amount);

    const paymentMessage = `
💳 Сумма к оплате: ${amount}₽

Ваша ссылка для оплаты:
${payment.confirmationUrl}

После успешной оплаты баланс будет автоматически начислен в течение нескольких секунд ⚡️
    `.trim();

    await ctx.editMessageText(
      paymentMessage,
      Markup.inlineKeyboard([
        [Markup.button.url(`💳 Оплатить ${amount}₽`, payment.confirmationUrl)],
        [Markup.button.callback('Назад', backAction)]
      ])
    );
    
    logToFile(`✅ Сообщение с платежом отправлено userId=${userId}`);
  } catch (error: any) {
    logToFile(`❌ ОШИБКА создания платежа: userId=${userId}, error=${error.message}, stack=${error.stack}`);
    console.error('Ошибка создания платежа:', error);
    
    await ctx.editMessageText(
      '❌ Ошибка создания платежа. Попробуйте позже.',
      Markup.inlineKeyboard([
        [Markup.button.callback('Назад', backAction)]
      ])
    );
  }
}

export function registerPaymentHandlers(bot: Telegraf<BotContext>, userStates: Map<number, UserState>) {
  bot.action('refill_balance', async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes('query is too old')) {
        console.error('Ошибка answerCbQuery:', error.message);
      }
    }
    
    const userId = ctx.from?.id;
    if (!userId) return;
    
    logToFile(`📝 refill_balance вызван: userId=${userId}`);
    
    const currentState = userStates.get(userId) || { step: null };
    userStates.set(userId, { ...currentState, refillSource: 'photo' });
    
    const refillMessage = `Выберете сумму для пополнения баланса ⤵️`;

    await ctx.telegram.sendMessage(
      userId,
      refillMessage,
      Markup.inlineKeyboard([
        [
          Markup.button.callback('150₽', 'refill_150'),
          Markup.button.callback('300₽', 'refill_300'),
          Markup.button.callback('800₽', 'refill_800'),
          Markup.button.callback('1600₽', 'refill_1600')
        ],
        [Markup.button.callback('Назад', 'photo_animation')]
      ])
    );
  });

  bot.action('refill_balance_from_profile', async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes('query is too old')) {
        console.error('Ошибка answerCbQuery:', error.message);
      }
    }
    
    const userId = ctx.from?.id;
    if (!userId) return;
    
    logToFile(`📝 refill_balance_from_profile вызван: userId=${userId}`);
    
    const currentState = userStates.get(userId) || { step: null };
    userStates.set(userId, { ...currentState, refillSource: 'profile' });
    
    const refillMessage = `Выберете сумму для пополнения баланса ⤵️`;

    await ctx.editMessageText(
      refillMessage,
      Markup.inlineKeyboard([
        [
          Markup.button.callback('150₽', 'refill_150'),
          Markup.button.callback('300₽', 'refill_300'),
          Markup.button.callback('800₽', 'refill_800'),
          Markup.button.callback('1600₽', 'refill_1600')
        ],
        [Markup.button.callback('Назад', 'profile')]
      ])
    );
  });

  bot.action('refill_balance_from_music', async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes('query is too old')) {
        console.error('Ошибка answerCbQuery:', error.message);
      }
    }
    
    const userId = ctx.from?.id;
    if (!userId) return;
    
    logToFile(`📝 refill_balance_from_music вызван: userId=${userId}`);
    
    const currentState = userStates.get(userId) || { step: null };
    userStates.set(userId, { ...currentState, refillSource: 'music' });
    
    const refillMessage = `Выберете сумму для пополнения баланса ⤵️`;

    await ctx.editMessageText(
      refillMessage,
      Markup.inlineKeyboard([
        [
          Markup.button.callback('150₽', 'refill_150'),
          Markup.button.callback('300₽', 'refill_300'),
          Markup.button.callback('800₽', 'refill_800'),
          Markup.button.callback('1600₽', 'refill_1600')
        ],
        [Markup.button.callback('Назад', 'music_creation')]
      ])
    );
  });

  bot.action('refill_150', async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes('query is too old')) {
        console.error('Ошибка answerCbQuery:', error.message);
      }
    }
    
    const userId = ctx.from?.id;
    if (!userId) return;
    
    logToFile(`📝 refill_150 вызван: userId=${userId}`);
    
    const userState = userStates.get(userId);
    let backAction = 'refill_balance';
    
    if (userState?.refillSource === 'profile') {
      backAction = 'refill_balance_from_profile';
    } else if (userState?.refillSource === 'music') {
      backAction = 'refill_balance_from_music';
    }
    
    await showPaymentMessage(ctx, 150, userStates, backAction);
  });

  bot.action('refill_300', async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes('query is too old')) {
        console.error('Ошибка answerCbQuery:', error.message);
      }
    }
    
    const userId = ctx.from?.id;
    if (!userId) return;
    
    logToFile(`📝 refill_300 вызван: userId=${userId}`);
    
    const userState = userStates.get(userId);
    let backAction = 'refill_balance';
    
    if (userState?.refillSource === 'profile') {
      backAction = 'refill_balance_from_profile';
    } else if (userState?.refillSource === 'music') {
      backAction = 'refill_balance_from_music';
    }
    
    await showPaymentMessage(ctx, 300, userStates, backAction);
  });

  bot.action('refill_800', async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes('query is too old')) {
        console.error('Ошибка answerCbQuery:', error.message);
      }
    }
    
    const userId = ctx.from?.id;
    if (!userId) return;
    
    logToFile(`📝 refill_800 вызван: userId=${userId}`);
    
    const userState = userStates.get(userId);
    let backAction = 'refill_balance';
    
    if (userState?.refillSource === 'profile') {
      backAction = 'refill_balance_from_profile';
    } else if (userState?.refillSource === 'music') {
      backAction = 'refill_balance_from_music';
    }
    
    await showPaymentMessage(ctx, 800, userStates, backAction);
  });

  bot.action('refill_1600', async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes('query is too old')) {
        console.error('Ошибка answerCbQuery:', error.message);
      }
    }
    
    const userId = ctx.from?.id;
    if (!userId) return;
    
    logToFile(`📝 refill_1600 вызван: userId=${userId}`);
    
    const userState = userStates.get(userId);
    let backAction = 'refill_balance';
    
    if (userState?.refillSource === 'profile') {
      backAction = 'refill_balance_from_profile';
    } else if (userState?.refillSource === 'music') {
      backAction = 'refill_balance_from_music';
    }
    
    await showPaymentMessage(ctx, 1600, userStates, backAction);
  });
}

export { showPaymentMessage };
