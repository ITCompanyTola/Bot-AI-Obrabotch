import axios from 'axios';
import { Buffer } from 'buffer';
import { Markup } from 'telegraf';
import { config } from '../config';
import { Database, UserRefferalData } from '../database';
import { MAIN_MENU_MESSAGE, mainMenuKeyboard, PRICES } from '../constants';
import { UserState } from '../types';
import { userStates } from '../bot';
import { axiosRetry } from '../utils/axiosRetry';

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
          image_urls: image_urls,
          output_format: 'png',
          image_size: 'auto'
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
    console.error('Ошибка создания задачи используя nano-banana-edit: ', error);
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
      console.error('Error code:', response.data.code);
      console.error(response.data.data.failMsg);
      throw new Error(`API Error: ${response.data.message}`);
    }

    return response.data.data;
  } catch (error) {
    console.error('Ошибка проверки статуса nano-banana-edit:', error);
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

    await ctx.telegram.sendMessage(userId, '⏳ Начинаю генерацию... Это займет около 3-х минут.');
    
    const restoratedPhotoUrl = await generatePhotoWithBanana(photoUrl.href, prompt);

    const photoResponse = await axios.get(restoratedPhotoUrl, { responseType: 'arraybuffer' });
    const photoBuffer = Buffer.from(photoResponse.data);

    const caption = `✅ <b>Ваше фото готово!</b>`.trim()
    const sentMessage = await ctx.telegram.sendPhoto(userId, { source: photoBuffer }, {
      caption: caption,
      parse_mode: 'HTML',
    });

    const fileId = sentMessage.photo[sentMessage.photo.length - 1].file_id;
    await Database.saveGeneratedFile(userId, 'restoration', fileId, prompt);

    console.log(`✅ Отреставрированная фотография сгенерирована и сохранена для пользователя ${userId}`);
    console.log(`📁 File ID: ${fileId}`);

    const mainMenuMessage = MAIN_MENU_MESSAGE;

    await ctx.telegram.sendMessage(
      userId,
      mainMenuMessage,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard(mainMenuKeyboard)
    });

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

// ДЕД МОРОЗ
async function generateDMPhotoWithBanana(imageUrl: string, prompt: string): Promise<string> {
  console.log(`📸 Создаю фото Деда Мороза: ${imageUrl}`);
  console.log(`💬 С описанием: ${prompt}`);
  
  const taskId = await createRestorationTask(imageUrl, prompt);
  console.log(`✅ Задача создана: ${taskId}`);
  
  const videoUrl = await waitForRestorationTaskCompletion(taskId);
  console.log(`✅ Фото готово: ${videoUrl}`);
  
  return videoUrl;
}

export async function processDMPhotoCreation(ctx: any, userId: number, userState: UserState, prompt: string) {
  try {
    const deducted = await Database.deductBalance(
      userId,
      PRICES.DED_MOROZ,
      'Создание Деда Мороза'
    );

    if (!deducted) {
      await ctx.telegram.sendMessage(
        userId,
        '❌ Недостаточно средств для генерации'
      );
      return;
    }
    console.log(`⏳ Начинается создание фото Деда Мороза для пользователя ${userId}...`);
    const photoFileId = userState.photoFileId;
    const photoUrl = await ctx.telegram.getFileLink(photoFileId);
    console.log(`📸 URL фото: ${photoUrl.href}`);

    await ctx.telegram.sendMessage(userId, '⏳ Начинаю генерацию... Это займет около 3-х минут.');
    
    const DMPhotoUrl = await generateDMPhotoWithBanana(photoUrl.href, prompt);

    const photoResponse = await axiosRetry(DMPhotoUrl, 3);
    if (photoResponse == null) {
      throw new Error('Не удалось загрузить фото');
    };
    const photoBuffer = Buffer.from(photoResponse.data);

    if (userState.freeGenerations == undefined) return;
    let caption = `
✅ <b>Ваше фото с Дедом Морозом готово!</b>

1️⃣ Если Дед Мороз <b><i>понравился</i></b> — нажмите кнопку <b><i>«Подтвердить»</i></b> и перейдём к волшебному видео для вашего ребёнка ❤️
2️⃣ Если Дед Мороз <b><i>не устроил</i></b> — смело жмите кнопку <b><i>«Повторить»</i></b>

Помните, у вас ещё ${userState.freeGenerations} бесплатные попытки 🙌`.trim()

    if (userState.freeGenerations === 1) {
      caption = `
✅ <b>Ваше фото с Дедом Морозом готово!</b> 

Посмотрите, как он получился на этот раз🎅

1️⃣ Если Дед Мороз <b><i>понравился</i></b> — нажмите кнопку <b><i>«Подтвердить»</i></b> и перейдём к волшебному видео для вашего ребёнка ❤️
2️⃣ Если Дед Мороз <b><i>не устроил</i></b> — смело жмите кнопку <b><i>«Повторить»</i></b>

У вас осталась ещё 1 бесплатная попытка — давайте сделаем идеальное фото вместе! 🙌`
    } else if (userState.freeGenerations === 0) {
      caption = `
✅ <b>Ваше фото с Дедом Морозом готово!</b>

Мы уверены, он волшебно получился на этот раз🎅

Теперь можно только перейти к созданию поздравления — нажмите кнопку <b><i>«Подтвердить»</i></b> 🙌`

      const sentMessage = await ctx.telegram.sendPhoto(userId, { source: photoBuffer }, {
        caption: caption,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Подтвердить', callback_data: 'confirm_dm' }],
          ]
        }
      });

      const fileId = sentMessage.photo[sentMessage.photo.length - 1].file_id;

      userStates.set(userId, {
        ...userState,
        dmPhotoFileId: fileId,
        freeGenerations: userState.freeGenerations - 1,
      });
      return;
    }
    const sentMessage = await ctx.telegram.sendPhoto(userId, { source: photoBuffer }, {
      caption: caption,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Подтвердить', callback_data: 'confirm_dm' }],
          [{ text: `Повторить ${4 - userState.freeGenerations}/3`, callback_data: 'repeat_dm' }]
        ]
      }
    });

    const fileId = sentMessage.photo[sentMessage.photo.length - 1].file_id;

    userStates.set(userId, {
      ...userState,
      dmPhotoFileId: fileId,
      freeGenerations: userState.freeGenerations - 1,
    });
  } catch (error) {
    console.error('❌ Ошибка генерации фотографии:', error);
    
    await Database.addBalance(
      userId,
      PRICES.DED_MOROZ,
      'Возврат средств за ошибку генерации',
      'bonus'
    );

    console.log(`💰 Возвращено ${PRICES.DED_MOROZ}₽ пользователю ${userId}`);
    
    await ctx.telegram.sendMessage(
      userId,
      '❌ Произошла ошибка при генерации. Средства возвращены на баланс.'
    );
  }
}

