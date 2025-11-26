"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerTextHandlers = registerTextHandlers;
const telegraf_1 = require("telegraf");
const database_1 = require("../database");
const constants_1 = require("../constants");
const klingService_1 = require("../services/klingService");
const musicCreation_1 = require("./musicCreation");
function registerTextHandlers(bot, userStates) {
    bot.on('photo', async (ctx) => {
        const userId = ctx.from?.id;
        if (!userId)
            return;
        const userState = userStates.get(userId);
        if (userState?.step !== 'waiting_photo')
            return;
        const photo = ctx.message.photo[ctx.message.photo.length - 1];
        userStates.set(userId, {
            step: 'waiting_description',
            photoFileId: photo.file_id
        });
        const descriptionMessage = `
Опишите, как должна ожить фотография. Конкретно каждый человек на фото отдельно или все вместе.

Например: позирует на камеру, показывает язык, машет рукой, выходит из кадра, девушка обнимает мужчину, внук целует бабушку в щеку и т.д.

❗️Просим вас воздержаться от генерации 18+ контента и не присылать в бота подобные медиафайлы и описание действий. Все подобные запросы падают в ошибку, сгоревшие генерации возвращены не будут).

При этом разрешено присылать фото в купальнике/белье с описанием "Позирует на камеру", мы не звери тоже...
    `.trim();
        await ctx.reply(descriptionMessage);
    });
    bot.on('text', async (ctx) => {
        const userId = ctx.from?.id;
        if (!userId)
            return;
        const userState = userStates.get(userId);
        if (userState?.step === 'waiting_music_text') {
            const musicText = ctx.message.text;
            userStates.set(userId, {
                step: 'waiting_music_style',
                musicText: musicText
            });
            console.log(`🎵 Сохранен текст музыки для пользователя ${userId}: "${musicText}"`);
            const styleMessage = `— Выберите стиль музыки из приведенного ниже списка или напишите свой`;
            await ctx.reply(styleMessage, telegraf_1.Markup.inlineKeyboard([
                [
                    telegraf_1.Markup.button.callback('Рок', 'music_style_rock'),
                    telegraf_1.Markup.button.callback('Поп', 'music_style_pop'),
                    telegraf_1.Markup.button.callback('Гоп', 'music_style_gop')
                ],
                [telegraf_1.Markup.button.callback('Назад', 'start_music_creation')]
            ]));
            return;
        }
        if (userState?.step === 'waiting_music_style') {
            const customStyle = ctx.message.text;
            userState.musicStyle = customStyle;
            userStates.set(userId, userState);
            console.log(`🎵 Выбран пользовательский стиль: "${customStyle}"`);
            await (0, musicCreation_1.showMusicAdvancedParams)(ctx);
            return;
        }
        if (userState?.step !== 'waiting_description' || !userState.photoFileId)
            return;
        const prompt = ctx.message.text;
        userStates.set(userId, {
            step: 'waiting_payment',
            photoFileId: userState.photoFileId,
            prompt: prompt
        });
        console.log(`📝 Сохранен промпт для пользователя ${userId}: "${prompt}"`);
        const balance = await database_1.Database.getUserBalance(userId);
        const hasBalance = await database_1.Database.hasEnoughBalance(userId, constants_1.PRICES.PHOTO_ANIMATION);
        if (!hasBalance) {
            const paymentMessage = `
<blockquote>💰 Ваш баланс: ${balance.toFixed(2)} ₽
📹 Оживление 1 фото = ${constants_1.PRICES.PHOTO_ANIMATION}₽ / $1</blockquote>

Выберете способ оплаты ⤵️
      `.trim();
            await ctx.reply(paymentMessage, {
                parse_mode: 'HTML',
                ...telegraf_1.Markup.inlineKeyboard([
                    [telegraf_1.Markup.button.callback('Оплата картой', 'refill_balance')],
                    [telegraf_1.Markup.button.callback('Главное меню', 'main_menu')]
                ])
            });
            return;
        }
        await ctx.reply('⏳ Начинаю генерацию... Это займет около 3 минут.');
        const deducted = await database_1.Database.deductBalance(userId, constants_1.PRICES.PHOTO_ANIMATION, `Оживление фото: ${prompt.substring(0, 50)}...`);
        if (!deducted) {
            await ctx.reply('❌ Ошибка списания средств. Попробуйте позже.');
            userStates.delete(userId);
            return;
        }
        (0, klingService_1.processVideoGeneration)(ctx, userId, userState.photoFileId, prompt);
        userStates.delete(userId);
    });
}
