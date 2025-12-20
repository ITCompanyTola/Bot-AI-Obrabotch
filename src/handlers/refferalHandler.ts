import { Telegraf } from "telegraf";
import { BotContext, UserState } from "../types";
import { logToFile } from "../bot";
import { Database } from "../database";
import QRCode from 'qrcode';

const {v4: uuidv4} = require('uuid');

async function createQRBuffer(url: string) {
  try {
    const buffer = await QRCode.toBuffer(url, {
      version: 5,
      width: 400,
      color: {
        dark: '#2b9dbaff',
        light: '#fafbfbff'
      }
    });
    return buffer;
  } catch (error) {
    console.error('Error creating QR code buffer:', error);
    return null;
  }
}

export function registerRefferal(bot: Telegraf<BotContext>, userStates: Map<number, UserState>) {
  bot.action('create_refferal', async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes('query is too old')) {
        console.error('Ошибка answerCbQuery:', error.message);
      }
    }
    
    const userId = ctx.from?.id;
    if (!userId) return;
    
    const isRefferalCreated = await Database.isRefferalCreated(userId);

    if (isRefferalCreated) {
      const refferalLink = `https://t.me/Photograffunbot?start=${await Database.getRefferalLink(userId)}`.trim();
      const qrBuffer = await createQRBuffer(refferalLink);
      if (qrBuffer === null) {
        await ctx.reply('Произошла ошибка при создании QR-кода', {
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Главное меню', callback_data: 'main_menu' }]
            ]
          } 
        });
        return;
      }
      await ctx.telegram.sendPhoto(userId, { source: qrBuffer}, {
        caption: `
Отправьте другу ссылку:

${refferalLink}

Когда ваш друг <b>воспользуется</b> нашим ботом, вы получите <b>100₽ на баланс</b> в Обработыч 💖`.trim(),
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Порекомендовать', switch_inline_query: `Крутой ИИ-бот для разных генераций 👇\n${refferalLink}` }],
            [{ text: 'Главное меню', callback_data: 'main_menu' }]
          ]
        }
      });
    } else {
      logToFile(`📝 create_refferal вызван: userId=${userId}`);


      const refferalKey = uuidv4();
      const refferalLink = `https://t.me/Photograffunbot?start=${refferalKey}`;
      const qrBuffer = await createQRBuffer(refferalLink);
      if (qrBuffer === null) {
        await ctx.reply('Произошла ошибка при создании QR-кода', {
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Главное меню', callback_data: 'main_menu' }]
            ]
          } 
        });
        return;
      }
      await ctx.telegram.sendPhoto(userId, { source: qrBuffer}, {
        caption: `
Отправьте другу ссылку:

${refferalLink}

Когда ваш друг <b>воспользуется</b> нашим ботом, вы получите <b>100₽ на баланс</b> в Обработыч 💖`.trim(),
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Порекомендовать', switch_inline_query: `Крутой ИИ-бот для разных генераций 👇\n${refferalLink}` }],
            [{ text: 'Главное меню', callback_data: 'main_menu' }]
          ]
        }
      })

      await Database.createRefferal(userId, refferalKey);
    }
  });
}