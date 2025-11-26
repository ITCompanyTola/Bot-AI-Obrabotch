import { Telegraf, Markup } from 'telegraf';
import { BotContext, UserState } from '../types';
import { Database } from '../database';
import { createPayment, checkPaymentStatus } from '../services/paymentService';

async function showPaymentMessage(ctx: any, amount: number, userStates: Map<number, UserState>) {
  const userId = ctx.from?.id;
  if (!userId) return;

  try {
    const payment = await createPayment(
      amount,
      `Пополнение баланса на ${amount}₽`,
      userId
    );

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

После оплаты нажмите кнопку "Я оплатил" для проверки платежа.
    `.trim();

    await ctx.editMessageText(
      paymentMessage,
      Markup.inlineKeyboard([
        [Markup.button.url(`💳 Оплатить ${amount}₽`, payment.confirmationUrl)],
        [Markup.button.callback('Я оплатил', `confirm_payment_${payment.paymentId}`)],
        [Markup.button.callback('Назад', 'refill_balance')]
      ])
    );
  } catch (error) {
    console.error('Ошибка создания платежа:', error);
    await ctx.editMessageText(
      '❌ Ошибка создания платежа. Попробуйте позже.',
      Markup.inlineKeyboard([
        [Markup.button.callback('Назад', 'refill_balance')]
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
        [Markup.button.callback('Назад', 'photo_animation')]
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
    await showPaymentMessage(ctx, 150, userStates);
  });

  bot.action('refill_300', async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes('query is too old')) {
        console.error('Ошибка answerCbQuery:', error.message);
      }
    }
    await showPaymentMessage(ctx, 300, userStates);
  });

  bot.action('refill_800', async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes('query is too old')) {
        console.error('Ошибка answerCbQuery:', error.message);
      }
    }
    await showPaymentMessage(ctx, 800, userStates);
  });

  bot.action('refill_1600', async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes('query is too old')) {
        console.error('Ошибка answerCbQuery:', error.message);
      }
    }
    await showPaymentMessage(ctx, 1600, userStates);
  });

  bot.action(/^confirm_payment_(.+)$/, async (ctx) => {
    const paymentId = ctx.match[1];
    const userId = ctx.from?.id;
    
    if (!userId) return;

    try {
      await ctx.answerCbQuery('⏳ Проверяю платеж...');
    } catch (error: any) {
      if (!error.description?.includes('query is too old')) {
        console.error('Ошибка answerCbQuery:', error.message);
      }
    }

    try {
      const alreadyProcessed = await Database.isPaymentProcessed(paymentId);
      
      if (alreadyProcessed) {
        await ctx.editMessageText(
          '✅ Этот платеж уже был обработан ранее.',
          Markup.inlineKeyboard([
            [Markup.button.callback('Главное меню', 'main_menu')]
          ])
        );
        return;
      }

      console.log(`🔍 Проверяю статус платежа ${paymentId}...`);
      const status = await checkPaymentStatus(paymentId);
      console.log(`📊 Статус: ${status}`);

      if (status === 'succeeded') {
        const userState = userStates.get(userId);
        const amount = userState?.paymentAmount || 0;

        if (amount === 0) {
          await ctx.editMessageText(
            '❌ Ошибка: не найдена сумма платежа.',
            Markup.inlineKeyboard([
              [Markup.button.callback('Главное меню', 'main_menu')]
            ])
          );
          return;
        }

        await Database.addBalance(
          userId,
          amount,
          `Пополнение баланса (${paymentId})`,
          'refill'
        );
        
        const newBalance = await Database.getUserBalance(userId);
        console.log(`✅ Платеж ${paymentId} подтвержден! Начислено ${amount}₽ пользователю ${userId}. Баланс: ${newBalance}₽`);
        
        if (userState) {
          delete userState.paymentId;
          delete userState.paymentAmount;
          userStates.set(userId, userState);
        }

        if (userState?.photoFileId && userState?.prompt) {
          await ctx.editMessageText(
            'Мы готовы начинать генерацию, стартуем?',
            Markup.inlineKeyboard([
              [Markup.button.callback('Да', 'start_generation')],
              [Markup.button.callback('Главное меню', 'main_menu')]
            ])
          );
        } else {
          await ctx.editMessageText(
            'Благодарим вас за оплату, скорее бегите творить!',
            Markup.inlineKeyboard([
              [Markup.button.callback('Главное меню', 'main_menu')]
            ])
          );
        }

      } else if (status === 'pending' || status === 'waiting_for_capture') {
        console.log(`⏳ Платеж ${paymentId} еще обрабатывается`);
        await ctx.answerCbQuery(
          '⏳ Платеж еще обрабатывается. Подождите 1-2 минуты и попробуйте снова.',
          { show_alert: true }
        );

      } else if (status === 'canceled') {
        
        console.log(`❌ Платеж ${paymentId} был отменен`);
        await ctx.editMessageText(
          '❌ Платеж был отменен.\n\nСоздайте новый платеж для пополнения баланса.',
          Markup.inlineKeyboard([
            [Markup.button.callback('Пополнить баланс', 'refill_balance')],
            [Markup.button.callback('Главное меню', 'main_menu')]
          ])
        );

      } else {
        
        console.log(`❓ Неизвестный статус платежа ${paymentId}: ${status}`);
        await ctx.answerCbQuery(
          `❓ Неизвестный статус платежа: ${status}. Обратитесь в поддержку.`,
          { show_alert: true }
        );
      }

    } catch (error: any) {
      console.error('❌ Ошибка проверки платежа:', error);
      await ctx.answerCbQuery(
        '❌ Ошибка проверки платежа. Попробуйте позже или обратитесь в поддержку.',
        { show_alert: true }
      );
    }
  });
}

export { showPaymentMessage };