import { Telegraf, Markup } from 'telegraf';
import { BotContext, UserState } from '../types';
import { Database } from '../database';

export function registerMainMenuHandlers(bot: Telegraf<BotContext>, userStates: Map<number, UserState>) {
  bot.command('start', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    try {
      await Database.getOrCreateUser(
        userId,
        ctx.from?.username,
        ctx.from?.first_name,
        ctx.from?.last_name
      );

      const policyAccepted = await Database.hasPolicyAccepted(userId);

      if (policyAccepted) {
        const mainMenuMessage = `
Наш бот умеет оживлять фото и создавать крутые треки! Вы можете это делать самостоятельно или обратиться к нам для реализации. В каждом разделе будет инструкция по правильному созданию контента!
        `.trim();

        await ctx.reply(
          mainMenuMessage,
          Markup.inlineKeyboard([
            [Markup.button.callback('Написать в поддержку', 'support')],
            [
              Markup.button.callback('📸 Оживить фото', 'photo_animation'),
              Markup.button.callback('🎶 Создать музыку', 'music_creation')
            ],
            [Markup.button.callback('Личный кабинет', 'profile')]
          ])
        );
      } else {
        const welcomeMessage = `
Чтобы мы могли дальше работать, закон требует подтверждения с вашей стороны следующего ⤵️

📌 Политика конфиденциальности
📌 Согласие на обработку персональных данных
        `.trim();

        await ctx.reply(
          welcomeMessage,
          Markup.inlineKeyboard([
            [Markup.button.callback('✅ Принимаю', 'accept_policy')]
          ])
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
Наш бот умеет оживлять фото и создавать крутые треки! Вы можете это делать самостоятельно или обратиться к нам для реализации. В каждом разделе будет инструкция по правильному созданию контента!
    `.trim();

    await ctx.editMessageText(
      mainMenuMessage,
      Markup.inlineKeyboard([
        [Markup.button.callback('Написать в поддержку', 'support')],
        [
          Markup.button.callback('📸 Оживить фото', 'photo_animation'),
          Markup.button.callback('🎶 Создать музыку', 'music_creation')
        ],
        [Markup.button.callback('Личный кабинет', 'profile')]
      ])
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
Наш бот умеет оживлять фото и создавать крутые треки! Вы можете это делать самостоятельно или обратиться к нам для реализации. В каждом разделе будет инструкция по правильному созданию контента!
    `.trim();

    await ctx.telegram.sendMessage(
      userId,
      mainMenuMessage,
      Markup.inlineKeyboard([
        [Markup.button.callback('Написать в поддержку', 'support')],
        [
          Markup.button.callback('📸 Оживить фото', 'photo_animation'),
          Markup.button.callback('🎶 Создать музыку', 'music_creation')
        ],
        [Markup.button.callback('Личный кабинет', 'profile')]
      ])
    );
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
https://t.me/khodunow
    `.trim();
    
    await ctx.editMessageText(
      supportMessage,
      Markup.inlineKeyboard([
        [Markup.button.callback('Главное меню', 'main_menu')]
      ])
    );
  });
}