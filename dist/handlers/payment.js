"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerPaymentHandlers = registerPaymentHandlers;
exports.showPaymentMessage = showPaymentMessage;
const telegraf_1 = require("telegraf");
const database_1 = require("../database");
const paymentService_1 = require("../services/paymentService");
async function showPaymentMessage(ctx, amount, userStates) {
    const userId = ctx.from?.id;
    if (!userId)
        return;
    try {
        const payment = await (0, paymentService_1.createPayment)(amount, `Пополнение баланса на ${amount}₽`, userId);
        const currentState = userStates.get(userId) || { step: null };
        userStates.set(userId, {
            ...currentState,
            paymentId: payment.paymentId,
            paymentAmount: amount
        });
        await database_1.Database.savePendingPayment(userId, payment.paymentId, amount);
        const paymentMessage = `
💳 Сумма к оплате: ${amount}₽

Ваша ссылка для оплаты:
${payment.confirmationUrl}

После оплаты нажмите кнопку "Я оплатил" для проверки платежа.
    `.trim();
        await ctx.editMessageText(paymentMessage, telegraf_1.Markup.inlineKeyboard([
            [telegraf_1.Markup.button.url(`💳 Оплатить ${amount}₽`, payment.confirmationUrl)],
            [telegraf_1.Markup.button.callback('Я оплатил', `confirm_payment_${payment.paymentId}`)],
            [telegraf_1.Markup.button.callback('Назад', 'refill_balance')]
        ]));
    }
    catch (error) {
        console.error('Ошибка создания платежа:', error);
        await ctx.editMessageText('❌ Ошибка создания платежа. Попробуйте позже.', telegraf_1.Markup.inlineKeyboard([
            [telegraf_1.Markup.button.callback('Назад', 'refill_balance')]
        ]));
    }
}
function registerPaymentHandlers(bot, userStates) {
    bot.action('refill_balance', async (ctx) => {
        try {
            await ctx.answerCbQuery();
        }
        catch (error) {
            if (!error.description?.includes('query is too old')) {
                console.error('Ошибка answerCbQuery:', error.message);
            }
        }
        const userId = ctx.from?.id;
        if (!userId)
            return;
        const refillMessage = `Выберете сумму для пополнения баланса ⤵️`;
        await ctx.telegram.sendMessage(userId, refillMessage, telegraf_1.Markup.inlineKeyboard([
            [
                telegraf_1.Markup.button.callback('150₽', 'refill_150'),
                telegraf_1.Markup.button.callback('300₽', 'refill_300'),
                telegraf_1.Markup.button.callback('800₽', 'refill_800'),
                telegraf_1.Markup.button.callback('1600₽', 'refill_1600')
            ],
            [telegraf_1.Markup.button.callback('Назад', 'photo_animation')]
        ]));
    });
    bot.action('refill_150', async (ctx) => {
        try {
            await ctx.answerCbQuery();
        }
        catch (error) {
            if (!error.description?.includes('query is too old')) {
                console.error('Ошибка answerCbQuery:', error.message);
            }
        }
        await showPaymentMessage(ctx, 150, userStates);
    });
    bot.action('refill_300', async (ctx) => {
        try {
            await ctx.answerCbQuery();
        }
        catch (error) {
            if (!error.description?.includes('query is too old')) {
                console.error('Ошибка answerCbQuery:', error.message);
            }
        }
        await showPaymentMessage(ctx, 300, userStates);
    });
    bot.action('refill_800', async (ctx) => {
        try {
            await ctx.answerCbQuery();
        }
        catch (error) {
            if (!error.description?.includes('query is too old')) {
                console.error('Ошибка answerCbQuery:', error.message);
            }
        }
        await showPaymentMessage(ctx, 800, userStates);
    });
    bot.action('refill_1600', async (ctx) => {
        try {
            await ctx.answerCbQuery();
        }
        catch (error) {
            if (!error.description?.includes('query is too old')) {
                console.error('Ошибка answerCbQuery:', error.message);
            }
        }
        await showPaymentMessage(ctx, 1600, userStates);
    });
    bot.action(/^confirm_payment_(.+)$/, async (ctx) => {
        const paymentId = ctx.match[1];
        const userId = ctx.from?.id;
        if (!userId)
            return;
        try {
            await ctx.answerCbQuery('⏳ Проверяю платеж...');
        }
        catch (error) {
            if (!error.description?.includes('query is too old')) {
                console.error('Ошибка answerCbQuery:', error.message);
            }
        }
        try {
            const alreadyProcessed = await database_1.Database.isPaymentProcessed(paymentId);
            if (alreadyProcessed) {
                await ctx.editMessageText('✅ Этот платеж уже был обработан ранее.', telegraf_1.Markup.inlineKeyboard([
                    [telegraf_1.Markup.button.callback('Главное меню', 'main_menu')]
                ]));
                return;
            }
            console.log(`🔍 Проверяю статус платежа ${paymentId}...`);
            const status = await (0, paymentService_1.checkPaymentStatus)(paymentId);
            console.log(`📊 Статус: ${status}`);
            if (status === 'succeeded') {
                const userState = userStates.get(userId);
                const amount = userState?.paymentAmount || 0;
                if (amount === 0) {
                    await ctx.editMessageText('❌ Ошибка: не найдена сумма платежа.', telegraf_1.Markup.inlineKeyboard([
                        [telegraf_1.Markup.button.callback('Главное меню', 'main_menu')]
                    ]));
                    return;
                }
                await database_1.Database.addBalance(userId, amount, `Пополнение баланса (${paymentId})`, 'refill');
                const newBalance = await database_1.Database.getUserBalance(userId);
                console.log(`✅ Платеж ${paymentId} подтвержден! Начислено ${amount}₽ пользователю ${userId}. Баланс: ${newBalance}₽`);
                if (userState) {
                    delete userState.paymentId;
                    delete userState.paymentAmount;
                    userStates.set(userId, userState);
                }
                if (userState?.photoFileId && userState?.prompt) {
                    await ctx.editMessageText('Мы готовы начинать генерацию, стартуем?', telegraf_1.Markup.inlineKeyboard([
                        [telegraf_1.Markup.button.callback('Да', 'start_generation')],
                        [telegraf_1.Markup.button.callback('Главное меню', 'main_menu')]
                    ]));
                }
                else {
                    await ctx.editMessageText('Благодарим вас за оплату, скорее бегите творить!', telegraf_1.Markup.inlineKeyboard([
                        [telegraf_1.Markup.button.callback('Главное меню', 'main_menu')]
                    ]));
                }
            }
            else if (status === 'pending' || status === 'waiting_for_capture') {
                console.log(`⏳ Платеж ${paymentId} еще обрабатывается`);
                await ctx.answerCbQuery('⏳ Платеж еще обрабатывается. Подождите 1-2 минуты и попробуйте снова.', { show_alert: true });
            }
            else if (status === 'canceled') {
                console.log(`❌ Платеж ${paymentId} был отменен`);
                await ctx.editMessageText('❌ Платеж был отменен.\n\nСоздайте новый платеж для пополнения баланса.', telegraf_1.Markup.inlineKeyboard([
                    [telegraf_1.Markup.button.callback('Пополнить баланс', 'refill_balance')],
                    [telegraf_1.Markup.button.callback('Главное меню', 'main_menu')]
                ]));
            }
            else {
                console.log(`❓ Неизвестный статус платежа ${paymentId}: ${status}`);
                await ctx.answerCbQuery(`❓ Неизвестный статус платежа: ${status}. Обратитесь в поддержку.`, { show_alert: true });
            }
        }
        catch (error) {
            console.error('❌ Ошибка проверки платежа:', error);
            await ctx.answerCbQuery('❌ Ошибка проверки платежа. Попробуйте позже или обратитесь в поддержку.', { show_alert: true });
        }
    });
}
