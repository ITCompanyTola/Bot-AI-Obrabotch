import { Telegraf } from "telegraf";
import { BotContext, UserState } from "../types";
import { Database } from "../database";
import {
  getChristmasPostcardMessage,
  getPostcardMessage,
  getPostcardPhotoMessage,
  POSCTARD_MESSAGE,
  POSTCARD_CHRISTMAS_START,
  POSTCARD_MESSAGE_START,
  POSTCARD_PHOTO_START,
  POSTCARD_PHOTO_START_WIHOUT,
  PRICES,
} from "../constants";
import { redisStateService } from "../redis-state.service";

const HERO_VIDEO_TEXT: string =
  "BAACAgIAAxkBAAECdzFpSuGnIPA7Q_WONIwAAZvKW74rJtkAA5YAAnIgWUomnSdhRwQ1VjYE";
const HERO_PHOTO_VIDEO_ID: string =
  "BAACAgIAAxkBAAECaetpSXzBT3SjPpEi5XTEnSVVg5yXJwACU5EAAhKRSUrP-iMveUqEuzYE";
const EXAMPLE_POSTCARD_PHOTO_ID: string =
  "AgACAgIAAxkBAAECXdFpSD25-QLIejlyURmKIPm_QOBbwgACXQ9rG75EQUq_ZhrnMheB_wEAAwIAA3gAAzYE"; // Загрузить и вставить свое фото
const POSTCARD_PHOTO_INSTRUCTION: string =
  "BAACAgIAAxkBAAECdvtpSuAbiBX3l0F_PXF48nyZA1-HcQAC0JUAAnIgWUrN8eIy-x0nKzYE"; // Загрузить и вставить свое видео
const POSTCARD_TEXT_INSTRUCTION: string =
  "BAACAgIAAxkBAAECdvhpSt_r7bS5WGoo7pw1oGNJ4dfUygACy5UAAnIgWUrMQ6MLuolkAzYE";
const POSTCARD_CHRISTMAS_HERO_VIDEO: string =
  "BAACAgIAAxkBAAEMVqNpWUloy6FwaqHrg7RVUuj8Yv-atgACdIYAArafyEpMjeI0hhn_QDgE";
const POSTCARD_CHRISTMAS_PHOTO: string =
  "AgACAgIAAxkBAAEMVkVpWUkXeDUu7cW1NQxtb5KdgbT6JwACnhBrG7afyEpQ883gLNKZswEAAwIAA3gAAzgE";

