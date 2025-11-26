"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateMusicWithSuno = generateMusicWithSuno;
exports.processMusicGeneration = processMusicGeneration;
const axios_1 = __importDefault(require("axios"));
const buffer_1 = require("buffer");
const config_1 = require("../config");
const database_1 = require("../database");
const constants_1 = require("../constants");
const API_URL = 'https://api.kie.ai/api/v1';
const API_KEY = config_1.config.sunoApiKey;
async function createMusicTask(prompt, style, instrumental) {
    try {
        const response = await axios_1.default.post(`${API_URL}/generate`, {
            prompt: `${style} style: ${prompt}`,
            customMode: false,
            instrumental: instrumental,
            model: 'V4_5',
            callBackUrl: config_1.config.callbackUrl
        }, {
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        if (response.data.code !== 200) {
            throw new Error(`API Error: ${response.data.msg}`);
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
        const response = await axios_1.default.get(`${API_URL}/generate/record-info?taskId=${taskId}`, {
            headers: {
                'Authorization': `Bearer ${API_KEY}`
            }
        });
        if (response.data.code !== 200) {
            throw new Error(`API Error: ${response.data.msg}`);
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
        console.log(`🎵 Статус задачи ${taskId}: ${status.status} (попытка ${attempt + 1}/${maxAttempts})`);
        if (status.status === 'SUCCESS') {
            if (!status.response || !status.response.sunoData || status.response.sunoData.length === 0) {
                throw new Error('Результат не найден');
            }
            const audioUrl = status.response.sunoData[0].audioUrl;
            if (!audioUrl) {
                throw new Error('URL аудио не найден');
            }
            return audioUrl;
        }
        if (status.status === 'FIRST_SUCCESS') {
            if (!status.response || !status.response.sunoData || status.response.sunoData.length === 0) {
                throw new Error('Результат не найден');
            }
            const audioUrl = status.response.sunoData[0].audioUrl;
            if (!audioUrl) {
                await new Promise(resolve => setTimeout(resolve, 10000));
                continue;
            }
            return audioUrl;
        }
        if (status.status === 'CREATE_TASK_FAILED' ||
            status.status === 'GENERATE_AUDIO_FAILED' ||
            status.status === 'CALLBACK_EXCEPTION' ||
            status.status === 'SENSITIVE_WORD_ERROR') {
            throw new Error(`Генерация failed: ${status.errorMessage || status.status}`);
        }
        await new Promise(resolve => setTimeout(resolve, 10000));
    }
    throw new Error('Превышено время ожидания генерации');
}
async function generateMusicWithSuno(prompt, style, instrumental = false) {
    console.log(`🎵 Создаю музыку: ${style} стиль`);
    console.log(`💬 Тема: ${prompt}`);
    console.log(`🎹 Инструментальная: ${instrumental}`);
    const taskId = await createMusicTask(prompt, style, instrumental);
    console.log(`✅ Задача создана: ${taskId}`);
    const audioUrl = await waitForTaskCompletion(taskId);
    console.log(`✅ Аудио готово: ${audioUrl}`);
    return audioUrl;
}
async function processMusicGeneration(ctx, userId, musicText, musicStyle, instrumental = false) {
    try {
        const deducted = await database_1.Database.deductBalance(userId, constants_1.PRICES.MUSIC_CREATION, 'Создание музыки');
        if (!deducted) {
            await ctx.telegram.sendMessage(userId, '❌ Недостаточно средств для генерации');
            return;
        }
        console.log(`⏳ Начинается генерация музыки для пользователя ${userId}...`);
        const audioUrl = await generateMusicWithSuno(musicText, musicStyle, instrumental);
        const audioResponse = await axios_1.default.get(audioUrl, { responseType: 'arraybuffer' });
        const audioBuffer = buffer_1.Buffer.from(audioResponse.data);
        const sentMessage = await ctx.telegram.sendAudio(userId, { source: audioBuffer }, {
            caption: `✅ Ваш трек готов!\n\nСтиль: ${musicStyle}\nТема: ${musicText}`
        });
        await database_1.Database.saveGeneratedFile(userId, 'music', sentMessage.audio.file_id, musicText);
        console.log(`✅ Трек сгенерирован и сохранен для пользователя ${userId}`);
        console.log(`📁 File ID: ${sentMessage.audio.file_id}`);
        const mainMenuMessage = `
Наш бот умеет оживлять фото и создавать крутые треки! Вы можете это делать самостоятельно или обратиться к нам для реализации. В каждом разделе будет инструкция по правильному созданию контента!
    `.trim();
        await ctx.telegram.sendMessage(userId, mainMenuMessage, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Написать в поддержку', callback_data: 'support' }],
                    [
                        { text: '📸 Оживить фото', callback_data: 'photo_animation' },
                        { text: '🎶 Создать музыку', callback_data: 'music_creation' }
                    ],
                    [{ text: 'Личный кабинет', callback_data: 'profile' }]
                ]
            }
        });
    }
    catch (error) {
        console.error('❌ Ошибка генерации музыки:', error);
        await database_1.Database.addBalance(userId, constants_1.PRICES.MUSIC_CREATION, 'Возврат средств за ошибку генерации', 'bonus');
        console.log(`💰 Возвращено ${constants_1.PRICES.MUSIC_CREATION}₽ пользователю ${userId}`);
        await ctx.telegram.sendMessage(userId, '❌ Произошла ошибка при создании трека. Средства возвращены на баланс.');
    }
}
