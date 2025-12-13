import { Markup, Telegraf } from 'telegraf';
import { BotContext, UserState } from '../types';
import { Database } from '../database';
import { broadcast } from '../bot';
import { mailingQueue } from '../services/mailing-queue.service';


async function sendBroadcastExample(ctx: any, userId: number, userState: UserState) {
  const isAdmin = await Database.isAdmin(userId);

  if (!isAdmin) return;

  const currentBroadcast = broadcast.get(userId);

  if (!currentBroadcast) return;

  if (currentBroadcast.photoFileId) {
    await ctx.telegram.sendPhoto(userId, currentBroadcast.photoFileId, {
      caption: currentBroadcast.message,
      caption_entities: currentBroadcast.entities,
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Подтвердить', callback_data: 'send_broadcast' }],
          [{ text: 'Главное меню', callback_data: 'main_menu' }],
        ],
      }
    });
  } else if (currentBroadcast.videoFileId) {
    await ctx.telegram.sendVideo(userId, currentBroadcast.videoFileId, {
      caption: currentBroadcast.message,
      caption_entities: currentBroadcast.entities,
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Подтвердить', callback_data: 'send_broadcast' }],
          [{ text: 'Главное меню', callback_data: 'main_menu' }],
        ],
      }
    });
  } else {
    await ctx.telegram.sendMessage(userId, currentBroadcast.message, {
      entities: currentBroadcast.entities,
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Подтвердить', callback_data: 'send_broadcast' }],
          [{ text: 'Главное меню', callback_data: 'main_menu' }],
        ],
      }
    });
  }
}

export async function broadcastMessageHandler(ctx: any, userId: number, userState: UserState) {
  const isAdmin = await Database.isAdmin(userId);

  if (!isAdmin) return;

  // Сохраняем текст рассылки в глобальную переменную
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

  // Сохраняем фотографию для рассылки в глобальную переменную
  broadcast.set(userId, {
    ...currentBroadcast,
    photoFileId: photoFileId,
  });

  console.log(broadcast);

  sendBroadcastExample(ctx, userId, userState);
}

export async function broadcastVideoHandler(ctx: any, userId: number, userState: UserState) {
  const isAdmin = Database.isAdmin(userId);

  if (!isAdmin) return;

  const videoFileId = ctx.message.video.file_id;

  const currentBroadcast = broadcast.get(userId);
  if (!currentBroadcast) return;

  // Сохраняем видео для рассылки в глобальную переменную
  broadcast.set(userId, {
    ...currentBroadcast,
    videoFileId: videoFileId,
  });

  sendBroadcastExample(ctx, userId, userState);
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
    // Отсылаемся на textHandlers.ts, где будем ждать фотографию для рассылки
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

    sendBroadcastExample(ctx, userId, userState);
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
    
    const mailingData = await Database.createMailingData({
      admin_id: userId,
      message: currentBroadcast.message,
      entities: currentBroadcast.entities,
      photo_file_id: currentBroadcast.photoFileId,
      video_file_id: currentBroadcast.videoFileId,
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
}