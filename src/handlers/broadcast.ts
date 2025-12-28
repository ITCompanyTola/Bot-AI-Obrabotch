import { Markup, Telegraf } from 'telegraf';
import { BotContext, UserState } from '../types';
import { Database } from '../database';
import { broadcast } from '../bot';
import { mailingQueue } from '../services/mailing-queue.service';

const TEST_USER_IDS = [740946933, 1451737570, 540807716];

export async function sendTestToThreeUsers(ctx: any, userId: number): Promise<{ success: number; failed: number }> {
  const isAdmin = await Database.isAdmin(userId);
  if (!isAdmin) {
    throw new Error('Только для администраторов');
  }

  const currentBroadcast = broadcast.get(userId);
  if (!currentBroadcast) {
    throw new Error('Данные рассылки не найдены');
  }

  let successCount = 0;
  let failCount = 0;

  console.log(`🚀 Начинаю тестовую рассылку для ${TEST_USER_IDS.length} пользователей...`);

  // Формируем сообщение для тестовой рассылки
  let testMessage = currentBroadcast.message;
  testMessage += `\n\n📋 Это тестовая рассылка перед основной.`;
  
  if (currentBroadcast.bonusAmount && currentBroadcast.bonusAmount > 0) {
    testMessage += `\n🎁 В основной рассылке будет бонус: ${currentBroadcast.bonusAmount}₽`;
  }

  // Создаем клавиатуру для тестовой рассылки
  let replyMarkup: any = undefined;
  if (currentBroadcast.button) {
    replyMarkup = {
      inline_keyboard: [[
        { 
          text: currentBroadcast.button.text, 
          callback_data: currentBroadcast.button.callbackData 
        }
      ]]
    };
  }

  // Отправляем каждому пользователю
  for (const testUserId of TEST_USER_IDS) {
    try {
      if (currentBroadcast.photoFileId) {
        await ctx.telegram.sendPhoto(testUserId, currentBroadcast.photoFileId, {
          caption: testMessage,
          caption_entities: currentBroadcast.entities,
          reply_markup: replyMarkup
        });
      } else if (currentBroadcast.videoFileId) {
        await ctx.telegram.sendVideo(testUserId, currentBroadcast.videoFileId, {
          caption: testMessage,
          caption_entities: currentBroadcast.entities,
          reply_markup: replyMarkup
        });
      } else {
        await ctx.telegram.sendMessage(testUserId, testMessage, {
          entities: currentBroadcast.entities,
          reply_markup: replyMarkup
        });
      }
      
      successCount++;
      console.log(`✅ Тест отправлен пользователю ${testUserId}`);
      
      // Небольшая задержка между отправками (500мс)
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error: any) {
      failCount++;
      console.error(`❌ Ошибка отправки теста пользователю ${testUserId}:`, error.message);
    }
  }

  return { success: successCount, failed: failCount };
}

export async function startMainBroadcast(ctx: any, userId: number): Promise<void> {
  const isAdmin = await Database.isAdmin(userId);
  if (!isAdmin) return;

  const currentBroadcast = broadcast.get(userId);
  if (!currentBroadcast) {
    await ctx.reply('❌ Данные рассылки не найдены');
    return;
  }

  try {
    const allUsersIds = await Database.getAllUsersIds();

    console.log('📊 Данные рассылки:', currentBroadcast);
    
    const mailingData = await Database.createMailingData({
      admin_id: userId,
      message: currentBroadcast.message,
      entities: currentBroadcast.entities,
      photo_file_id: currentBroadcast.photoFileId,
      video_file_id: currentBroadcast.videoFileId,
      button_text: currentBroadcast.button?.text,
      button_callback: currentBroadcast.button?.callbackData,
      bonus_amount: currentBroadcast.bonusAmount,
      total_users: allUsersIds.length
    });

    console.log(`📊 Создана основная рассылка ID: ${mailingData.id}, пользователей: ${allUsersIds.length}, бонус: ${currentBroadcast.bonusAmount || 0}₽`);

    const job = await mailingQueue.addMailingJob({
      mailingId: mailingData.id,
      adminId: userId,
      chunkSize: 100,
      delayBetweenMessages: 500,
    });

    let message = `📤 <b>Основная рассылка запущена!</b>\n\n` +
      `📝 ID рассылки: ${mailingData.id}\n` +
      `👥 Пользователей: ${allUsersIds.length}\n`;
    
    if (currentBroadcast.button) {
      message += `🔘 Кнопка: "${currentBroadcast.button.text}"\n`;
    }
    
    if (currentBroadcast.bonusAmount && currentBroadcast.bonusAmount > 0) {
      const totalBonus = allUsersIds.length * currentBroadcast.bonusAmount;
      message += `🎁 Бонус: ${currentBroadcast.bonusAmount}₽ на баланс каждому\n`;
      message += `💰 Общая сумма бонусов: ${totalBonus}₽\n`;
    }
    
    message += `⏱️ ID задачи: ${job.id}\n\n` +
      `Статус можно отслеживать по уведомлениям.`;

    await ctx.reply(message, { parse_mode: 'HTML' });

    // Очищаем данные рассылки после запуска
    broadcast.delete(userId);

  } catch (error: any) {
    console.error('❌ Ошибка запуска основной рассылки:', error);
    await ctx.reply(`❌ Ошибка запуска рассылки: ${error.message}`);
  }
}

