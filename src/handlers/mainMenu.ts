import { Telegraf, Markup } from 'telegraf';
import { BotContext, UserState } from '../types';
import { Database } from '../database';
import { sendTGTrackUserStart } from './index';

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
        ctx.from?.last_name
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
        const mainMenuMessage = `
Наш бот умеет <b><i>оживлять фото</i></b> 📸✨ и создавать <b><i>крутые треки</i></b> 🎵🔥
Вы можете творить сами или доверить работу нам 🤝
В каждом разделе вас ждут простые и понятные инструкции 📘, чтобы ваш контент получился на ура!
        `.trim();

        await ctx.reply(
          mainMenuMessage,
          {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
              [Markup.button.callback('Написать в поддержку', 'support')],
              [
                Markup.button.callback('📸 Оживить фото', 'photo_animation'),
                Markup.button.callback('🎶 Создать музыку', 'music_creation')
              ],
              [Markup.button.callback('Личный кабинет', 'profile')]
            ])
          }
        );
      } else {
        const welcomeMessage = `
Чтобы мы могли дальше работать, закон требует подтверждения с вашей стороны следующего ⤵️

📌 <a href="https://docs.google.com/document/d/1xhYtLwGktBxqbVTGalJ0PnlKdRWxafZn/edit?usp=sharing&ouid=100123280935677219338&rtpof=true&sd=true">Политика конфиденциальности</a>

📌 <a href="https://docs.google.com/document/d/1T9YFGmVCMaOUYKhWBu7V8hjL-OV-WpFL/edit?usp=sharing&ouid=100123280935677219338&rtpof=true&sd=true">Согласие на обработку персональных данных</a>
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
    
    const mainMenuMessage = `
Наш бот умеет <b><i>оживлять фото</i></b> 📸✨ и создавать <b><i>крутые треки</i></b> 🎵🔥
Вы можете творить сами или доверить работу нам 🤝
В каждом разделе вас ждут простые и понятные инструкции 📘, чтобы ваш контент получился на ура!
    `.trim();

    await ctx.editMessageText(
      mainMenuMessage,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('Написать в поддержку', 'support')],
          [
            Markup.button.callback('📸 Оживить фото', 'photo_animation'),
            Markup.button.callback('🎶 Создать музыку', 'music_creation')
          ],
          [Markup.button.callback('Личный кабинет', 'profile')]
        ])
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
    
    const mainMenuMessage = `
Наш бот умеет <b><i>оживлять фото</i></b> 📸✨ и создавать <b><i>крутые треки</i></b> 🎵🔥
Вы можете творить сами или доверить работу нам 🤝
В каждом разделе вас ждут простые и понятные инструкции 📘, чтобы ваш контент получился на ура!
    `.trim();

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('Написать в поддержку', 'support')],
      [
        Markup.button.callback('📸 Оживить фото', 'photo_animation'),
        Markup.button.callback('🎶 Создать музыку', 'music_creation')
      ],
      [Markup.button.callback('Личный кабинет', 'profile')]
    ]);

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
💬 Поддержка

По всем вопросам обращайтесь:
https://t.me/obrabotych_support
    `.trim();
    
    await ctx.editMessageText(
      supportMessage,
      Markup.inlineKeyboard([
        [Markup.button.callback('Главное меню', 'main_menu')]
      ])
    );
  });

  // Команды для меню
  bot.command('menu', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;
    
    const mainMenuMessage = `
Наш бот умеет <b><i>оживлять фото</i></b> 📸✨ и создавать <b><i>крутые треки</i></b> 🎵🔥
Вы можете творить сами или доверить работу нам 🤝
В каждом разделе вас ждут простые и понятные инструкции 📘, чтобы ваш контент получился на ура!
    `.trim();

    await ctx.reply(
      mainMenuMessage,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('Написать в поддержку', 'support')],
          [
            Markup.button.callback('📸 Оживить фото', 'photo_animation'),
            Markup.button.callback('🎶 Создать музыку', 'music_creation')
          ],
          [Markup.button.callback('Личный кабинет', 'profile')]
        ])
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
        [
          Markup.button.callback('150₽', 'refill_150'),
          Markup.button.callback('300₽', 'refill_300')
        ],
        [
          Markup.button.callback('800₽', 'refill_800'),
          Markup.button.callback('1600₽', 'refill_1600')
        ],
        [Markup.button.callback('Главное меню', 'main_menu')]
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
}
