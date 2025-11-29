import { Telegraf, Markup } from 'telegraf';
import { BotContext, UserState } from '../types';
import { Database } from '../database';
import { PRICES } from '../constants';
import { processVideoGeneration } from '../services/klingService';
import { config } from '../config';

const VIDEO_FILE_ID = config.videoFileId;
const PHOTO_FILE_ID = config.photoFileId;

export function registerPhotoAnimationHandlers(bot: Telegraf<BotContext>, userStates: Map<number, UserState>) {
  bot.action('photo_animation', async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes('query is too old')) {
        console.error('ÐžÑˆÐ¸Ð±ÐºÐ° answerCbQuery:', error.message);
      }
    }
    
    const userId = ctx.from?.id;
    if (!userId) return;

    const balance = await Database.getUserBalance(userId);
    
    const photoAnimationMessage = `
ðŸ“¸ <b>ÐÐ°Ñˆ Ð±Ð¾Ñ‚ ÑƒÐ¼ÐµÐµÑ‚ Ð¾Ð¶Ð¸Ð²Ð»ÑÑ‚ÑŒ Ð¸ Ñ€ÐµÑÑ‚Ð°Ð²Ñ€Ð¸Ñ€Ð¾Ð²Ð°Ñ‚ÑŒ Ñ„Ð¾Ñ‚Ð¾!</b>

Ð’Ð¾Ñ‚ ÐºÐ°Ðº ÑÐ¾Ð·Ð´Ð°Ñ‚ÑŒ ÑÐ²Ð¾Ñ‘ Ð°Ð½Ð¸Ð¼Ð¸Ñ€Ð¾Ð²Ð°Ð½Ð½Ð¾Ðµ Ñ„Ð¾Ñ‚Ð¾:

1ï¸âƒ£ <b><i>ÐžÑ‚Ð¿Ñ€Ð°Ð²ÑŒÑ‚Ðµ Ð¾Ð´Ð½Ñƒ Ñ„Ð¾Ñ‚Ð¾Ð³Ñ€Ð°Ñ„Ð¸ÑŽ* Ð² Ð±Ð¾Ñ‚.</i></b>
2ï¸âƒ£ <b><i>ÐžÐ¿Ð¸ÑˆÐ¸Ñ‚Ðµ</i></b>, Ñ‡Ñ‚Ð¾ Ð¸Ð¼ÐµÐ½Ð½Ð¾ Ð´Ð¾Ð»Ð¶Ð½Ð¾ Ð¿Ñ€Ð¾Ð¸Ð·Ð¾Ð¹Ñ‚Ð¸ Ð½Ð° Ð¸Ð·Ð¾Ð±Ñ€Ð°Ð¶ÐµÐ½Ð¸Ð¸ â€” Ð´Ð²Ð¸Ð¶ÐµÐ½Ð¸Ðµ, ÑÐ¼Ð¾Ñ†Ð¸Ð¸, Ð´ÐµÑ‚Ð°Ð»Ð¸, Ð»ÑŽÐ±Ñ‹Ðµ Ð¿Ð¾Ð¶ÐµÐ»Ð°Ð½Ð¸Ñ âœ¨
3ï¸âƒ£ <b><i>ÐÐµÐ¼Ð½Ð¾Ð³Ð¾ Ð¿Ð¾Ð´Ð¾Ð¶Ð´Ð¸Ñ‚Ðµ</i></b> â€” Ð¿Ñ€Ð¸Ð¼ÐµÑ€Ð½Ð¾ Ñ‡ÐµÑ€ÐµÐ· 3 Ð¼Ð¸Ð½ÑƒÑ‚Ñ‹ Ð±Ð¾Ñ‚ Ð¾Ñ‚Ð¿Ñ€Ð°Ð²Ð¸Ñ‚ Ð²Ð°Ð¼ Ð³Ð¾Ñ‚Ð¾Ð²Ð¾Ðµ Ð²Ð¸Ð´ÐµÐ¾ ðŸŽ¬âš¡ï¸

ðŸŽ <b>Ð¥Ð¾Ñ‚Ð¸Ñ‚Ðµ Ð²Ð¸Ð´ÐµÐ¾ "Ð¿Ð¾Ð´ ÐºÐ»ÑŽÑ‡"?</b>
ÐÐ°Ð¶Ð¼Ð¸Ñ‚Ðµ ÐºÐ½Ð¾Ð¿ÐºÑƒ <b><i>Â«Ð—Ð°ÐºÐ°Ð·Ð°Ñ‚ÑŒ Ð²Ð¸Ð´ÐµÐ¾ Ð¿Ð¾Ð´ ÐºÐ»ÑŽÑ‡Â»</i></b>, Ð¸ Ð¼Ñ‹ ÑÐ¾Ð·Ð´Ð°Ð´Ð¸Ð¼ ÐµÐ³Ð¾ Ð¿Ð¾Ð»Ð½Ð¾ÑÑ‚ÑŒÑŽ Ð´Ð»Ñ Ð²Ð°Ñ!

â—ï¸* - <b>Ð±Ð¾Ñ‚ Ð¾Ð¶Ð¸Ð²Ð»ÑÐµÑ‚ Ñ‚Ð¾Ð»ÑŒÐºÐ¾ Ð¾Ð´Ð½Ð¾ Ñ„Ð¾Ñ‚Ð¾ Ð·Ð° Ñ€Ð°Ð·</b>â˜ðŸ»

<blockquote>ðŸ’° Ð’Ð°Ñˆ Ð±Ð°Ð»Ð°Ð½Ñ: ${balance.toFixed(2)} â‚½
ðŸ“¹ ÐžÐ¶Ð¸Ð²Ð»ÐµÐ½Ð¸Ðµ 1 Ñ„Ð¾Ñ‚Ð¾ = ${PRICES.PHOTO_ANIMATION}â‚½</blockquote>
    `.trim();
    
    // ÐŸÑ€Ð¾Ð²ÐµÑ€ÑÐµÐ¼, ÐµÑÑ‚ÑŒ Ð»Ð¸ VIDEO_FILE_ID
    if (VIDEO_FILE_ID && VIDEO_FILE_ID.trim() !== '') {
      try {
        await ctx.telegram.sendVideo(userId, VIDEO_FILE_ID, {
          caption: photoAnimationMessage,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: 'ðŸ“¸ ÐžÐ¶Ð¸Ð²Ð¸Ñ‚ÑŒ Ñ„Ð¾Ñ‚Ð¾', callback_data: 'animate_photo' }],
              [{ text: 'Ð’Ð¸Ð´ÐµÐ¾-Ð¸Ð½ÑÑ‚Ñ€ÑƒÐºÑ†Ð¸Ñ', callback_data: 'video_instruction' }],
              [{ text: 'ðŸ’³ ÐŸÐ¾Ð¿Ð¾Ð»Ð½Ð¸Ñ‚ÑŒ Ð±Ð°Ð»Ð°Ð½Ñ', callback_data: 'refill_balance' }],
              [{ text: 'Ð—Ð°ÐºÐ°Ð·Ð°Ñ‚ÑŒ Ð²Ð¸Ð´ÐµÐ¾ Ð¿Ð¾Ð´ ÐºÐ»ÑŽÑ‡', callback_data: 'order_video' }],
              [{ text: 'Ð“Ð»Ð°Ð²Ð½Ð¾Ðµ Ð¼ÐµÐ½ÑŽ', callback_data: 'main_menu' }]
            ]
          }
        });
      } catch (error) {
        console.error('ÐžÑˆÐ¸Ð±ÐºÐ° Ð¾Ñ‚Ð¿Ñ€Ð°Ð²ÐºÐ¸ Ð²Ð¸Ð´ÐµÐ¾:', error);
        // Ð•ÑÐ»Ð¸ Ð½Ðµ ÑƒÐ´Ð°Ð»Ð¾ÑÑŒ Ð¾Ñ‚Ð¿Ñ€Ð°Ð²Ð¸Ñ‚ÑŒ Ð²Ð¸Ð´ÐµÐ¾, Ð¾Ñ‚Ð¿Ñ€Ð°Ð²Ð»ÑÐµÐ¼ Ð¿Ñ€Ð¾ÑÑ‚Ð¾ Ñ‚ÐµÐºÑÑ‚
        await ctx.telegram.sendMessage(userId, photoAnimationMessage, {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: 'ðŸ“¸ ÐžÐ¶Ð¸Ð²Ð¸Ñ‚ÑŒ Ñ„Ð¾Ñ‚Ð¾', callback_data: 'animate_photo' }],
              [{ text: 'Ð’Ð¸Ð´ÐµÐ¾-Ð¸Ð½ÑÑ‚Ñ€ÑƒÐºÑ†Ð¸Ñ', callback_data: 'video_instruction' }],
              [{ text: 'ÐŸÐ¾Ð¿Ð¾Ð»Ð½Ð¸Ñ‚ÑŒ Ð±Ð°Ð»Ð°Ð½Ñ', callback_data: 'refill_balance' }],
              [{ text: 'Ð—Ð°ÐºÐ°Ð·Ð°Ñ‚ÑŒ Ð²Ð¸Ð´ÐµÐ¾ Ð¿Ð¾Ð´ ÐºÐ»ÑŽÑ‡', callback_data: 'order_video' }],
              [{ text: 'Ð“Ð»Ð°Ð²Ð½Ð¾Ðµ Ð¼ÐµÐ½ÑŽ', callback_data: 'main_menu' }]
            ]
          }
        });
      }
    } else {
      // Ð•ÑÐ»Ð¸ VIDEO_FILE_ID Ð½Ðµ ÑƒÐºÐ°Ð·Ð°Ð½, Ð¿Ñ€Ð¾ÑÑ‚Ð¾ Ð¾Ñ‚Ð¿Ñ€Ð°Ð²Ð»ÑÐµÐ¼ Ñ‚ÐµÐºÑÑ‚
      await ctx.telegram.sendMessage(userId, photoAnimationMessage, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: 'ðŸ“¸ ÐžÐ¶Ð¸Ð²Ð¸Ñ‚ÑŒ Ñ„Ð¾Ñ‚Ð¾', callback_data: 'animate_photo' }],
            [{ text: 'Ð’Ð¸Ð´ÐµÐ¾-Ð¸Ð½ÑÑ‚Ñ€ÑƒÐºÑ†Ð¸Ñ', callback_data: 'video_instruction' }],
            [{ text: 'ÐŸÐ¾Ð¿Ð¾Ð»Ð½Ð¸Ñ‚ÑŒ Ð±Ð°Ð»Ð°Ð½Ñ', callback_data: 'refill_balance' }],
            [{ text: 'Ð—Ð°ÐºÐ°Ð·Ð°Ñ‚ÑŒ Ð²Ð¸Ð´ÐµÐ¾ Ð¿Ð¾Ð´ ÐºÐ»ÑŽÑ‡', callback_data: 'order_video' }],
            [{ text: 'Ð“Ð»Ð°Ð²Ð½Ð¾Ðµ Ð¼ÐµÐ½ÑŽ', callback_data: 'main_menu' }]
          ]
        }
      });
    }
  });

  bot.action('animate_photo', async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes('query is too old')) {
        console.error('ÐžÑˆÐ¸Ð±ÐºÐ° answerCbQuery:', error.message);
      }
    }
    
    const userId = ctx.from?.id;
    if (userId) {
      userStates.set(userId, { step: 'waiting_photo' });
    }
    
    // ÐŸÑ€Ð¾Ð²ÐµÑ€ÑÐµÐ¼, ÐµÑÑ‚ÑŒ Ð»Ð¸ PHOTO_FILE_ID
    if (PHOTO_FILE_ID && PHOTO_FILE_ID.trim() !== '') {
      try {
        await ctx.telegram.sendPhoto(userId, PHOTO_FILE_ID, {
          caption: 'ðŸ“¸ <b>ÐŸÑ€Ð¸Ð¼ÐµÑ€</b> â¤´ï¸\n\nÐžÑ‚Ð¿Ñ€Ð°Ð²ÑŒÑ‚Ðµ <b><i>Ñ„Ð¾Ñ‚Ð¾Ð³Ñ€Ð°Ñ„Ð¸ÑŽ</i></b>, ÐºÐ¾Ñ‚Ð¾Ñ€ÑƒÑŽ Ñ…Ð¾Ñ‚Ð¸Ñ‚Ðµ Ð¾Ð¶Ð¸Ð²Ð¸Ñ‚ÑŒ, Ð¸ Ð±Ð¾Ñ‚ Ð¿Ñ€ÐµÐ²Ñ€Ð°Ñ‚Ð¸Ñ‚ ÐµÑ‘ Ð² Ð²Ð¾Ð»ÑˆÐµÐ±Ð½Ð¾Ðµ Ð²Ð¸Ð´ÐµÐ¾ âœ¨ðŸŽ¬',
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: 'ÐÐ°Ð·Ð°Ð´', callback_data: 'photo_animation' }]
            ]
          }
        });
      } catch (error) {
        console.error('ÐžÑˆÐ¸Ð±ÐºÐ° Ð¾Ñ‚Ð¿Ñ€Ð°Ð²ÐºÐ¸ Ñ„Ð¾Ñ‚Ð¾:', error);
        // Ð•ÑÐ»Ð¸ Ð½Ðµ ÑƒÐ´Ð°Ð»Ð¾ÑÑŒ Ð¾Ñ‚Ð¿Ñ€Ð°Ð²Ð¸Ñ‚ÑŒ Ñ„Ð¾Ñ‚Ð¾, Ð¾Ñ‚Ð¿Ñ€Ð°Ð²Ð»ÑÐµÐ¼ Ð¿Ñ€Ð¾ÑÑ‚Ð¾ Ñ‚ÐµÐºÑÑ‚
        await ctx.telegram.sendMessage(userId, 'ðŸ“¸ ÐžÑ‚Ð¿Ñ€Ð°Ð²ÑŒÑ‚Ðµ Ñ„Ð¾Ñ‚Ð¾Ð³Ñ€Ð°Ñ„Ð¸ÑŽ, ÐºÐ¾Ñ‚Ð¾Ñ€ÑƒÑŽ Ñ…Ð¾Ñ‚Ð¸Ñ‚Ðµ Ð¾Ð¶Ð¸Ð²Ð¸Ñ‚ÑŒ, Ð¸ Ð±Ð¾Ñ‚ Ð¿Ñ€ÐµÐ²Ñ€Ð°Ñ‚Ð¸Ñ‚ ÐµÑ‘ Ð² Ð²Ð¾Ð»ÑˆÐµÐ±Ð½Ð¾Ðµ Ð²Ð¸Ð´ÐµÐ¾ âœ¨ðŸŽ¬', {
          reply_markup: {
            inline_keyboard: [
              [{ text: 'ÐÐ°Ð·Ð°Ð´', callback_data: 'photo_animation' }]
            ]
          }
        });
      }
    } else {
      // Ð•ÑÐ»Ð¸ PHOTO_FILE_ID Ð½Ðµ ÑƒÐºÐ°Ð·Ð°Ð½, Ð¿Ñ€Ð¾ÑÑ‚Ð¾ Ð¾Ñ‚Ð¿Ñ€Ð°Ð²Ð»ÑÐµÐ¼ Ñ‚ÐµÐºÑÑ‚
      await ctx.telegram.sendMessage(userId, 'ðŸ“¸ ÐžÑ‚Ð¿Ñ€Ð°Ð²ÑŒÑ‚Ðµ Ñ„Ð¾Ñ‚Ð¾Ð³Ñ€Ð°Ñ„Ð¸ÑŽ, ÐºÐ¾Ñ‚Ð¾Ñ€ÑƒÑŽ Ñ…Ð¾Ñ‚Ð¸Ñ‚Ðµ Ð¾Ð¶Ð¸Ð²Ð¸Ñ‚ÑŒ, Ð¸ Ð±Ð¾Ñ‚ Ð¿Ñ€ÐµÐ²Ñ€Ð°Ñ‚Ð¸Ñ‚ ÐµÑ‘ Ð² Ð²Ð¾Ð»ÑˆÐµÐ±Ð½Ð¾Ðµ Ð²Ð¸Ð´ÐµÐ¾ âœ¨ðŸŽ¬', {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'ÐÐ°Ð·Ð°Ð´', callback_data: 'photo_animation' }]
          ]
        }
      });
    }
  });

  bot.action('video_instruction', async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes('query is too old')) {
        console.error('ÐžÑˆÐ¸Ð±ÐºÐ° answerCbQuery:', error.message);
      }
    }
    await ctx.reply('ðŸŽ¬ <b>Ð’Ð¸Ð´ÐµÐ¾-Ð¸Ð½ÑÑ‚Ñ€ÑƒÐºÑ†Ð¸Ñ Ð¿Ð¾ Ð³ÐµÐ½ÐµÑ€Ð°Ñ†Ð¸Ð¸ Ñ„Ð¾Ñ‚Ð¾</b>\n\nÐ¡Ð¼Ð¾Ñ‚Ñ€Ð¸Ñ‚Ðµ ÐºÐ¾Ñ€Ð¾Ñ‚ÐºÐ¾Ðµ Ð²Ð¸Ð´ÐµÐ¾, Ñ‡Ñ‚Ð¾Ð±Ñ‹ Ð»ÐµÐ³ÐºÐ¾ Ð¸ Ð±Ñ‹ÑÑ‚Ñ€Ð¾ Ð¿Ð¾Ð½ÑÑ‚ÑŒ, ÐºÐ°Ðº Ð¾Ð¶Ð¸Ð²Ð»ÑÑ‚ÑŒ ÑÐ²Ð¾Ð¸ Ñ„Ð¾Ñ‚Ð¾Ð³Ñ€Ð°Ñ„Ð¸Ð¸ Ð¸ Ð¿Ð¾Ð»ÑƒÑ‡Ð°Ñ‚ÑŒ Ð¿Ð¾Ñ‚Ñ€ÑÑÐ°ÑŽÑ‰Ð¸Ðµ Ñ€ÐµÐ·ÑƒÐ»ÑŒÑ‚Ð°Ñ‚Ñ‹ âœ¨ðŸ“¸', { 
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('ÐÐ°Ð·Ð°Ð´', 'photo_animation')]
      ])
    });
  });

  bot.action('order_video', async (ctx) => {
  try {
    await ctx.answerCbQuery();
  } catch (error: any) {
    if (!error.description?.includes('query is too old')) {
      console.error('ÐžÑˆÐ¸Ð±ÐºÐ° answerCbQuery:', error.message);
    }
  }
  
  const userId = ctx.from?.id;
  if (!userId) return;
  
  const orderVideoMessage = `
ðŸ˜ ÐšÐ°Ð¶Ð´Ð°Ñ ÑÐµÐ¼ÑŒÑ â€” ÑÑ‚Ð¾ Ð¸ÑÑ‚Ð¾Ñ€Ð¸Ñ, ÐºÐ¾Ñ‚Ð¾Ñ€ÑƒÑŽ ÑÑ‚Ð¾Ð¸Ñ‚ ÑÐ¾Ñ…Ñ€Ð°Ð½Ð¸Ñ‚ÑŒ

Ð’Ñ‹Ð¿Ð¾Ð»Ð½Ð¸Ð»Ð¸ Ð·Ð°ÐºÐ°Ð· Ð´Ð»Ñ Ð¡Ð²ÐµÑ‚Ð»Ð°Ð½Ñ‹,  ÑÐ´ÐµÐ»Ð°Ð»Ð¸ Ð½Ð°ÑÑ‚Ð¾ÑÑ‰ÐµÐµ Ñ‡ÑƒÐ´Ð¾ â€” Ð²Ð´Ð¾Ñ…Ð½ÑƒÐ»Ð¸ Ð¶Ð¸Ð·Ð½ÑŒ Ð² ÑÑ‚Ð°Ñ€Ñ‹Ðµ Ñ„Ð¾Ñ‚Ð¾ Ð¸ Ð·Ð°Ð¿Ð¸ÑÐ°Ð»Ð¸ Ð¿ÐµÑÐ½ÑŽ Ð¾ ÑÐµÐ¼ÑŒÐµ ðŸ’ž

Ð¢ÐµÐ¿ÐµÑ€ÑŒ ÑÑ‚Ð¾ Ð½Ðµ Ð¿Ñ€Ð¾ÑÑ‚Ð¾ ÐºÐ°Ð´Ñ€Ñ‹, Ð° Ñ†ÐµÐ»Ð°Ñ Ð¸ÑÑ‚Ð¾Ñ€Ð¸Ñ Ð² Ð¼ÑƒÐ·Ñ‹ÐºÐµ Ð¸ Ð¾Ð±Ñ€Ð°Ð·Ð°Ñ….

ðŸ’Œ Ð¥Ð¾Ñ‡ÐµÑˆÑŒ ÑÐ¾Ñ…Ñ€Ð°Ð½Ð¸Ñ‚ÑŒ ÑÐ²Ð¾Ð¸ Ð²Ð¾ÑÐ¿Ð¾Ð¼Ð¸Ð½Ð°Ð½Ð¸Ñ Ñ‚Ð°Ðº Ð¶Ðµ ÐºÑ€Ð°ÑÐ¸Ð²Ð¾? ÐŸÐ¸ÑˆÐ¸ @obrabotych_support
  `.trim();

  await ctx.telegram.sendVideo(
    userId,
    config.orderVideoFileId,
    {
      caption: orderVideoMessage,
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Ð“Ð»Ð°Ð²Ð½Ð¾Ðµ Ð¼ÐµÐ½ÑŽ', callback_data: 'main_menu' }]
        ]
      }
    }
  );
});

  bot.action('order_video_gift', async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes('query is too old')) {
        console.error('ÐžÑˆÐ¸Ð±ÐºÐ° answerCbQuery:', error.message);
      }
    }
    
    const userId = ctx.from?.id;
    if (!userId) return;
    
    await ctx.telegram.sendMessage(
      userId,
      'ðŸ’¬ Ð¡Ð²ÑÐ¶Ð¸Ñ‚ÐµÑÑŒ Ñ Ð½Ð°Ð¼Ð¸ Ð´Ð»Ñ Ð·Ð°ÐºÐ°Ð·Ð° Ð²Ð¸Ð´ÐµÐ¾ Ð¿Ð¾Ð´Ð°Ñ€ÐºÐ°:',
      Markup.inlineKeyboard([
        [Markup.button.url('ÐÐ°Ð¿Ð¸ÑÐ°Ñ‚ÑŒ', 'https://t.me/khodunow')],
        [Markup.button.callback('Ð“Ð»Ð°Ð²Ð½Ð¾Ðµ Ð¼ÐµÐ½ÑŽ', 'main_menu')]
      ])
    );
  });

  bot.action('start_generation', async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes('query is too old')) {
        console.error('ÐžÑˆÐ¸Ð±ÐºÐ° answerCbQuery:', error.message);
      }
    }
    
    const userId = ctx.from?.id;
    if (!userId) return;
    
    const userState = userStates.get(userId);
    
    if (!userState?.photoFileId || !userState?.prompt) {
      await ctx.reply('âŒ ÐžÑˆÐ¸Ð±ÐºÐ°: Ð½Ðµ Ð½Ð°Ð¹Ð´ÐµÐ½Ñ‹ Ð´Ð°Ð½Ð½Ñ‹Ðµ Ð´Ð»Ñ Ð³ÐµÐ½ÐµÑ€Ð°Ñ†Ð¸Ð¸. ÐÐ°Ñ‡Ð½Ð¸Ñ‚Ðµ ÑÐ½Ð°Ñ‡Ð°Ð»Ð° Ñ ÐºÐ¾Ð¼Ð°Ð½Ð´Ñ‹ /start');
      userStates.delete(userId);
      return;
    }
    
    const prompt = userState.prompt;
    const photoFileId = userState.photoFileId;
    
    const hasBalance = await Database.hasEnoughBalance(userId, PRICES.PHOTO_ANIMATION);
    
    if (!hasBalance) {
      const balance = await Database.getUserBalance(userId);
      await ctx.telegram.sendMessage(
        userId,
        `âŒ ÐÐµÐ´Ð¾ÑÑ‚Ð°Ñ‚Ð¾Ñ‡Ð½Ð¾ ÑÑ€ÐµÐ´ÑÑ‚Ð²!\n\n<blockquote>ðŸ’° Ð’Ð°Ñˆ Ð±Ð°Ð»Ð°Ð½Ñ: ${balance.toFixed(2)} â‚½
ðŸ“¹ Ð¢Ñ€ÐµÐ±ÑƒÐµÑ‚ÑÑ: ${PRICES.PHOTO_ANIMATION} â‚½</blockquote>`,
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('ðŸ’³ ÐŸÐ¾Ð¿Ð¾Ð»Ð½Ð¸Ñ‚ÑŒ Ð±Ð°Ð»Ð°Ð½Ñ', 'refill_balance')],
            [Markup.button.callback('Ð“Ð»Ð°Ð²Ð½Ð¾Ðµ Ð¼ÐµÐ½ÑŽ', 'main_menu')]
          ])
        }
      );
      return;
    }
    
    const deducted = await Database.deductBalance(
      userId,
      PRICES.PHOTO_ANIMATION,
      `ÐžÐ¶Ð¸Ð²Ð»ÐµÐ½Ð¸Ðµ Ñ„Ð¾Ñ‚Ð¾: ${prompt.substring(0, 50)}...`
    );
    
    if (!deducted) {
      await ctx.reply('âŒ ÐžÑˆÐ¸Ð±ÐºÐ° ÑÐ¿Ð¸ÑÐ°Ð½Ð¸Ñ ÑÑ€ÐµÐ´ÑÑ‚Ð². ÐŸÐ¾Ð¿Ñ€Ð¾Ð±ÑƒÐ¹Ñ‚Ðµ Ð¿Ð¾Ð·Ð¶Ðµ.');
      userStates.delete(userId);
      return;
    }
    
    await ctx.telegram.sendMessage(userId, 'â³ ÐÐ°Ñ‡Ð¸Ð½Ð°ÑŽ Ð³ÐµÐ½ÐµÑ€Ð°Ñ†Ð¸ÑŽ... Ð­Ñ‚Ð¾ Ð·Ð°Ð¹Ð¼ÐµÑ‚ Ð¾ÐºÐ¾Ð»Ð¾ 3 Ð¼Ð¸Ð½ÑƒÑ‚.');
    
    processVideoGeneration(ctx, userId, photoFileId, prompt);
    
    userStates.delete(userId);
  });
}