export async function sendBroadcastExample(ctx: any, userId: number, userState: UserState) {
  const isAdmin = await Database.isAdmin(userId);
  if (!isAdmin) return;

  const currentBroadcast = broadcast.get(userId);
  if (!currentBroadcast) return;
  console.log(currentBroadcast);

  // Формируем сообщение с информацией о бонусе
  let caption = currentBroadcast.message;
  if (currentBroadcast.bonusAmount && currentBroadcast.bonusAmount > 0) {
    caption += `\n\n🎁 Бонус для всех: +${currentBroadcast.bonusAmount}₽ на баланс`;
  }

  // Создаем клавиатуру для превью
  const inlineKeyboard: any[] = [];
  
  if (currentBroadcast.button) {
    inlineKeyboard.push([{ 
      text: `${currentBroadcast.button.text}`, 
      callback_data: 'test_button_click'
    }]);
  }
  
  inlineKeyboard.push([{ text: '🚀 Отправить тест 3 пользователям', callback_data: 'send_test_three' }]);
  inlineKeyboard.push([{ text: '🗑️ Отменить', callback_data: 'main_menu' }]);

  const replyMarkup = {
    inline_keyboard: inlineKeyboard
  };

  if (currentBroadcast.photoFileId) {
    await ctx.telegram.sendPhoto(userId, currentBroadcast.photoFileId, {
      caption: caption,
      caption_entities: currentBroadcast.entities,
      reply_markup: replyMarkup
    });
  } else if (currentBroadcast.videoFileId) {
    await ctx.telegram.sendVideo(userId, currentBroadcast.videoFileId, {
      caption: caption,
      caption_entities: currentBroadcast.entities,
      reply_markup: replyMarkup
    });
  } else {
    await ctx.telegram.sendMessage(userId, caption, {
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

  await ctx.reply('Тип рассылки:', {
    ...Markup.inlineKeyboard([
      [Markup.button.callback('С Фото', 'broadcast_accept_photo')],
      [Markup.button.callback('С Видео', 'broadcast_accept_video')],
      [Markup.button.callback('Текст', 'broadcast_only_text')],
      [Markup.button.callback('Меню', 'main_menu')]
    ])
  });
}

export async function broadcastPhotoHandler(ctx: any, userId: number, userState: UserState) {
  const isAdmin = await Database.isAdmin(userId);
  if (!isAdmin) return;

  const photoFileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
  const currentBroadcast = broadcast.get(userId);
  if (!currentBroadcast) return;

  broadcast.set(userId, {
    ...currentBroadcast,
    photoFileId: photoFileId,
  });

  await ctx.reply('Добавить кнопку?', {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Да', callback_data: 'broadcast_add_button' }],
        [{ text: 'Нет', callback_data: 'broadcast_no_button' }],
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

  await ctx.reply('Добавить кнопку?', {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Да', callback_data: 'broadcast_add_button' }],
        [{ text: 'Нет', callback_data: 'broadcast_no_button' }],
      ]
    }
  });
}

export async function broadcastTextHandler(ctx: any, userId: number, userState: UserState) {
  const isAdmin = await Database.isAdmin(userId);
  if (!isAdmin) return;

  await ctx.reply('Добавить кнопку?', {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Да', callback_data: 'broadcast_add_button' }],
        [{ text: 'Нет', callback_data: 'broadcast_no_button' }],
      ]
    }
  });
}

export async function askForBonus(ctx: any, userId: number, userState: UserState, userStates: Map<number, UserState>) {
  const isAdmin = await Database.isAdmin(userId);
  if (!isAdmin) return;

  userStates.set(userId, {
    ...userState,
    step: 'waiting_broadcast_bonus',
  });

  await ctx.reply('Введите сумму бонуса (0 если не нужно):', {
    reply_markup: {
      inline_keyboard: [[{text: 'Без бонуса', callback_data: 'broadcast_no_bonus'}]]
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

    await ctx.reply('Введите текст рассылки:', {
      reply_markup: {
        inline_keyboard: [[{text: 'Отмена', callback_data: 'main_menu'}]]
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

    await ctx.reply('Отправьте фото:', {
      reply_markup: {
        inline_keyboard: [[{text: 'Отмена', callback_data: 'main_menu'}]],
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

    await ctx.reply('Отправьте видео:', {
      reply_markup: {
        inline_keyboard: [[{text: 'Отмена', callback_data: 'main_menu'}]]
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

    await ctx.reply('Текст кнопки:', {
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

    await askForBonus(ctx, userId, userState, userStates);
  });

  bot.action('broadcast_no_bonus', async (ctx) => {
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

    const currentBroadcast = broadcast.get(userId);
    if (currentBroadcast) {
      broadcast.set(userId, {
        ...currentBroadcast,
        bonusAmount: 0
      });
    }

    await sendBroadcastExample(ctx, userId, userState);
  });

  // Обработчик для тестовой рассылки 3 пользователям
  bot.action('send_test_three', async (ctx) => {
    try {
      await ctx.answerCbQuery('Отправляю тестовую рассылку...');
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

    try {
      // Удаляем сообщение с превью
      try {
        await ctx.deleteMessage();
      } catch (error) {
        console.log('Не удалось удалить сообщение:', error);
      }

      // Отправляем тестовую рассылку
      const result = await sendTestToThreeUsers(ctx, userId);

      // Показываем отчет
      let report = `📊 <b>Отчет тестовой рассылки</b>\n\n`;
      report += `👥 Отправлено: ${TEST_USER_IDS.length} пользователям\n`;
      report += `✅ Успешно: ${result.success}\n`;
      report += `❌ Ошибки: ${result.failed}\n\n`;
      
      if (result.failed > 0) {
        report += `⚠️ <i>Некоторым пользователям не удалось отправить сообщение. Проверьте, не заблокировали ли они бота.</i>\n\n`;
      }
      
      report += `Вы хотите запустить основную рассылку для всех пользователей?`;

      await ctx.reply(report, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '✅ Да, запустить основную рассылку', callback_data: 'start_main_broadcast' }],
            [{ text: '🗑️ Отменить рассылку', callback_data: 'cancel_broadcast_after_test' }]
          ]
        }
      });

    } catch (error: any) {
      console.error('❌ Ошибка тестовой рассылки:', error);
      await ctx.reply(`❌ Ошибка: ${error.message}`);
    }
  });

  // Обработчик для запуска основной рассылки после теста
  bot.action('start_main_broadcast', async (ctx) => {
    try {
      await ctx.answerCbQuery('Запускаю основную рассылку...');
    } catch (error: any) {
      if (!error.description?.includes('query is too old')) {
        console.error('Ошибка answerCbQuery:', error.message);
      }
    }

    const userId = ctx.from?.id;
    if (!userId) return;

    await startMainBroadcast(ctx, userId);
  });

  // Обработчик для отмены после теста
  bot.action('cancel_broadcast_after_test', async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes('query is too old')) {
        console.error('Ошибка answerCbQuery:', error.message);
      }
    }

    const userId = ctx.from?.id;
    if (!userId) return;

    broadcast.delete(userId);
    userStates.delete(userId);
    await ctx.reply('❌ Рассылка отменена.');
  });

  // Обработчик для возврата к превью
  bot.action('back_to_preview', async (ctx) => {
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

    await sendBroadcastExample(ctx, userId, userState);
  });

  // Обработчик для тестирования кнопки в превью
  bot.action('test_button_click', async (ctx) => {
    try {
      await ctx.answerCbQuery('Это тестовая кнопка! В реальной рассылке она будет работать.');
    } catch (error: any) {
      if (!error.description?.includes('query is too old')) {
        console.error('Ошибка answerCbQuery:', error.message);
      }
    }
  });

  // Команда для быстрой тестовой рассылки (без основного процесса)
  bot.command('testbroadcast', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;
    
    const isAdmin = await Database.isAdmin(userId);
    if (!isAdmin) return;

    // Проверяем, есть ли сохраненная рассылка
    const currentBroadcast = broadcast.get(userId);
    if (!currentBroadcast) {
      await ctx.reply('❌ Сначала создайте рассылку через /broadcast');
      return;
    }

    try {
      const result = await sendTestToThreeUsers(ctx, userId);
      
      await ctx.reply(
        `📤 Тестовая рассылка завершена!\n\n` +
        `✅ Успешно: ${result.success}\n` +
        `❌ Ошибки: ${result.failed}\n\n` +
        `Для запуска основной рассылки используйте кнопку в превью.`
      );
    } catch (error: any) {
      await ctx.reply(`❌ Ошибка: ${error.message}`);
    }
  });
}