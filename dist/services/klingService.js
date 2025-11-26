"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateVideoWithKling = generateVideoWithKling;
exports.processVideoGeneration = processVideoGeneration;
const axios_1 = __importDefault(require("axios"));
const buffer_1 = require("buffer");
const telegraf_1 = require("telegraf");
const config_1 = require("../config");
const database_1 = require("../database");
const constants_1 = require("../constants");
const API_URL = 'https://api.kie.ai/api/v1/jobs';
const API_KEY = config_1.config.klingApiKey;
async function createVideoTask(imageUrl, prompt) {
    try {
        const response = await axios_1.default.post(`${API_URL}/createTask`, {
            model: 'kling/v2-5-turbo-image-to-video-pro',
            input: {
                prompt: prompt,
                image_url: imageUrl,
                duration: '5',
                negative_prompt: 'blur, distort, and low quality',
                cfg_scale: 0.5
            }
        }, {
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        if (response.data.code !== 200) {
            throw new Error(`API Error: ${response.data.message}`);
        }
        return response.data.data.taskId;
    }
    catch (error) {
        console.error('Ошибка создания задачи:', error);
        throw error;
    }
}
async function checkTaskStatus(taskId) {
    try {
        const response = await axios_1.default.get(`${API_URL}/recordInfo?taskId=${taskId}`, {
            headers: {
                'Authorization': `Bearer ${API_KEY}`
            }
        });
        if (response.data.code !== 200) {
            throw new Error(`API Error: ${response.data.message}`);
        }
        return response.data.data;
    }
    catch (error) {
        console.error('Ошибка проверки статуса:', error);
        throw error;
    }
}
async function waitForTaskCompletion(taskId, maxAttempts = 60) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const status = await checkTaskStatus(taskId);
        console.log(`📊 Статус задачи ${taskId}: ${status.state} (попытка ${attempt + 1}/${maxAttempts})`);
        if (status.state === 'success') {
            if (!status.resultJson) {
                throw new Error('Результат не найден');
            }
            const result = JSON.parse(status.resultJson);
            if (!result.resultUrls || result.resultUrls.length === 0) {
                throw new Error('URL видео не найден');
            }
            return result.resultUrls[0];
        }
        if (status.state === 'fail') {
            throw new Error(`Генерация failed: ${status.failMsg || 'Unknown error'}`);
        }
        await new Promise(resolve => setTimeout(resolve, 5000));
    }
    throw new Error('Превышено время ожидания генерации');
}
async function generateVideoWithKling(imageUrl, prompt) {
    console.log(`📸 Оживляю фото: ${imageUrl}`);
    console.log(`💬 С описанием: ${prompt}`);
    const taskId = await createVideoTask(imageUrl, prompt);
    console.log(`✅ Задача создана: ${taskId}`);
    const videoUrl = await waitForTaskCompletion(taskId);
    console.log(`✅ Видео готово: ${videoUrl}`);
    return videoUrl;
}
async function processVideoGeneration(ctx, userId, photoFileId, prompt) {
    try {
        const deducted = await database_1.Database.deductBalance(userId, constants_1.PRICES.PHOTO_ANIMATION, 'Оживление фото');
        if (!deducted) {
            await ctx.telegram.sendMessage(userId, '❌ Недостаточно средств для генерации');
            return;
        }
        console.log(`⏳ Начинается генерация видео для пользователя ${userId}...`);
        const photoUrl = await ctx.telegram.getFileLink(photoFileId);
        console.log(`📸 URL фото: ${photoUrl.href}`);
        const videoUrl = await generateVideoWithKling(photoUrl.href, prompt);
        const videoResponse = await axios_1.default.get(videoUrl, { responseType: 'arraybuffer' });
        const videoBuffer = buffer_1.Buffer.from(videoResponse.data);
        const sentMessage = await ctx.telegram.sendVideo(userId, { source: videoBuffer }, {
            caption: `✅ Ваше видео готово!\n\nОписание: ${prompt}`
        });
        await database_1.Database.saveGeneratedFile(userId, 'photo', sentMessage.video.file_id, prompt);
        console.log(`✅ Видео сгенерировано и сохранено для пользователя ${userId}`);
        console.log(`📁 File ID: ${sentMessage.video.file_id}`);
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
    }
    catch (error) {
        console.error('❌ Ошибка генерации видео:', error);
        await database_1.Database.addBalance(userId, constants_1.PRICES.PHOTO_ANIMATION, 'Возврат средств за ошибку генерации', 'bonus');
        console.log(`💰 Возвращено ${constants_1.PRICES.PHOTO_ANIMATION}₽ пользователю ${userId}`);
        await ctx.telegram.sendMessage(userId, '❌ Произошла ошибка при генерации. Средства возвращены на баланс.');
    }
}
