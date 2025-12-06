import axios from 'axios';
import { Buffer } from 'buffer';
import { Markup } from 'telegraf';
import { config } from '../config';
import { Database } from '../database';
import { PRICES } from '../constants';

const API_URL = 'https://api.kie.ai/api/v1/jobs';
const API_KEY = config.nanoBananaApiKey;

const MODEL = 'google/nano-banana-edit';

interface TaskResponse {
  code: number;
    message: number;
    data: {
        taskId: string;
    }
}

interface TaskStatusResponse {
  code: number;
  message: string;
  data: {
    taskId: string;
    model: string;
    state: 'waiting' | 'queuing' | 'generating' | 'success' | 'fail';
    resultJson?: string;
    failCode?: string;
    failMsg?: string;
  }
}

async function createRestorationTask(image_url: string, prompt: string): Promise<string> {
  const image_urls: string[] = [];
  image_urls.push(image_url);
  try {
    const response = await axios.post<TaskResponse>(
      `${API_URL}/createTask`,
      {
        model: MODEL,
        input: {
          prompt: prompt,
          image_urls: image_urls 
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data.code !== 200) {
      throw new Error(`API Error: ${response.data.message}`);
    }

    return response.data.data.taskId;
  } catch (error) {
    console.error('Ошибка создания задачи на реставрацию фото: ', error);
    throw error;
  }
}

async function checkRestorationTaskStatus(taskId: string): Promise<TaskStatusResponse['data']> {
  try {
    const response = await axios.get(
      `${API_URL}/recordInfo?taskId=${taskId}`,
      {
        headers: {
          'Authorization': `Bearer ${API_KEY}`
        }
      }
    );

    if (response.data.code !== 200) {
      throw new Error(`API Error: ${response.data.message}`);
    }

    return response.data.data;
  } catch (error) {
    console.error('Ошибка проверки статуса реставрации фото:', error);
    throw error;
  }
}

async function waitForRestorationTaskCompletion(taskId: string, maxAttempts: number = 50): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const status = await checkRestorationTaskStatus(taskId);

    console.log(`📊 Статус задачи ${taskId}: ${status.state} (попытка ${attempt + 1}/${maxAttempts})`);

    if (status.state === 'success') {
      if (!status.resultJson) {
        throw new Error('Результат не найден');
      }

      const result = JSON.parse(status.resultJson);
      if (!result.resultUrls || result.resultUrls.length === 0) {
        throw new Error('URL фото не найден');
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

async function generatePhotoWithBanana(imageUrl: string, prompt: string): Promise<string> {
  console.log(`📸 Реставрирую фото: ${imageUrl}`);
  console.log(`💬 С описанием: ${prompt}`);
  
  const taskId = await createRestorationTask(imageUrl, prompt);
  console.log(`✅ Задача создана: ${taskId}`);
  
  const videoUrl = await waitForRestorationTaskCompletion(taskId);
  console.log(`✅ Фото готово: ${videoUrl}`);
  
  return videoUrl;
}

export async function processPhotoRestoration(ctx: any, userId: number, photoFileId: string, prompt: string) {
  try {
    const deducted = await Database.deductBalance(
      userId,
      PRICES.PHOTO_RESTORATION,
      'Реставрация фото'
    );

    if (!deducted) {
      await ctx.telegram.sendMessage(
        userId,
        '❌ Недостаточно средств для генерации'
      );
      return;
    }

    console.log(`⏳ Начинается реставрация фото для пользователя ${userId}...`);

    const photoUrl = await ctx.telegram.getFileLink(photoFileId);
    console.log(`📸 URL фото: ${photoUrl.href}`);
    
    const restoratedPhotoUrl = await generatePhotoWithBanana(photoUrl.href, prompt);

    const photoResponse = await axios.get(restoratedPhotoUrl, { responseType: 'arraybuffer' });
    const photoBuffer = Buffer.from(photoResponse.data);

    const caption = `✅ Ваше отреставрированное фото готово!`.trim()
    const sentMessage = await ctx.telegram.sendPhoto(userId, { source: photoBuffer }, {
      caption: caption,
      parse_mode: 'HTML',
    });

    await Database.saveGeneratedFile(userId, 'restoration', sentMessage.photo.file_id, prompt);

    console.log(`✅ Отреставрированная фотография сгенерирована и сохранена для пользователя ${userId}`);
    console.log(`📁 File ID: ${sentMessage.photo.file_id}`);

    const mainMenuMessage = `
Наш бот умеет оживлять фото и создавать крутые треки! Вы можете это делать самостоятельно или обратиться к нам для реализации. В каждом разделе будет инструкция по правильному созданию контента!
    `.trim();

    await ctx.telegram.sendMessage(
      userId,
      mainMenuMessage,
      Markup.inlineKeyboard([
        [Markup.button.callback('Написать в поддержку', 'support')],
        [Markup.button.callback('Реставрация фото', 'photo_restoration')],
        [
          Markup.button.callback('📸 Оживить фото', 'photo_animation'),
          Markup.button.callback('🎶 Создать музыку', 'music_creation')
        ],
        [Markup.button.callback('Личный кабинет', 'profile')]
      ])
    );

  } catch (error) {
    console.error('❌ Ошибка генерации фотографии:', error);
    
    await Database.addBalance(
      userId,
      PRICES.PHOTO_RESTORATION,
      'Возврат средств за ошибку генерации',
      'bonus'
    );

    console.log(`💰 Возвращено ${PRICES.PHOTO_RESTORATION}₽ пользователю ${userId}`);
    
    await ctx.telegram.sendMessage(
      userId,
      '❌ Произошла ошибка при генерации. Средства возвращены на баланс.'
    );
  }
}