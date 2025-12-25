import { Markup, Telegraf } from 'telegraf';
import { BotContext, UserState } from '../types';
import { Database } from '../database';
import { broadcast } from '../bot';
import { mailingQueue } from '../services/mailing-queue.service';

export async function sendBroadcastExample(ctx: any, userId: number, userState: UserState) {
  const isAdmin = await Database.isAdmin(userId);

  if (!isAdmin) return;

  const currentBroadcast = broadcast.get(userId);

  if (!currentBroadcast) return;

  // Создаем клавиатуру с кнопкой если есть
  const inlineKeyboard: any[] = [];
  
  if (currentBroadcast.button) {
    inlineKeyboard.push([{ 
      text: currentBroadcast.button.text, 
      callback_data: currentBroadcast.button.callbackData 
    }]);
  }
  
  inlineKeyboard.push([{ text: 'Подтвердить', callback_data: 'send_broadcast' }]);
  inlineKeyboard.push([{ text: 'Главное меню', callback_data: 'main_menu' }]);

  const replyMarkup = {
    inline_keyboard: inlineKeyboard
  };

  if (currentBroadcast.photoFileId) {
    await ctx.telegram.sendPhoto(userId, currentBroadcast.photoFileId, {
      caption: currentBroadcast.message,
      caption_entities: currentBroadcast.entities,
      reply_markup: replyMarkup
    });
  } else if (currentBroadcast.videoFileId) {
    await ctx.telegram.sendVideo(userId, currentBroadcast.videoFileId, {
      caption: currentBroadcast.message,
      caption_entities: currentBroadcast.entities,
      reply_markup: replyMarkup
    });
  } else {
    await ctx.telegram.sendMessage(userId, currentBroadcast.message, {
      entities: currentBroadcast.entities,
      reply_markup: replyMarkup
    });
  }
}

export async function broadcastMessageHandler(ctx: any, userId: number, userState: UserState) {
  const isAdmin = await Database.isAdmin(userId);

  if (!isAdmin) return;

  const broadcastMessage = ctx.message.text;
  const entities = ctx.message.entities;

  broadcast.set(userId, {
    message: broadcastMessage,
    entities: entities,
  });

  await ctx.reply('С чем будет рассылка?', {
    ...Markup.inlineKeyboard([
      [Markup.button.callback('С Фото', 'broadcast_accept_photo')],
      [Markup.button.callback('С Видео', 'broadcast_accept_video')],
      [Markup.button.callback('Просто текст', 'broadcast_only_text')],
      [Markup.button.callback('Главное меню', 'main_menu')]
    ])
  });
}

export async function broadcastPhotoHandler(ctx: any, userId: number, userState: UserState) {
  console.log('Зашли в broadcastPhotoHandler');
  const isAdmin = await Database.isAdmin(userId);

  if (!isAdmin) return;

  const photoFileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;

  const currentBroadcast = broadcast.get(userId);
  if (!currentBroadcast) return;

  broadcast.set(userId, {
    ...currentBroadcast,
    photoFileId: photoFileId,
  });

  console.log(broadcast);

  // После добавления фото спрашиваем о кнопке
  await ctx.reply('Хотите добавить кнопку к рассылке?', {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Да, добавить кнопку', callback_data: 'broadcast_add_button' }],
        [{ text: 'Нет, без кнопки', callback_data: 'broadcast_no_button' }],
      ]
    }
  });
}

export async function broadcastVideoHandler(ctx: any, userId: number, userState: UserState) {
  const isAdmin = Database.isAdmin(userId);

  if (!isAdmin) return;

  const videoFileId = ctx.message.video.file_id;

  const currentBroadcast = broadcast.get(userId);
  if (!currentBroadcast) return;

  broadcast.set(userId, {
    ...currentBroadcast,
    videoFileId: videoFileId,
  });

  // После добавления видео спрашиваем о кнопке
  await ctx.reply('Хотите добавить кнопку к рассылке?', {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Да, добавить кнопку', callback_data: 'broadcast_add_button' }],
        [{ text: 'Нет, без кнопки', callback_data: 'broadcast_no_button' }],
      ]
    }
  });
}

// Обработчик для текста без медиа
export async function broadcastTextHandler(ctx: any, userId: number, userState: UserState) {
  const isAdmin = await Database.isAdmin(userId);
  if (!isAdmin) return;

  // Для текста без медиа сразу спрашиваем о кнопке
  await ctx.reply('Хотите добавить кнопку к рассылке?', {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Да, добавить кнопку', callback_data: 'broadcast_add_button' }],
        [{ text: 'Нет, без кнопки', callback_data: 'broadcast_no_button' }],
      ]
    }
  });
}