export function registerPostcardHandlers(bot: Telegraf<BotContext>) {
  bot.action("postcard", async (ctx) => {
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
    const postcardMessage = POSCTARD_MESSAGE;
    await ctx.telegram.sendMessage(userId, postcardMessage, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [{ text: "💌 Открытка из текста", callback_data: "postcard_text" }],
          [
            {
              text: "🏞 Открытка с Новым годом",
              callback_data: "postcard_photo",
            },
          ],
          [
            {
              text: "🎄Открытка с Рождеством",
              callback_data: "postcard_christmas",
            },
          ],
          [{ text: "Главное меню", callback_data: "main_menu" }],
        ],
      },
    });
  });

  bot.action("postcard_christmas", async (ctx) => {
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

    const message = getChristmasPostcardMessage(balance);

    try {
      await ctx.replyWithVideo(POSTCARD_CHRISTMAS_HERO_VIDEO, {
        caption: message,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "🎄 Создать открытку",
                callback_data: "postcard_christmas_start",
              },
            ],
            [
              {
                text: "Видео-инструкция",
                callback_data: "postcard_christmas_instruction",
              },
            ],
            [
              {
                text: "💳 Пополнить баланс",
                callback_data: "refill_balance_from_postcard_christmas",
              },
            ],
            [{ text: "Назад", callback_data: "postcard" }],
          ],
        },
      });
    } catch (error: any) {
      console.log("Ошибка reply:", error.message);
      await ctx.reply(message, {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "🎄 Создать открытку",
                callback_data: "postcard_christmas_start",
              },
            ],
            [
              {
                text: "Видео-инструкция",
                callback_data: "postcard_christmas_instruction",
              },
            ],
            [
              {
                text: "💳 Пополнить баланс",
                callback_data: "refill_balance_from_postcard_christmas",
              },
            ],
            [{ text: "Назад", callback_data: "postcard" }],
          ],
        },
      });
    }
  });

  bot.action("postcard_christmas_start", async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes("query is too old")) {
        console.error("Ошибка answerCbQuery:", error.message);
      }
    }

    const userId = ctx.from?.id;
    if (!userId) return;

    const message = POSTCARD_CHRISTMAS_START;

    if (await Database.hasEnoughBalance(userId, PRICES.POSTCARD_CHRISTMAS)) {
      await redisStateService.set(userId, {
        step: "waiting_postcard_christmas",
      });

      try {
        await ctx.replyWithPhoto(POSTCARD_CHRISTMAS_PHOTO, {
          caption: message,
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "Назад", callback_data: "postcard_christmas" }],
            ],
          },
        });
      } catch (error) {
        console.log("Ошибка reply:", error);
        await ctx.reply(message, {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "Назад", callback_data: "postcard_christmas" }],
            ],
          },
        });
      }
    } else {
      const balance = await Database.getUserBalance(userId);

      const paymentMessage = `
К сожалению, <b>на вашем балансе недостаточно средств</b> для создания генерации 😢

<blockquote>💰 Ваш баланс: ${balance.toFixed(2)}₽
🎄 Генерация 1 открытки: ${PRICES.POSTCARD_CHRISTMAS.toFixed(2)}₽</blockquote>

Чтобы продолжить, <b>пополните баланс</b>

Выберите способ оплаты ⤵️`.trim();

      await ctx.telegram.sendMessage(userId, paymentMessage, {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "Оплата картой",
                callback_data: "refill_balance_from_postcard_christmas",
              },
            ],
            [{ text: "Главное меню", callback_data: "main_menu" }],
          ],
        },
      });
    }
  });

  bot.action("postcard_text", async (ctx) => {
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

    const message = getPostcardMessage(balance);

    try {
      await ctx.replyWithVideo(HERO_VIDEO_TEXT, {
        parse_mode: "HTML",
        caption: message,
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "💌 Создать открытку",
                callback_data: "postcard_text_start",
              },
            ],
            [
              {
                text: "Видео-инструкция",
                callback_data: "postcard_text_instruction",
              },
            ],
            [
              {
                text: "💳 Пополнить баланс",
                callback_data: "refill_balance_from_postcard_text",
              },
            ],
            [{ text: "Назад", callback_data: "postcard" }],
          ],
        },
      });
    } catch (error: any) {
      console.log(error);
      await ctx.reply(message, {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "💌 Открытка из текста ",
                callback_data: "postcard_text_start",
              },
            ],
            [
              {
                text: "Видео-инструкция",
                callback_data: "postcard_text_instruction",
              },
            ],
            [
              {
                text: "💳 Пополнить баланс",
                callback_data: "refill_balance_from_postcard_text",
              },
            ],
            [{ text: "Назад", callback_data: "postcard" }],
          ],
        },
      });
    }
  });

  bot.action("postcard_text_start", async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes("query is too old")) {
        console.error("Ошибка answerCbQuery:", error.message);
      }
    }

    const userId = ctx.from?.id;
    if (!userId) return;

    const message = POSTCARD_MESSAGE_START;

    if (await Database.hasEnoughBalance(userId, PRICES.POSTCARD_TEXT)) {
      await redisStateService.set(userId, {
        step: "waiting_postcard_text",
      });

      await ctx.reply(message, {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "Назад", callback_data: "postcard_text" }],
          ],
        },
      });
    } else {
      const balance = await Database.getUserBalance(userId);

      const paymentMessage = `
К сожалению, <b>на вашем балансе недостаточно средств</b> для создания генерации 😢

<blockquote>💰 Ваш баланс: ${balance.toFixed(2)}₽
💌 Генерация 1 Открытки: ${PRICES.POSTCARD_TEXT.toFixed(2)}₽</blockquote>

Чтобы продолжить, <b>пополните баланс</b>

Выберите способ оплаты ⤵️`.trim();

      await ctx.telegram.sendMessage(userId, paymentMessage, {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "Оплата картой",
                callback_data: "refill_balance_from_postcard_text",
              },
            ],
            [{ text: "Главное меню", callback_data: "main_menu" }],
          ],
        },
      });
    }
  });

  bot.action("postcard_photo", async (ctx) => {
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

    const message = getPostcardPhotoMessage(balance);

    try {
      await ctx.replyWithVideo(HERO_PHOTO_VIDEO_ID, {
        parse_mode: "HTML",
        caption: message,
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "🏞 Создать открытку",
                callback_data: "postcard_photo_start",
              },
            ],
            [
              {
                text: "Видео-инструкция",
                callback_data: "postcard_photo_instruction",
              },
            ],
            [
              {
                text: "💳 Пополнить баланс",
                callback_data: "refill_balance_from_postcard_photo",
              },
            ],
            [{ text: "Назад", callback_data: "postcard" }],
          ],
        },
      });
    } catch (error: any) {
      await ctx.reply(message, {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "🏞 Создать открытку  ",
                callback_data: "postcard_photo_start",
              },
            ],
            [
              {
                text: "Видео-инструкция",
                callback_data: "postcard_photo_instruction",
              },
            ],
            [
              {
                text: "💳 Пополнить баланс",
                callback_data: "refill_balance_from_postcard_photo",
              },
            ],
            [{ text: "Назад", callback_data: "postcard" }],
          ],
        },
      });
    }
  });

  bot.action("postcard_photo_start", async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes("query is too old")) {
        console.error("Ошибка answerCbQuery:", error.message);
      }
    }

    const userId = ctx.from?.id;
    if (!userId) return;

    const message = POSTCARD_PHOTO_START;

    if (await Database.hasEnoughBalance(userId, PRICES.POSTCARD_PHOTO)) {
      await redisStateService.set(userId, {
        step: "waiting_postcard_photo",
      });
      if (EXAMPLE_POSTCARD_PHOTO_ID && EXAMPLE_POSTCARD_PHOTO_ID.length > 0) {
        try {
          await ctx.replyWithPhoto(EXAMPLE_POSTCARD_PHOTO_ID, {
            caption: message,
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [
                [{ text: "Назад", callback_data: "postcard_photo" }],
              ],
            },
          });
        } catch (error: any) {
          const messageWitoutExample = POSTCARD_PHOTO_START_WIHOUT;
          await ctx.reply(messageWitoutExample, {
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [
                [{ text: "Назад", callback_data: "postcard_photo" }],
              ],
            },
          });
        }
        return;
      }
      await ctx.reply(message, {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "Назад", callback_data: "postcard_photo" }],
          ],
        },
      });
    } else {
      const balance = await Database.getUserBalance(userId);

      const paymentMessage = `
К сожалению, <b>на вашем балансе недостаточно средств</b> для создания генерации 😢

<blockquote>💰 Ваш баланс: ${balance.toFixed(2)}₽
🏞 Генерация 1 Открытки: ${PRICES.POSTCARD_PHOTO.toFixed(2)}₽</blockquote>

Чтобы продолжить, <b>пополните баланс</b>

Выберите способ оплаты ⤵️`.trim();

      await ctx.telegram.sendMessage(userId, paymentMessage, {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "Оплата картой",
                callback_data: "refill_balance_from_postcard_photo",
              },
            ],
            [{ text: "Главное меню", callback_data: "main_menu" }],
          ],
        },
      });
    }
  });

  bot.action("postcard_text_instruction", async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes("query is too old")) {
        console.error("Ошибка answerCbQuery:", error.message);
      }
    }

    const userId = ctx.from?.id;
    if (!userId) return;

    const messge = `
📹 <b>Видео-инструкция по созданию открыток из текста</b>

Смотрите короткое видео, чтобы правильно и качественно выполнять шаги и получать потрясающие результаты 🔥`.trim();

    try {
      await ctx.replyWithVideo(POSTCARD_TEXT_INSTRUCTION, {
        caption: messge,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "Назад", callback_data: "postcard_text" }],
          ],
        },
      });
    } catch (error: any) {
      await ctx.reply("Ошибка воспроизведения видео!", {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "Назад", callback_data: "postcard_text" }],
          ],
        },
      });
    }
  });

  bot.action("postcard_photo_instruction", async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes("query is too old")) {
        console.error("Ошибка answerCbQuery:", error.message);
      }
    }

    const userId = ctx.from?.id;
    if (!userId) return;

    const messge = `
📹 <b>Видео-инструкция по созданию открыток из вашего фото</b>

Смотрите короткое видео, чтобы правильно и качественно выполнять шаги и получать потрясающие результаты 🔥`.trim();

    try {
      await ctx.replyWithVideo(POSTCARD_PHOTO_INSTRUCTION, {
        caption: messge,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "Назад", callback_data: "postcard_photo" }],
          ],
        },
      });
    } catch (error: any) {
      await ctx.reply("Ошибка воспроизведения видео!", {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "Назад", callback_data: "postcard_photo" }],
          ],
        },
      });
    }
  });

  bot.action("postcard_christmas_instruction", async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes("query is too old")) {
        console.error("Ошибка answerCbQuery:", error.message);
      }
    }

    const userId = ctx.from?.id;
    if (!userId) return;

    const messge = `
📹 <b>Видео-инструкция по созданию открыток из вашего фото</b>

Смотрите короткое видео, чтобы правильно и качественно выполнять шаги и получать потрясающие результаты 🔥`.trim();

    try {
      await ctx.replyWithVideo(POSTCARD_PHOTO_INSTRUCTION, {
        caption: messge,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "Назад", callback_data: "postcard_christmas" }],
          ],
        },
      });
    } catch (error: any) {
      await ctx.reply("Ошибка воспроизведения видео!", {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "Назад", callback_data: "postcard_christmas" }],
          ],
        },
      });
    }
  });
}
