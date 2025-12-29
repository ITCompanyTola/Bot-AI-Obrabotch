import { Telegraf, Markup } from 'telegraf';
import { BotContext, UserState } from '../types';
import { Database } from '../database';
import { sendTGTrackUserStart } from './index';
import { MAIN_MENU_MESSAGE, mainMenuKeyboard } from '../constants';

export function registerMainMenuHandlers(bot: Telegraf<BotContext>, userStates: Map<number, UserState>) {
  bot.command('start', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    try {
      const startPayload = ctx.message?.text?.split(' ')[1];
      
      const { user, isNew } = await Database.getOrCreateUser(
        userId,
        ctx.from?.username,
        ctx.from?.first_name,
        ctx.from?.last_name,
        startPayload
      );

      if (isNew) {
        await sendTGTrackUserStart(
          userId,
          ctx.from?.first_name,
          ctx.from?.last_name,
          ctx.from?.username,
          startPayload
        );
      }

      const policyAccepted = await Database.hasPolicyAccepted(userId);

      if (policyAccepted) {
        const mainMenuMessage = MAIN_MENU_MESSAGE;

        await ctx.reply(
          mainMenuMessage,
          {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard(mainMenuKeyboard)
          }
        );
      } else {
        const welcomeMessage = `
Добро пожаловать! Перед началом работы нужно принять три важных документа ⤵️

📌 <a href="https://docs.google.com/document/d/1xhYtLwGktBxqbVTGalJ0PnlKdRWxafZn/edit?usp=sharing&ouid=100123280935677219338&rtpof=true&sd=true">Политика конфиденциальности</a>

📌 <a href="https://docs.google.com/document/d/1T9YFGmVCMaOUYKhWBu7V8hjL-OV-WpFL/edit?usp=sharing&ouid=100123280935677219338&rtpof=true&sd=true">Согласие на обработку персональных данных</a>

📌 <a href="https://docs.google.com/document/d/1lBw4BXuPKiFjXrRxeXnFBhJm_TTbsWd8iXoPO7Fw5YQ/edit?usp=sharing">Договор оферты</a>
        `.trim();

        await ctx.reply(
          welcomeMessage,
          {
            parse_mode: 'HTML',
            link_preview_options: { is_disabled: true },
            ...Markup.inlineKeyboard([
              [Markup.button.callback('✅ Принимаю', 'accept_policy')]
            ])
          }
        );
      }
    } catch (error) {
      console.error('Ошибка в /start:', error);
      await ctx.reply('❌ Произошла ошибка. Попробуйте позже.');
    }
  });

  bot.action('accept_policy', async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes('query is too old')) {
        console.error('Ошибка answerCbQuery:', error.message);
      }
    }
    
    const userId = ctx.from?.id;
    if (!userId) return;

    await Database.setPolicyAccepted(userId);
    
    const mainMenuMessage = MAIN_MENU_MESSAGE;

    await ctx.editMessageText(
      mainMenuMessage,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard(mainMenuKeyboard)
      }
    );
  });

  bot.action('decline_policy', async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes('query is too old')) {
        console.error('Ошибка answerCbQuery:', error.message);
      }
    }
    await ctx.editMessageText('❌ Вы отклонили согласие на обработку данных.\n\nБез этого бот не может работать.\n\nДля повторной попытки используйте /start');
  });

  bot.action('main_menu', async (ctx) => {
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
    if (userState) userStates.delete(userId);
    
    const mainMenuMessage = MAIN_MENU_MESSAGE;

    const keyboard = Markup.inlineKeyboard(mainMenuKeyboard);

    // Проверяем, является ли сообщение текстовым
    if (ctx.callbackQuery && 'message' in ctx.callbackQuery && ctx.callbackQuery.message) {
      const message = ctx.callbackQuery.message;
      if ('text' in message) {
        // Если это текстовое сообщение - редактируем
        await ctx.editMessageText(mainMenuMessage, { parse_mode: 'HTML', ...keyboard });
      } else {
        // Если это медиа (фото/видео) - отправляем новое
        await ctx.telegram.sendMessage(userId, mainMenuMessage, { parse_mode: 'HTML', ...keyboard });
      }
    }
  });

  bot.action('support', async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes('query is too old')) {
        console.error('Ошибка answerCbQuery:', error.message);
      }
    }
    
    const supportMessage = `
💬 <b>Поддержка</b>

По всем вопросам обращайтесь:
https://t.me/obrabotych_support
    `.trim();
    
    await ctx.editMessageText(supportMessage, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        Markup.button.callback('Главное меню', 'main_menu')
      ])
    });
      
  });

  // Команды для меню
  bot.command('menu', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const userState = userStates.get(userId);
    if (userState) userStates.delete(userId);
    
    const mainMenuMessage = MAIN_MENU_MESSAGE;

    await ctx.reply(
      mainMenuMessage,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard(mainMenuKeyboard)
      }
    );
  });

  bot.command('pay', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const refillMessage = `Выберете сумму для пополнения баланса ⤵️`;

    await ctx.reply(
      refillMessage,
      Markup.inlineKeyboard([
        [Markup.button.callback('150₽', 'refill_150'), Markup.button.callback('300₽', 'refill_300'), Markup.button.callback('800₽', 'refill_800'), Markup.button.callback('1600₽', 'refill_1600')],
        [Markup.button.callback('Главное меню', 'main_menu')],
      ])
    );
  });

  bot.command('privacy', async (ctx) => {
    await ctx.reply(
      '📌 Политика конфиденциальности:\nhttps://docs.google.com/document/d/1xhYtLwGktBxqbVTGalJ0PnlKdRWxafZn/edit?usp=sharing&ouid=100123280935677219338&rtpof=true&sd=true'
    );
  });

  bot.command('agreement', async (ctx) => {
    await ctx.reply(
      '📌 Пользовательское соглашение:\nhttps://docs.google.com/document/d/1T9YFGmVCMaOUYKhWBu7V8hjL-OV-WpFL/edit?usp=sharing&ouid=100123280935677219338&rtpof=true&sd=true'
    );
  });

  bot.command('help', async (ctx) => {
    const supportMessage = `
💬 <b>Поддержка</b>

По всем вопросам обращайтесь:
https://t.me/obrabotych_support
    `.trim();
    
    await ctx.reply(supportMessage, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        Markup.button.callback('Главное меню', 'main_menu')
      ])
    });
      
  });

  bot.command('stats_all', async (ctx) => {
    try {
      const userId = ctx.from?.id;
      if (!userId) return;

      const isAdmin = await Database.isAdmin(userId);
      if (!isAdmin) {
        await ctx.reply('❌ У вас нет прав для выполнения этой команды');
        return;
      }

      const stats = await Database.getGlobalStats();
      const today = new Date();
      const todayStr = today.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
      
      const statsMessage = `
📊 <b>Статистика бота за все время</b>

👥 Количество пользователей: <b>${stats.all.usersCount}</b>
💳 Количество успешных пополнений: <b>${stats.all.successfulPayments}</b>
💰 Сумма успешных пополнений: <b>${stats.all.totalPaymentsAmount.toFixed(2)}₽</b>
📸 Количество генераций фото: <b>${stats.all.photoGenerations}</b>
🎵 Количество генераций музыки: <b>${stats.all.musicGenerations}</b>
🏞 Количество генераций реставрации: <b>${stats.all.restorationGenerations}</b>
🎨 Количество генерации ЧБ: <b>${stats.all.colorizeGenerations}</b>
🎅 Количество генераций Д.Мороза: <b>${stats.all.dmVideoGenerations}</b>
🏞 Количество генераций открыток из текста: <b>${stats.all.postcardTextGenerations}</b>
🏞 Количество генераций открыток из фото: <b>${stats.all.postcardPhotoGenerations}</b>


<b>За последние 7 дней</b>
👥 Количество пользователей: <b>${stats.last7Days.usersCount}</b>
💳 Количество успешных пополнений: <b>${stats.last7Days.successfulPayments}</b>
💰 Сумма успешных пополнений: <b>${stats.last7Days.totalPaymentsAmount.toFixed(2)}₽</b>
📸 Количество генераций фото: <b>${stats.last7Days.photoGenerations}</b>
🎵 Количество генераций музыки: <b>${stats.last7Days.musicGenerations}</b>
🏞 Количество генераций реставрации: <b>${stats.last7Days.restorationGenerations}</b>
🎨 Количество генерации ЧБ: <b>${stats.last7Days.colorizeGenerations}</b>
🎅 Количество генераций Д.Мороза: <b>${stats.last7Days.dmVideoGenerations}</b>
🏞 Количество генераций открыток из текста: <b>${stats.last7Days.postcardTextGenerations}</b>
🏞 Количество генераций открыток из фото: <b>${stats.last7Days.postcardPhotoGenerations}</b>

<b>За сегодня ${todayStr}</b>
👥 Количество пользователей: <b>${stats.today.usersCount}</b>
💳 Количество успешных пополнений: <b>${stats.today.successfulPayments}</b>
💰 Сумма успешных пополнений: <b>${stats.today.totalPaymentsAmount.toFixed(2)}₽</b>
📸 Количество генераций фото: <b>${stats.today.photoGenerations}</b>
🎵 Количество генераций музыки: <b>${stats.today.musicGenerations}</b>
🏞 Количество генераций реставрации: <b>${stats.today.restorationGenerations}</b>
🎨 Количество генерации ЧБ: <b>${stats.today.colorizeGenerations}</b>
🎅 Количество генераций Д.Мороза: <b>${stats.today.dmVideoGenerations}</b>
🏞 Количество генераций открыток из текста: <b>${stats.today.postcardTextGenerations}</b>
🏞 Количество генераций открыток из фото: <b>${stats.today.postcardPhotoGenerations}</b>
      `.trim();
      
      await ctx.reply(statsMessage, { parse_mode: 'HTML' });
    } catch (error) {
      console.error('Ошибка получения статистики:', error);
      await ctx.reply('❌ Ошибка при получении статистики');
    }
  });

  bot.command('add_source', async (ctx) => {
    try {
      const userId = ctx.from?.id;
      if (!userId) return;

      const isAdmin = await Database.isAdmin(userId);
      if (!isAdmin) {
        await ctx.reply('❌ У вас нет прав для выполнения этой команды');
        return;
      }

      const args = ctx.message?.text?.split(' ').slice(1);
      if (!args || args.length < 2) {
        await ctx.reply(
          '❌ Неверный формат команды\n\n' +
          'Используйте:\n' +
          '/add_source <название> <ключевая_подстрока>\n\n' +
          'Пример:\n' +
          '/add_source telegramAds tgTrack-PJ43a51379bd0a7a9'
        );
        return;
      }

      const [sourceName, keySubstring] = args;

      try {
        await Database.createReferralSource(sourceName, keySubstring);
        await ctx.reply(
          `✅ Источник успешно создан!\n\n` +
          `📊 Название: <b>${sourceName}</b>\n` +
          `🔑 Ключ: https://t.me/Obrabotych_bot?start=${keySubstring}\n\n` +
          `Для просмотра статистики используйте: /stats_${sourceName}`,
          { parse_mode: 'HTML' }
        );
      } catch (error: any) {
        await ctx.reply(`❌ Ошибка создания источника: ${error.message}`);
      }
    } catch (error) {
      console.error('Ошибка добавления источника:', error);
      await ctx.reply('❌ Произошла ошибка при добавлении источника');
    }
  });

  bot.command('list_sources', async (ctx) => {
    try {
      const userId = ctx.from?.id;
      if (!userId) return;

      const isAdmin = await Database.isAdmin(userId);
      if (!isAdmin) {
        await ctx.reply('❌ У вас нет прав для выполнения этой команды');
        return;
      }

      const sources = await Database.getAllReferralSources();
      
      if (sources.length === 0) {
        await ctx.reply('📋 Источников пока нет');
        return;
      }

      let message = '📋 <b>Список всех источников:</b>\n\n';
      for (const source of sources) {
        message += `📌 <b>${source.source_name}</b>\n`;
        message += `🔑 https://t.me/Obrabotych_bot?start=${source.key_substring}\n`;
        message += `📊 Статистика: /stats_${source.source_name}\n\n`;
      }

      await ctx.reply(message, { parse_mode: 'HTML' });
    } catch (error) {
      console.error('Ошибка получения списка источников:', error);
      await ctx.reply('❌ Ошибка при получении списка источников');
    }
  });

  bot.command('rename_source', async (ctx) => {
    try {
      const userId = ctx.from?.id;
      if (!userId) return;

      const isAdmin = await Database.isAdmin(userId);
      if (!isAdmin) {
        await ctx.reply('❌ У вас нет прав для выполнения этой команды');
        return;
      }

      const args = ctx.message?.text?.split(' ').slice(1);
      if (!args || args.length < 2) {
        await ctx.reply(
          '❌ Неверный формат команды\n\n' +
          'Используйте:\n' +
          '/rename_source <старое_название> <новое_название>\n\n' +
          'Пример:\n' +
          '/rename_source неизвестный_источник_1 telegramAds'
        );
        return;
      }

      const [oldName, newName] = args;

      try {
        await Database.renameReferralSource(oldName, newName);
        await ctx.reply(
          `✅ Источник успешно переименован!\n\n` +
          `Старое название: <b>${oldName}</b>\n` +
          `Новое название: <b>${newName}</b>\n\n` +
          `Статистика теперь доступна по команде: /stats_${newName}`,
          { parse_mode: 'HTML' }
        );
      } catch (error: any) {
        await ctx.reply(`❌ Ошибка переименования источника: ${error.message}`);
      }
    } catch (error) {
      console.error('Ошибка переименования источника:', error);
      await ctx.reply('❌ Произошла ошибка при переименовании источника');
    }
  });

  bot.command('stats_pw', async (ctx) => {
    try {
      const userId = ctx.from?.id;
      if (!userId) return;

      const isAdmin = await Database.isAdmin(userId);
      if (!isAdmin) {
        await ctx.reply('❌ У вас нет прав для выполнения этой команды');
        return;
      }

      const stats = await Database.getUserEngagementStats();
      const today = new Date();
      const todayStr = today.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
      
      const statsMessage = `
📊 <b>Статистика вовлеченности пользователей</b>

<b>За все время</b>
👥 Количество повторных пополнений: <b>${stats.all.repeatPayments}</b>
💳 Количество 2-х генераций: <b>${stats.all.twoGenerations}</b>
🎨 Количество 3-х генераций: <b>${stats.all.threeGenerations}</b>
🔥 Количество 4-х генераций и более: <b>${stats.all.fourPlusGenerations}</b>

<b>За последние 7 дней</b>
👥 Количество повторных пополнений: <b>${stats.last7Days.repeatPayments}</b>
💳 Количество 2-х генераций: <b>${stats.last7Days.twoGenerations}</b>
🎨 Количество 3-х генераций: <b>${stats.last7Days.threeGenerations}</b>
🔥 Количество 4-х генераций и более: <b>${stats.last7Days.fourPlusGenerations}</b>

<b>За сегодня ${todayStr}</b>
👥 Количество повторных пополнений: <b>${stats.today.repeatPayments}</b>
💳 Количество 2-х генераций: <b>${stats.today.twoGenerations}</b>
🎨 Количество 3-х генераций: <b>${stats.today.threeGenerations}</b>
🔥 Количество 4-х генераций и более: <b>${stats.today.fourPlusGenerations}</b>
      `.trim();
      
      await ctx.reply(statsMessage, { parse_mode: 'HTML' });
    } catch (error) {
      console.error('Ошибка получения статистики вовлеченности:', error);
      await ctx.reply('❌ Ошибка при получении статистики');
    }
  });

  bot.command('team', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const isAdmin = await Database.isAdmin(userId);
    if (!isAdmin) {
      await ctx.reply('❌ У вас нет прав для выполнения этой команды');
      return;
    }

    const helpMessage = `
📖 <b>Помощь</b>
<b><i>Список команд:</i></b>

<b>Источники</b>
* <code>/add_source <i>название_источника</i></code> - Добавить источник
* <code>/rename_source <b><i>старое_название</i></b> <b><i>новое_название</i></b></code> - Переименовать источник
* /list_sources - Список всех источников
* <code>/stats_<b><i>название_источника</i></b></code> - Получить статистику по источнику

<b>Статистика</b>
* /stats_pw - Получить статистику вовлеченности пользователей
* /stats_all - Получить общую статистику бота

<b>Рассылка</b>
* /broadcast - Рассылка сообщений пользователям
* /stop_mailings - Завершить все активные рассылки

<b><i>Callback команды для кнопки:</i></b>
Оживить фото: <code>photo_animation</code>
Создать музыку: <code>music_creation</code>
Реставрация: <code>photo_restoration</code>
ЧБ: <code>photo_colorize</code>
Дед мороз: <code>ded_moroz</code>
Открытки: <code>postcard</code>
Пополнить баланс: <code>refill_balance_from_profile</code>`.trim()

    await ctx.reply(helpMessage, { parse_mode: 'HTML' });
  });

  bot.on('text', async (ctx, next) => {
    const text = ctx.message?.text;
    if (!text || !text.startsWith('/stats_')) {
      return next();
    }

    try {
      const userId = ctx.from?.id;
      if (!userId) return;

      const isAdmin = await Database.isAdmin(userId);
      if (!isAdmin) {
        return next();
      }

      const sourceName = text.substring(7);
      
      if (sourceName === 'all') {
        return next();
      }

      const source = await Database.getReferralSource(sourceName);
      if (!source) {
        await ctx.reply(`❌ Источник "${sourceName}" не найден`);
        return;
      }

      const stats = await Database.getSourceStats(source.key_substring);
      const today = new Date();
      const todayStr = today.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
      
      const statsMessage = `
📊 <b>Статистика источника "${source.source_name}"</b>

🔑 Ключ: https://t.me/Obrabotych_bot?start=${source.key_substring}

<b>За все время</b>
👥 Количество пользователей: <b>${stats.all.usersCount}</b>
💳 Количество успешных пополнений: <b>${stats.all.successfulPayments}</b>
💰 Сумма успешных пополнений: <b>${stats.all.totalPaymentsAmount.toFixed(2)}₽</b>
📸 Количество генераций фото: <b>${stats.all.photoGenerations}</b>
🎵 Количество генераций музыки: <b>${stats.all.musicGenerations}</b>
🎅 Количество генераций ДМ: <b>${stats.all.dmVideoGenerations}</b>
🎨 Количество генераций чб: <b>${stats.all.colorizeGenerations}</b>
🏞 Количество генераций рестварации: <b>${stats.all.restorationGenerations}</b>
🏞 Количество генераций открыток из текста: <b>${stats.all.postcardTextGenerations}</b>
🏞 Количество генераций открыток из фото: <b>${stats.all.postcardPhotoGenerations}</b>

<b>За последние 7 дней</b>
👥 Количество пользователей: <b>${stats.last7Days.usersCount}</b>
💳 Количество успешных пополнений: <b>${stats.last7Days.successfulPayments}</b>
💰 Сумма успешных пополнений: <b>${stats.last7Days.totalPaymentsAmount.toFixed(2)}₽</b>
📸 Количество генераций фото: <b>${stats.last7Days.photoGenerations}</b>
🎵 Количество генераций музыки: <b>${stats.last7Days.musicGenerations}</b>
🎅 Количество генераций ДМ: <b>${stats.last7Days.dmVideoGenerations}</b>
🎨 Количество генераций чб: <b>${stats.last7Days.colorizeGenerations}</b>
🏞 Количество генераций рестварации: <b>${stats.last7Days.restorationGenerations}</b>
🏞 Количество генераций открыток из текста: <b>${stats.last7Days.postcardTextGenerations}</b>
🏞 Количество генераций открыток из фото: <b>${stats.last7Days.postcardPhotoGenerations}</b>

<b>За сегодня ${todayStr}</b>
👥 Количество пользователей: <b>${stats.today.usersCount}</b>
💳 Количество успешных пополнений: <b>${stats.today.successfulPayments}</b>
💰 Сумма успешных пополнений: <b>${stats.today.totalPaymentsAmount.toFixed(2)}₽</b>
📸 Количество генераций фото: <b>${stats.today.photoGenerations}</b>
🎵 Количество генераций музыки: <b>${stats.today.musicGenerations}</b>
🎅 Количество генераций ДМ: <b>${stats.today.dmVideoGenerations}</b>
🎨 Количество генераций чб: <b>${stats.today.colorizeGenerations}</b>
🏞 Количество генераций рестварации: <b>${stats.today.restorationGenerations}</b>
🏞 Количество генераций открыток из текста: <b>${stats.today.postcardTextGenerations}</b>
🏞 Количество генераций открыток из фото: <b>${stats.today.postcardPhotoGenerations}</b>
      `.trim();
      
      await ctx.reply(statsMessage, { parse_mode: 'HTML' });
    } catch (error) {
      console.error('Ошибка получения статистики источника:', error);
      await ctx.reply('❌ Ошибка при получении статистики');
    }
  });

  bot.command('lk', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const balance = await Database.getUserBalance(userId);

    const profileMessage = `
🌟 <b>Ваш личный кабинет</b>

Здесь собрано всё, что связано с вашим аккаунтом:

📁 <b>Мои файлы</b>
• Ваши сгенерированные файлы 🔥

👉 <b>Финансы:</b>
• Пополнить баланс 🔄

📄 <b>Документы</b>
• Политика конфиденциальности; согласие на ОПД; договор оферты ☝🏻

<blockquote>💰 Ваш баланс: ${balance.toFixed(2)}₽</blockquote>
    `.trim();

    await ctx.reply(
      profileMessage,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('💎 Получить 100₽', 'create_refferal')],
          [
            Markup.button.callback('Мои реставрации', 'my_restorations'),
            Markup.button.callback('Мои цветные фото', 'my_colorize')
          ],
          [
            Markup.button.callback('Мои видео', 'my_photos'),
            Markup.button.callback('Мои треки', 'my_tracks')
          ],
          [
            Markup.button.callback('Мои фото Д.Мороза', 'my_dm_photos'),
            Markup.button.callback('Мои видео Д.Мороза', 'my_dm_videos')
          ],
          [Markup.button.callback('Мои открытки', 'my_postcards')],
          [Markup.button.callback('💳 Пополнить баланс', 'refill_balance_from_profile')],
          [Markup.button.callback('Документы', 'documents')],
          [Markup.button.callback('Главное меню', 'main_menu')]
        ])
      }
    );
  });

  bot.command('stop_mailings', async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes('query is too old')) {
        console.error('Ошибка answerCbQuery:', error.message);
      }
    }

    const userId = ctx.from?.id;
    if (!userId) return;

    const isAdmin = await Database.isAdmin(userId);
    if (!isAdmin) return;

    try {
      await Database.stopAllMailings();
    } catch (error: any) {
      console.log('Ошибка:', error);
      await ctx.reply(`Ошибка: ${error.message}`);
    }
    
    await ctx.reply('Рассылки остановлены');
  });
}