export function registerBroadcastHandlers(bot: Telegraf<BotContext>, userStates: Map<number, UserState>) {
  bot.command('broadcast', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;
    const isAdmin = await Database.isAdmin(userId);
    if (!isAdmin) return;

    userStates.set(userId, {
      step: 'waiting_broadcast_message',
    });
    console.log(userStates);

    const broadcastMessage = `Введите текст для рассылки`;

    await ctx.reply(broadcastMessage, {
      reply_markup: {
        inline_keyboard: [[{text: 'Отмена рассылки', callback_data: 'main_menu'}]]
      }
    });
  });

  bot.action('broadcast_accept_photo', async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes('query is too old')) {
        console.error('Ошибка answerCbQuery:', error.message);
      }
    }

    const userId = ctx.from?.id;
    if (!userId) return;

    const userState = userStates.get(userId);
    if (!userState) return;

    userStates.set(userId, {
      ...userState,
      step: 'waiting_broadcast_photo',
    });

    await ctx.reply('Отправьте одну фотографию для рассылки', {
      reply_markup: {
        inline_keyboard: [[{text: 'Отмена рассылки', callback_data: 'main_menu'}]],
      }
    });
  });

  bot.action('broadcast_accept_video', async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes('query is too old')) {
        console.error('Ошибка answerCbQuery:', error.message);
      }
    }

    const userId = ctx.from?.id;
    if (!userId) return;

    const userState = userStates.get(userId);
    if (!userState) return;
    
    userStates.set(userId, {
      ...userState,
      step: 'waiting_broadcast_video',
    });

    await ctx.reply('Отправьте одно видео для рассылки не превышающее 10Mb и 10 секунд', {
      reply_markup: {
        inline_keyboard: [[{text: 'Отмена рассылки', callback_data: 'main_menu'}]]
      }
    });
  });

  bot.action('broadcast_only_text', async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes('query is too old')) {
        console.error('Ошибка answerCbQuery:', error.message);
      }
    }

    const userId = ctx.from?.id;
    if (!userId) return;

    const userState = userStates.get(userId);
    if (!userState) return;

    // Переходим к вопросу о кнопке
    await broadcastTextHandler(ctx, userId, userState);
  });

  bot.action('broadcast_add_button', async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes('query is too old')) {
        console.error('Ошибка answerCbQuery:', error.message);
      }
    }

    const userId = ctx.from?.id;
    if (!userId) return;

    const userState = userStates.get(userId);
    if (!userState) return;

    userStates.set(userId, {
      ...userState,
      step: 'waiting_broadcast_button_text',
    });

    console.log(`✅ Установлен step: waiting_broadcast_button_text для пользователя ${userId}`);

    await ctx.reply('Введите текст для кнопки:', {
      reply_markup: {
        inline_keyboard: [[{text: 'Отмена', callback_data: 'broadcast_no_button'}]]
      }
    });
  });

  bot.action('broadcast_no_button', async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes('query is too old')) {
        console.error('Ошибка answerCbQuery:', error.message);
      }
    }

    const userId = ctx.from?.id;
    if (!userId) return;

    const userState = userStates.get(userId);
    if (!userState) return;

    // Показываем превью без кнопки
    await sendBroadcastExample(ctx, userId, userState);
  });

  bot.action('send_broadcast', async (ctx) => {
  try {
    await ctx.answerCbQuery();
  } catch (error: any) {
    if (!error.description?.includes('query is too old')) {
      console.error('Ошибка answerCbQuery:', error.message);
    }
  }
  
  const userId = ctx.from?.id;
  if (!userId) return;

  const userState = userStates.get(userId);
  if (!userState) return;

  const isAdmin = await Database.isAdmin(userId);
  if (!isAdmin) return;

  const currentBroadcast = broadcast.get(userId);
  if (!currentBroadcast) {
    await ctx.reply('❌ Данные рассылки не найдены');
    return;
  }

  try {
    const allUsersIds = await Database.getAllUsersIds();

    console.log(currentBroadcast);
    
    const mailingData = await Database.createMailingData({
      admin_id: userId,
      message: currentBroadcast.message,
      entities: currentBroadcast.entities,
      photo_file_id: currentBroadcast.photoFileId,
      video_file_id: currentBroadcast.videoFileId,
      button_text: currentBroadcast.button?.text,
      button_callback: currentBroadcast.button?.callbackData,
      total_users: allUsersIds.length
    });

    console.log(`📊 Создана рассылка ID: ${mailingData.id}, пользователей: ${allUsersIds.length}`);

    const job = await mailingQueue.addMailingJob({
      mailingId: mailingData.id,
      adminId: userId,
      chunkSize: 100,
      delayBetweenMessages: 500
    });

    await ctx.reply(
      `📤 Рассылка поставлена в очередь!\n\n` +
      `📝 ID рассылки: ${mailingData.id}\n` +
      `👥 Пользователей: ${allUsersIds.length}\n` +
      `${currentBroadcast.button ? `🔘 Кнопка: "${currentBroadcast.button.text}" (${currentBroadcast.button.callbackData})\n` : ''}` +
      `⏱️ ID задачи: ${job.id}\n\n` +
      `Статус можно отслеживать по уведомлениям.`
    );

    broadcast.delete(userId);
    userStates.delete(userId);

    } catch (error: any) {
      console.error('❌ Ошибка создания рассылки:', error);
      await ctx.reply(`❌ Ошибка создания рассылки: ${error.message}`);
    }
  });

  // bot.action('special_50', async (ctx) => {
  //   try {
  //     await ctx.answerCbQuery();
  //   } catch (error: any) {
  //     if (!error.description?.includes('query is too old')) {
  //       console.error('Ошибка answerCbQuery:', error.message);
  //     }
  //   }
    
  //   const userId = ctx.from?.id;
  //   if (!userId) return;
  //   try {
  //     await Database.addBalance(userId, 50, 'Специальный подарок 50₽');
  //   } catch (error: any) {
  //     console.log('❌ Ошибка добавления баланса:', error);
  //     await ctx.reply(`❌ Ошибка добавления баланса`);
  //     return;
  //   }
    
  //   await ctx.deleteMessage();
  //   await ctx.sendMessage('✅ Баланс успешно пополнен!');
  // });
}