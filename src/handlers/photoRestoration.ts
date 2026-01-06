import { Telegraf } from "telegraf";
import { BotContext, UserState } from "../types";
import { Database } from "../database";
import { PRICES } from "../constants";
import { redisStateService } from "../redis-state.service";

const EXAMPLE_PHOTO_RESTORATION: string =
  "AgACAgIAAxkBAAECXaRpSDzGj_QjXoenroik6oeuVAObkQACWA9rG75EQUoRFpQnbHIyfQEAAwIAA3gAAzYE"; // Загрузить и вставить свое фото
const PHOTO_RESTORATION_INSTRUCTION: string =
  "BAACAgIAAxkBAAECdyNpSuExOUrSjpxBZQaqRgABlTr9IfAAAvSVAAJyIFlKZWEtLHGSNQk2BA"; // Загрузить и вставить свое видео
const HERO_VIDEO: string =
  "BAACAgIAAxkBAAECXaBpSDyetWAlb6lWMjpBwIEU_8wcMQACRZQAAr5EQUovJZGexEaBRzYE";

export function registerPhotoRestorationHandlers(bot: Telegraf<BotContext>) {
  bot.action("photo_restoration", async (ctx) => {
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

    const photoRestorationMessage = `
<b>✨ Наш Бот умеет реставрировать фото!</b>

Вот как восстановить своё фото:

1️⃣ Нажмите кнопку\n<b>«✨ Реставрировать фото»</b>
2️⃣ <i><b>Отправьте одну фотографию* в бот</b></i>
3️⃣ <i><b>Немного подождите</b></i> — примерно через 3 минуты бот отправит вам готовое фото ⚡️

<blockquote>💰 Ваш баланс: ${balance.toFixed(2)}₽
✨ Реставрация 1 фото: ${PRICES.PHOTO_RESTORATION.toFixed(2)}₽</blockquote>

❗️* - <b>бот восстанавливает только одно фото за раз</b>☝🏻`.trim();

    try {
      await ctx.telegram.sendVideo(userId, HERO_VIDEO, {
        caption: photoRestorationMessage,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "✨ Реставрировать фото",
                callback_data: "photo_restoration_start",
              },
            ],
            [
              {
                text: "Видео-инструкция",
                callback_data: "photo_restoration_instruction",
              },
            ],
            [
              {
                text: "💳 Пополнить баланс",
                callback_data: "refill_balance_from_restoration",
              },
            ],
            [{ text: "Главное меню", callback_data: "main_menu" }],
          ],
        },
      });
    } catch (error: any) {
      await ctx.telegram.sendMessage(userId, photoRestorationMessage, {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "✨ Реставрировать фото",
                callback_data: "photo_restoration_start",
              },
            ],
            [
              {
                text: "Видео-инструкция",
                callback_data: "photo_restoration_instruction",
              },
            ],
            [
              {
                text: "💳 Пополнить баланс",
                callback_data: "refill_balance_from_restoration",
              },
            ],
            [{ text: "Главное меню", callback_data: "main_menu" }],
          ],
        },
      });
    }
  });

  bot.action("photo_restoration_start", async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes("query is too old")) {
        console.error("Ошибка answerCbQuery:", error.message);
      }
    }

    const userId = ctx.from?.id;
    if (!userId) return;

    const hasEnoughBalance = await Database.hasEnoughBalance(
      userId,
      PRICES.PHOTO_RESTORATION
    );

    if (hasEnoughBalance) {
      await redisStateService.set(userId, {
        step: "waiting_for_restoration_photo",
      });

      const photoRestorationWaitingMessage = `
<b>Пример ⤴️</b>

Отправьте <b><i>фотографию</i></b> которую нужно восстановить — бот устранит шум, повреждения и повысит качество изображения ✨
    `.trim();
      const restorationMessageWithoutExample = `
Отправьте <b><i>фотографию</i></b>, которую нужно восстановить — бот устранит шум, повреждения и повысит качество изображения ✨
    `.trim();

      if (
        EXAMPLE_PHOTO_RESTORATION &&
        EXAMPLE_PHOTO_RESTORATION.trim() !== ""
      ) {
        try {
          await ctx.telegram.sendPhoto(userId, EXAMPLE_PHOTO_RESTORATION, {
            caption: photoRestorationWaitingMessage,
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [
                [{ text: "Назад", callback_data: "photo_restoration" }],
              ],
            },
          });
        } catch (error) {
          console.error("Ошибка отправки фото для реставрации: ", error);
          await ctx.telegram.sendMessage(
            userId,
            restorationMessageWithoutExample,
            {
              parse_mode: "HTML",
              reply_markup: {
                inline_keyboard: [
                  [{ text: "Назад", callback_data: "photo_restoration" }],
                ],
              },
            }
          );
        }
        return;
      } else {
        await ctx.telegram.sendMessage(
          userId,
          restorationMessageWithoutExample,
          {
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [
                [{ text: "Назад", callback_data: "photo_restoration" }],
              ],
            },
          }
        );
        return;
      }
    }

    const balance = await Database.getUserBalance(userId);

    const paymentMessage = `
К сожалению, <b>на вашем балансе недостаточно средств</b> для создания генерации 😢

<blockquote>💰 Ваш баланс: ${balance.toFixed(2)}₽
✨ Создание 1 Реставрации: ${PRICES.PHOTO_RESTORATION.toFixed(2)}₽</blockquote>

Чтобы продолжить, <b>пополните баланс</b>

Выберите способ оплаты ⤵️`.trim();

    await ctx.telegram.sendMessage(userId, paymentMessage, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Оплата картой",
              callback_data: "refill_balance_from_restoration",
            },
          ],
          [{ text: "Главное меню", callback_data: "main_menu" }],
        ],
      },
    });
  });

  bot.action("photo_restoration_instruction", async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes("query is too old")) {
        console.error("Ошибка answerCbQuery:", error.message);
      }
    }

    const userId = ctx.from?.id;
    if (!userId) return;

    const photoRestorationInstructionMessage = `
<b>📹 Видео-инструкция по реставрации фото</b>

Смотрите короткое видео, чтобы правильно и качественно выполнять шаги и получать потрясающие результаты 🔥
    `.trim();

    const sendErrorMessage = async (): Promise<void> => {
      const instructionErrorMessage =
        "Ошибка загрузки видео. Пожалуйста вернитесь назад.";
      await ctx.telegram.sendMessage(userId, instructionErrorMessage, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Назад", callback_data: "photo_restoration" }],
          ],
        },
      });
    };

    if (
      PHOTO_RESTORATION_INSTRUCTION &&
      PHOTO_RESTORATION_INSTRUCTION.trim() !== ""
    ) {
      try {
        await ctx.telegram.sendVideo(userId, PHOTO_RESTORATION_INSTRUCTION, {
          caption: photoRestorationInstructionMessage,
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "Назад", callback_data: "photo_restoration" }],
            ],
          },
        });
      } catch (error) {
        console.error("Ошибка отправки инструкции к реставрации фото", error);
        sendErrorMessage();
      }
    } else {
      sendErrorMessage();
    }
  });
}
