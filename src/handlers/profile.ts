import { Telegraf, Markup } from 'telegraf';
import { BotContext, UserState } from '../types';
import { Database } from '../database';

export function registerProfileHandlers(bot: Telegraf<BotContext>, userStates: Map<number, UserState>) {
  bot.action('profile', async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes('query is too old')) {
        console.error('Ошибка answerCbQuery:', error.message);
      }
    }
    
    const userId = ctx.from?.id;
    if (!userId) return;

    const balance = await Database.getUserBalance(userId);

    const profileMessage = `
Это ваш личный кабинет!
Здесь вы можете:


• Проверить <b><i>свой баланс</i></b> 💰
• <b><i>Пополнить</i></b> его в пару кликов ➕
• Просмотреть важные <b><i>документы</i></b> 📄
• Посмотреть свои <b><i>фото</i></b> 📸
• Посмотреть свои <b><i>треки</i></b> 🎵
• Посмотреть свои <b><i>цветные фото</i></b> 🎨
• Посмотреть свои <b><i>восстановленные фото</i></b> ✨

<blockquote>💰 Ваш баланс: ${balance.toFixed(2)} ₽</blockquote>
    `.trim();

    await ctx.editMessageText(
      profileMessage,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback('Мои реставрации', 'my_restorations'),
            Markup.button.callback('Мои цветные фото', 'my_colorize')
          ],
          [
            Markup.button.callback('Мои видео', 'my_photos'),
            Markup.button.callback('Мои треки', 'my_tracks')
          ],
          // [
          //   Markup.button.callback('Мои фото Д.Мороза', 'my_dm_photos'),
          //   Markup.button.callback('Мои видео Д.Мороза', 'my_dm_videos')
          // ],
          [Markup.button.callback('💳 Пополнить баланс', 'refill_balance_from_profile')],
          [Markup.button.callback('Документы', 'documents')],
          [Markup.button.callback('Главное меню', 'main_menu')]
        ])
      }
    );
  });

  bot.action('my_photos', async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes('query is too old')) {
        console.error('Ошибка answerCbQuery:', error.message);
      }
    }
    
    const userId = ctx.from?.id;
    if (!userId) return;

    const photos = await Database.getUserPhotos(userId);
    
    if (photos.length === 0) {
      await ctx.editMessageText(
        '📹 У вас пока нет сгенерированных видео',
        Markup.inlineKeyboard([
          [Markup.button.callback('Назад', 'profile')]
        ])
      );
      return;
    }

    for (const photo of photos) {
      try {
        await ctx.telegram.sendVideo(userId, photo.file_id, {
          caption: photo.prompt ? `Описание: ${photo.prompt}` : undefined
        });
      } catch (error) {
        console.error('Ошибка отправки видео:', error);
        await ctx.telegram.sendMessage(userId, `❌ Видео недоступно (ID: ${photo.id})`);
      }
    }

    await ctx.telegram.sendMessage(
      userId,
      `📹 Ваши видео (${photos.length}):`,
      Markup.inlineKeyboard([
        [Markup.button.callback('Назад', 'profile')]
      ])
    );
  });

  bot.action('my_tracks', async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes('query is too old')) {
        console.error('Ошибка answerCbQuery:', error.message);
      }
    }
    
    const userId = ctx.from?.id;
    if (!userId) return;

    const tracks = await Database.getUserTracks(userId);
    
    if (tracks.length === 0) {
      await ctx.editMessageText(
        '🎵 У вас пока нет сгенерированных треков',
        Markup.inlineKeyboard([
          [Markup.button.callback('Назад', 'profile')]
        ])
      );
      return;
    }

    for (const track of tracks) {
      try {
        await ctx.telegram.sendAudio(userId, track.file_id, {
          caption: track.prompt ? `Описание: ${track.prompt}` : undefined
        });
      } catch (error) {
        console.error('Ошибка отправки трека:', error);
        await ctx.telegram.sendMessage(userId, `❌ Трек недоступен (ID: ${track.id})`);
      }
    }

    await ctx.telegram.sendMessage(
      userId,
      `🎵 Ваши треки (${tracks.length}):`,
      Markup.inlineKeyboard([
        [Markup.button.callback('Назад', 'profile')]
      ])
    );
  });

  bot.action('my_restorations', async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes('query is too old')) {
        console.error('Ошибка answerCbQuery:', error.message);
      }
    }
    
    const userId = ctx.from?.id;
    if (!userId) return;

    const restorations = await Database.getUserRestorations(userId);
    
    if (restorations.length === 0) {
      await ctx.editMessageText(
        '📸 У вас пока нет сгенерированных реставраций',
        Markup.inlineKeyboard([
          [Markup.button.callback('Назад', 'profile')]
        ])
      );
      return;
    }

    for (const restoration of restorations) {
      try {
        await ctx.telegram.sendPhoto(userId, restoration.file_id);
      } catch (error) {
        console.error('Ошибка отправки реставрации:', error);
        await ctx.telegram.sendMessage(userId, `❌ Реставрация недоступна (ID: ${restoration.id})`);
      }
    }

    await ctx.telegram.sendMessage(
      userId,
      `📸 Ваши реставрации (${restorations.length}):`,
      Markup.inlineKeyboard([
        [Markup.button.callback('Назад', 'profile')]
      ])
    );
  });

  bot.action('my_dm_photos', async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes('query is too old')) {
        console.error('Ошибка answerCbQuery:', error.message);
      }
    }
    
    const userId = ctx.from?.id;
    if (!userId) return;

    const all_dm_photos = await Database.getUserDMPhotos(userId);
    
    if (all_dm_photos.length === 0) {
      await ctx.editMessageText(
        '🎅 У вас пока нет фото Д.Мороза',
        Markup.inlineKeyboard([
          [Markup.button.callback('Назад', 'profile')]
        ])
      );
      return;
    }

    for (const dm_photo of all_dm_photos) {
      try {
        await ctx.telegram.sendPhoto(userId, dm_photo.file_id);
      } catch (error) {
        console.error('Ошибка отправки фото Деда Мороза:', error);
        await ctx.telegram.sendMessage(userId, `❌ Фото Деда Мороза недоступно (ID: ${dm_photo.id})`);
      }
    }

    await ctx.telegram.sendMessage(
      userId,
      `🎅 Ваши фото Деда Мороза (${all_dm_photos.length}):`,
      Markup.inlineKeyboard([
        [Markup.button.callback('Назад', 'profile')]
      ])
    );
  });

  bot.action('my_dm_videos', async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes('query is too old')) {
        console.error('Ошибка answerCbQuery:', error.message);
      }
    }
    
    const userId = ctx.from?.id;
    if (!userId) return;

    const all_dm_videos = await Database.getUserDMVideos(userId);
    
    if (all_dm_videos.length === 0) {
      await ctx.editMessageText(
        '🎅 У вас пока нет видео Д.Мороза',
        Markup.inlineKeyboard([
          [Markup.button.callback('Назад', 'profile')]
        ])
      );
      return;
    }

    for (const dm_video of all_dm_videos) {
      try {
        await ctx.telegram.sendVideo(userId, dm_video.file_id);
      } catch (error) {
        console.error('Ошибка отправки видео Деда Мороза:', error);
        await ctx.telegram.sendMessage(userId, `❌ Видео Деда Мороза недоступно (ID: ${dm_video.id})`);
      }
    }

    await ctx.telegram.sendMessage(
      userId,
      `🎅 Ваши видео Деда Мороза (${all_dm_videos.length}):`,
      Markup.inlineKeyboard([
        [Markup.button.callback('Назад', 'profile')]
      ])
    );
  });

  bot.action('my_colorize', async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes('query is too old')) {
        console.error('Ошибка answerCbQuery:', error.message);
      }
    }
    
    const userId = ctx.from?.id;
    if (!userId) return;

    const all_colorized = await Database.getUserColorize(userId);
    
    if (all_colorized.length === 0) {
      await ctx.editMessageText(
        '📸 У вас пока нет цветных фото',
        Markup.inlineKeyboard([
          [Markup.button.callback('Назад', 'profile')]
        ])
      );
      return;
    }

    for (const colorized of all_colorized) {
      try {
        await ctx.telegram.sendPhoto(userId, colorized.file_id);
      } catch (error) {
        console.error('Ошибка отправки окрашенного фото:', error);
        await ctx.telegram.sendMessage(userId, `❌ Фото с добавлением цвета недоступно (ID: ${colorized.id})`);
      }
    }

    await ctx.telegram.sendMessage(
      userId,
      `📸 Ваши окрашивания (${all_colorized.length}):`,
      Markup.inlineKeyboard([
        [Markup.button.callback('Назад', 'profile')]
      ])
    );
  });

  bot.action('documents', async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes('query is too old')) {
        console.error('Ошибка answerCbQuery:', error.message);
      }
    }

    const documentsMessage = `
Используя данный бот, вы автоматически соглашаетесь с условиями следующих документов ⤵️

📌 <a href="https://docs.google.com/document/d/1xhYtLwGktBxqbVTGalJ0PnlKdRWxafZn/edit?usp=sharing&ouid=100123280935677219338&rtpof=true&sd=true">Политика конфиденциальности</a>
📌 <a href="https://docs.google.com/document/d/1T9YFGmVCMaOUYKhWBu7V8hjL-OV-WpFL/edit?usp=sharing&ouid=100123280935677219338&rtpof=true&sd=true">Согласие на обработку персональных данных</a>
📌 <a href="https://docs.google.com/document/d/1lBw4BXuPKiFjXrRxeXnFBhJm_TTbsWd8iXoPO7Fw5YQ/edit?usp=sharing">Договор Оферты</a>
    `.trim();

    await ctx.editMessageText(
      documentsMessage,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('Назад', 'profile')]
        ])
      }
    );
  });
}