// Открытка

async function generatePostcardWithBanana(imageUrl: string, prompt: string): Promise<string> {
  console.log(`📸 Создаю открытку: ${imageUrl}`);
  console.log(`💬 С описанием: ${prompt}`);
  
  const taskId = await createRestorationTask(imageUrl, prompt);
  console.log(`✅ Задача создана: ${taskId}`);
  
  const videoUrl = await waitForRestorationTaskCompletion(taskId);
  console.log(`✅ Открытка готова: ${videoUrl}`);
  
  return videoUrl;
}

export async function processPostcardCreationWithBanana(ctx: any, userId: number, photoFileId: string, prompt: string) {
  try {
    const deducted = await Database.deductBalance(
      userId,
      PRICES.POSTCARD_PHOTO,
      'Создание открытки'
    );

    if (!deducted) {
      await ctx.telegram.sendMessage(
        userId,
        '❌ Недостаточно средств для генерации'
      );
      return;
    }
    console.log(`⏳ Начинается создание открытки для пользователя ${userId}...`);
    const photoUrl = await ctx.telegram.getFileLink(photoFileId);
    console.log(`📸 URL фото: ${photoUrl.href}`);
    
    const DMPhotoUrl = await generatePostcardWithBanana(photoUrl.href, prompt);

    const photoResponse = await axiosRetry(DMPhotoUrl, 3);
    if (photoResponse == null) {
      throw new Error('Не удалось загрузить фото');
    };
    const photoBuffer = Buffer.from(photoResponse.data);
    const caption = `✅ <b>Ваша открытка готова!</b>`.trim()
    const sentMessage = await ctx.telegram.sendPhoto(userId, { source: photoBuffer }, {
      caption: caption,
      parse_mode: 'HTML',
    });

    const fileId = sentMessage.photo[sentMessage.photo.length - 1].file_id;
    await Database.saveGeneratedFile(userId, 'postcard_photo', fileId, prompt);

    console.log(`✅ Открытка из фото сгенерирована и сохранена для пользователя ${userId}`);
    console.log(`📁 File ID: ${fileId}`);

    const mainMenuMessage = MAIN_MENU_MESSAGE;

    await ctx.telegram.sendMessage(
      userId,
      mainMenuMessage,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard(mainMenuKeyboard)
    });
    
  } catch (error) {
    console.error('❌ Ошибка генерации открытки:', error);
    
    await Database.addBalance(
      userId,
      PRICES.POSTCARD_PHOTO,
      'Возврат средств за ошибку генерации',
      'bonus'
    );

    console.log(`💰 Возвращено ${PRICES.POSTCARD_PHOTO}₽ пользователю ${userId}`);
    
    await ctx.telegram.sendMessage(
      userId,
      '❌ Произошла ошибка при генерации. Средства возвращены на баланс.'
    );
  }
}