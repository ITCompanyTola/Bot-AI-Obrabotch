"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerMainMenuHandlers = registerMainMenuHandlers;
const telegraf_1 = require("telegraf");
const database_1 = require("../database");
function registerMainMenuHandlers(bot, userStates) {
    bot.command('start', async (ctx) => {
        const userId = ctx.from?.id;
        if (!userId)
            return;
        try {
            await database_1.Database.getOrCreateUser(userId, ctx.from?.username, ctx.from?.first_name, ctx.from?.last_name);
            const policyAccepted = await database_1.Database.hasPolicyAccepted(userId);
            if (policyAccepted) {
                const mainMenuMessage = `
Наш бот умеет оживлять фото и создавать крутые треки! Вы можете это делать самостоятельно или обратиться к нам для реализации. В каждом разделе будет инструкция по правильному созданию контента!
        `.trim();
                await ctx.reply(mainMenuMessage, telegraf_1.Markup.inlineKeyboard([
                    [telegraf_1.Markup.button.callback('Написать в поддержку', 'support')],
                    [
                        telegraf_1.Markup.button.callback('📸 Оживить фото', 'photo_animation'),
                        telegraf_1.Markup.button.callback('🎶 Создать музыку', 'music_creation')
                    ],
                    [telegraf_1.Markup.button.callback('Личный кабинет', 'profile')]
                ]));
            }
            else {
                const welcomeMessage = `
Чтобы мы могли дальше работать, закон требует подтверждения с вашей стороны следующего ⤵️

📌 Политика конфиденциальности
📌 Согласие на обработку персональных данных
        `.trim();
                await ctx.reply(welcomeMessage, telegraf_1.Markup.inlineKeyboard([
                    [telegraf_1.Markup.button.callback('✅ Принимаю', 'accept_policy')]
                ]));
            }
        }
        catch (error) {
            console.error('Ошибка в /start:', error);
            await ctx.reply('❌ Произошла ошибка. Попробуйте позже.');
        }
    });
    bot.action('accept_policy', async (ctx) => {
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
        await database_1.Database.setPolicyAccepted(userId);
        const mainMenuMessage = `
Наш бот умеет оживлять фото и создавать крутые треки! Вы можете это делать самостоятельно или обратиться к нам для реализации. В каждом разделе будет инструкция по правильному созданию контента!
    `.trim();
        await ctx.editMessageText(mainMenuMessage, telegraf_1.Markup.inlineKeyboard([
            [telegraf_1.Markup.button.callback('Написать в поддержку', 'support')],
            [
                telegraf_1.Markup.button.callback('📸 Оживить фото', 'photo_animation'),
                telegraf_1.Markup.button.callback('🎶 Создать музыку', 'music_creation')
            ],
            [telegraf_1.Markup.button.callback('Личный кабинет', 'profile')]
        ]));
    });
    bot.action('decline_policy', async (ctx) => {
        try {
            await ctx.answerCbQuery();
        }
        catch (error) {
            if (!error.description?.includes('query is too old')) {
                console.error('Ошибка answerCbQuery:', error.message);
            }
        }
        await ctx.editMessageText('❌ Вы отклонили согласие на обработку данных.\n\nБез этого бот не может работать.\n\nДля повторной попытки используйте /start');
    });
    bot.action('main_menu', async (ctx) => {
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
        const mainMenuMessage = `
Наш бот умеет оживлять фото и создавать крутые треки! Вы можете это делать самостоятельно или обратиться к нам для реализации. В каждом разделе будет инструкция по правильному созданию контента!
    `.trim();
        await ctx.telegram.sendMessage(userId, mainMenuMessage, telegraf_1.Markup.inlineKeyboard([
            [telegraf_1.Markup.button.callback('Написать в поддержку', 'support')],
            [
                telegraf_1.Markup.button.callback('📸 Оживить фото', 'photo_animation'),
                telegraf_1.Markup.button.callback('🎶 Создать музыку', 'music_creation')
            ],
            [telegraf_1.Markup.button.callback('Личный кабинет', 'profile')]
        ]));
    });
    bot.action('support', async (ctx) => {
        try {
            await ctx.answerCbQuery();
        }
        catch (error) {
            if (!error.description?.includes('query is too old')) {
                console.error('Ошибка answerCbQuery:', error.message);
            }
        }
        const supportMessage = `
💬 Поддержка

По всем вопросам обращайтесь:
https://t.me/khodunow
    `.trim();
        await ctx.editMessageText(supportMessage, telegraf_1.Markup.inlineKeyboard([
            [telegraf_1.Markup.button.callback('Главное меню', 'main_menu')]
        ]));
    });
    // Команды для меню
    bot.command('help', async (ctx) => {
        const supportMessage = `
💬 Поддержка

По всем вопросам обращайтесь:
https://t.me/khodunow
    `.trim();
        await ctx.reply(supportMessage, telegraf_1.Markup.inlineKeyboard([
            [telegraf_1.Markup.button.callback('Главное меню', 'main_menu')]
        ]));
    });
    bot.command('pay', async (ctx) => {
        const userId = ctx.from?.id;
        if (!userId)
            return;
        const refillMessage = `Выберете сумму для пополнения баланса ⤵️`;
        await ctx.reply(refillMessage, telegraf_1.Markup.inlineKeyboard([
            [
                telegraf_1.Markup.button.callback('150₽', 'refill_150'),
                telegraf_1.Markup.button.callback('300₽', 'refill_300'),
                telegraf_1.Markup.button.callback('800₽', 'refill_800'),
                telegraf_1.Markup.button.callback('1600₽', 'refill_1600')
            ],
            [telegraf_1.Markup.button.callback('Главное меню', 'main_menu')]
        ]));
    });
    bot.command('privacy', async (ctx) => {
        await ctx.reply('📌 Политика конфиденциальности:\nhttps://docs.google.com/document/d/1xhYtLwGktBxqbVTGalJ0PnlKdRWxafZn/edit?usp=sharing&ouid=100123280935677219338&rtpof=true&sd=true');
    });
    bot.command('agreement', async (ctx) => {
        await ctx.reply('📌 Пользовательское соглашение:\nhttps://docs.google.com/document/d/1T9YFGmVCMaOUYKhWBu7V8hjL-OV-WpFL/edit?usp=sharing&ouid=100123280935677219338&rtpof=true&sd=true');
    });
}
