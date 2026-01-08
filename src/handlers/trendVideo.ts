import { Telegraf } from "telegraf";
import { BotContext } from "../types";
import { redisStateService } from "../redis-state.service";
import {
  getTrendVideoMessage,
  PRICES,
  TREND_VIDEO_START,
  TREND_VIDEO_START_ONLY_TEXT,
} from "../constants";
import { Database } from "../database";

const HERO_VIDEO_FILE_ID =
  "BAACAgIAAxkBAAERaFNpX_E6lAliONESMx_8mFuXLiY-YwACy4cAAuTSAUvn-UVy-qk9XDgE";
const EXAMPLE_FILE_ID =
  "AgACAgIAAxkBAAERaHppX_Ffl2tETTz5s0kNzJPXDncn_wAC8w1rG-Qj-Er12IFg70amQAEAAwIAA3gAAzgE";

export async function registerTrendVideoHandlers(bot: Telegraf<BotContext>) {
  bot.action("trend_video", async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes("query is too old")) {
        console.error("Ошибка answerCbQuery:", error.message);
      }
    }

    const userId = ctx.from?.id;
    if (!userId) return;

    const balance = await Database.getUserBalance(userId);

    const message = getTrendVideoMessage(balance);
    try {
      await ctx.replyWithVideo(HERO_VIDEO_FILE_ID, {
        caption: message,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "💃 Создать видео",
                callback_data: "trend_video_start",
              },
            ],
            [
              {
                text: "💳 Пополнить баланс",
                callback_data: "refill_balance_from_trend_video",
              },
            ],
            [{ text: "Главное меню", callback_data: "main_menu" }],
          ],
        },
      });
    } catch (error) {
      console.log(error);

      await ctx.reply(message, {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "💃 Создать видео",
                callback_data: "trend_video_start",
              },
            ],
            [
              {
                text: "💳 Пополнить баланс",
                callback_data: "refill_balance_from_trend_video",
              },
            ],
            [{ text: "Главное меню", callback_data: "main_menu" }],
          ],
        },
      });
    }
  });

  bot.action("trend_video_start", async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes("query is too old")) {
        console.error("Ошибка answerCbQuery:", error.message);
      }
    }

    const userId = ctx.from?.id;
    if (!userId) return;

    if (await Database.hasEnoughBalance(userId, PRICES.TREND_VIDEO)) {
      await redisStateService.set(userId, {
        step: "waiting_photo_for_trend_video",
      });

      try {
        const message = TREND_VIDEO_START;
        await ctx.replyWithPhoto(EXAMPLE_FILE_ID, {
          caption: message,
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "Назад", callback_data: "trend_video" }],
            ],
          },
        });
      } catch (error) {
        const message = TREND_VIDEO_START_ONLY_TEXT;
        await ctx.reply(message, {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "Назад", callback_data: "trend_video" }],
            ],
          },
        });
      }
    } else {
      const balance = await Database.getUserBalance(userId);

      const paymentMessage = `
К сожалению, <b>на вашем балансе недостаточно средств</b> для создания генерации 😢

<blockquote>💰 Ваш баланс: ${balance.toFixed(2)}₽
💃 Создание 1 видео: ${PRICES.PHOTO_RESTORATION.toFixed(2)}₽</blockquote>

Чтобы продолжить, <b>пополните баланс</b>

Выберите способ оплаты ⤵️`.trim();

      await ctx.telegram.sendMessage(userId, paymentMessage, {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "Оплата картой",
                callback_data: "refill_balance_from_trend_video",
              },
            ],
            [{ text: "Главное меню", callback_data: "main_menu" }],
          ],
        },
      });
    }
  });
}
