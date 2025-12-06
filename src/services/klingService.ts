import axios from 'axios';
import { Buffer } from 'buffer';
import { Markup } from 'telegraf';
import { config } from '../config';
import { Database } from '../database';
import { PRICES } from '../constants';

const API_URL = 'https://api.kie.ai/api/v1/jobs';
const API_KEY = config.klingApiKey;

interface TaskResponse {
  code: number;
  message: string;
  data: {
    taskId: string;
  };
}

interface TaskStatusResponse {
  code: number;
  message: string;
  data: {
    taskId: string;
    state: 'waiting' | 'queuing' | 'generating' | 'success' | 'fail';
    resultJson?: string;
    failCode?: string;
    failMsg?: string;
  };
}

async function createVideoTask(imageUrl: string, prompt: string): Promise<string> {
  try {
    const response = await axios.post<TaskResponse>(
      `${API_URL}/createTask`,
      {
        model: 'kling/v2-5-turbo-image-to-video-pro', 
        input: {
          prompt: prompt,
          image_url: imageUrl, 
          duration: '5',
          negative_prompt: 'blur, distort, and low quality',
          cfg_scale: 0.5
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
    console.error('Ошибка создания задачи:', error);
    throw error;
  }
}

async function checkTaskStatus(taskId: string): Promise<TaskStatusResponse['data']> {
  try {
    const response = await axios.get<TaskStatusResponse>(
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
    console.error('Ошибка проверки статуса:', error);
    throw error;
  }
}

async function waitForTaskCompletion(taskId: string, maxAttempts: number = 60): Promise<string> {
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

export async function generateVideoWithKling(imageUrl: string, prompt: string): Promise<string> {
  console.log(`📸 Оживляю фото: ${imageUrl}`);
  console.log(`💬 С описанием: ${prompt}`);
  
  const taskId = await createVideoTask(imageUrl, prompt);
  console.log(`✅ Задача создана: ${taskId}`);
  
  const videoUrl = await waitForTaskCompletion(taskId);
  console.log(`✅ Видео готово: ${videoUrl}`);
  
  return videoUrl;
}

export async function processVideoGeneration(ctx: any, userId: number, photoFileId: string, prompt: string) {
  try {
    const deducted = await Database.deductBalance(
      userId,
      PRICES.PHOTO_ANIMATION,
      'Оживление фото'
    );

    if (!deducted) {
      await ctx.telegram.sendMessage(
        userId,
        '❌ Недостаточно средств для генерации'
      );
      return;
    }

    console.log(`⏳ Начинается генерация видео для пользователя ${userId}...`);

    const photoUrl = await ctx.telegram.getFileLink(photoFileId);
    console.log(`📸 URL фото: ${photoUrl.href}`);
    
    const videoUrl = await generateVideoWithKling(photoUrl.href, prompt);

    const videoResponse = await axios.get(videoUrl, { responseType: 'arraybuffer' });
    const videoBuffer = Buffer.from(videoResponse.data);

    const caption = (`
          ✅ Ваше видео готово!\n\nОписание: ${prompt}\n\n` +
          'Если вам нужна помощь в создании полноценного видео из оживленных фотографий с музыкой, ' +
          'вы можете обратиться в нашу службу технической поддержки — ' +
          '<a href="https://t.me/obrabotych_support">@obrabotych_support</a>').trim()
    const sentMessage = await ctx.telegram.sendVideo(userId, { source: videoBuffer }, {
      caption: caption,
      parse_mode: 'HTML',
    });

    await Database.saveGeneratedFile(userId, 'photo', sentMessage.video.file_id, prompt);

    console.log(`✅ Видео сгенерировано и сохранено для пользователя ${userId}`);
    console.log(`📁 File ID: ${sentMessage.video.file_id}`);

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
    console.error('❌ Ошибка генерации видео:', error);
    
    await Database.addBalance(
      userId,
      PRICES.PHOTO_ANIMATION,
      'Возврат средств за ошибку генерации',
      'bonus'
    );

    console.log(`💰 Возвращено ${PRICES.PHOTO_ANIMATION}₽ пользователю ${userId}`);
    
    await ctx.telegram.sendMessage(
      userId,
      '❌ Произошла ошибка при генерации. Средства возвращены на баланс.'
    );
  }
}