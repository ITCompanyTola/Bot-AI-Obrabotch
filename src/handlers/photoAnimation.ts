import { Telegraf, Markup } from "telegraf";
import { BotContext, UserState } from "../types";
import { Database } from "../database";
import { PRICES } from "../constants";
import { processVideoGeneration } from "../services/klingService";

const VIDEO_FILE_ID =
  "BAACAgIAAxkBAAECXWtpSDoDQQ-MSv3zGWfvxAQxJBoFzAACDpQAAr5EQUqE-gauHSVXMDYE";
const PHOTO_FILE_ID =
  "AgACAgIAAxkBAAECXXBpSDo5YWJeqApgvWJe7iBLwGqrOgACgw5rGxKRQUq7Bzgv4_64_gEAAwIAA3kAAzYE";
const ORDER_VIDEO_FILE_ID =
  "BAACAgIAAxkBAAECXXFpSDpbwZ-Ao9B-7AyK476dwfbj2gACFpQAAr5EQUri1qZWZw7PmDYE";
const INTRUCTION_FILE_ID =
  "BAACAgIAAxkBAAECdxlpSuDEuFSmVp87Vy5NW8rMAUzLIQAC3pUAAnIgWUpp-RGgMQAB-eM2BA";

export function registerPhotoAnimationHandlers(
  bot: Telegraf<BotContext>,
  userStates: Map<number, UserState>
) {
  bot.action("photo_animation", async (ctx) => {
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

    const photoAnimationMessage = `
📸 <b>Наш бот умеет оживлять фото!</b>

Вот как создать своё анимированное фото:

1️⃣ Нажмите кнопку\n<b>«📸Оживить фото»</b>
2️⃣ <i><b>Отправьте одну фотографию* в бот.</b></i>
3️⃣ <b><i>Опишите</i></b>, что именно должно произойти на изображении — движение, эмоции, детали
4️⃣ <b><i>Немного подождите</i></b> — примерно через 3 минуты бот отправит вам готовое видео 🎬

🎁 <b>Хотите видео "под ключ"?</b>
Нажмите кнопку <b><i>«Заказать видео под ключ»</i></b>, и мы создадим его полностью для вас!

<blockquote>💰 Ваш баланс: ${balance.toFixed(2)}₽
📸 Оживление 1 фото: ${PRICES.PHOTO_ANIMATION.toFixed(2)}₽</blockquote>

❗️* - <b>бот оживляет только одно фото за раз</b>☝🏻
    `.trim();

    // Проверяем, есть ли VIDEO_FILE_ID
    if (VIDEO_FILE_ID && VIDEO_FILE_ID.trim() !== "") {
      try {
        await ctx.telegram.sendVideo(userId, VIDEO_FILE_ID, {
          caption: photoAnimationMessage,
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "📸 Оживить фото", callback_data: "animate_photo" }],
              [
                {
                  text: "Видео-инструкция",
                  callback_data: "video_instruction",
                },
              ],
              [
                {
                  text: "💳 Пополнить баланс",
                  callback_data: "refill_balance",
                },
              ],
              [
                {
                  text: "Заказать видео под ключ",
                  callback_data: "order_video",
                },
              ],
              [{ text: "Главное меню", callback_data: "main_menu" }],
            ],
          },
        });
      } catch (error) {
        console.error("Ошибка отправки видео:", error);
        // Если не удалось отправить видео, отправляем просто текст
        await ctx.telegram.sendMessage(userId, photoAnimationMessage, {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "📸 Оживить фото", callback_data: "animate_photo" }],
              [
                {
                  text: "Видео-инструкция",
                  callback_data: "video_instruction",
                },
              ],
              [
                {
                  text: "💳 Пополнить баланс",
                  callback_data: "refill_balance",
                },
              ],
              [
                {
                  text: "Заказать видео под ключ",
                  callback_data: "order_video",
                },
              ],
              [{ text: "Главное меню", callback_data: "main_menu" }],
            ],
          },
        });
      }
    } else {
      // Если VIDEO_FILE_ID не указан, просто отправляем текст
      await ctx.telegram.sendMessage(userId, photoAnimationMessage, {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "📸 Оживить фото", callback_data: "animate_photo" }],
            [{ text: "Видео-инструкция", callback_data: "video_instruction" }],
            [{ text: "💳 Пополнить баланс", callback_data: "refill_balance" }],
            [{ text: "Заказать видео под ключ", callback_data: "order_video" }],
            [{ text: "Главное меню", callback_data: "main_menu" }],
          ],
        },
      });
    }
  });

  bot.action("animate_photo", async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes("query is too old")) {
        console.error("Ошибка answerCbQuery:", error.message);
      }
    }

    const userId = ctx.from?.id;
    if (userId) {
      userStates.set(userId, { step: "waiting_photo" });
    }

    // Проверяем, есть ли PHOTO_FILE_ID
    if (PHOTO_FILE_ID && PHOTO_FILE_ID.trim() !== "") {
      try {
        await ctx.telegram.sendPhoto(userId, PHOTO_FILE_ID, {
          caption:
            "<b>Пример</b> ⤴️\n\nОтправьте <b><i>фотографию</i></b>, которую хотите оживить, и бот превратит её в волшебное видео 🎬",
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "Назад", callback_data: "photo_animation" }],
            ],
          },
        });
      } catch (error) {
        console.error("Ошибка отправки фото:", error);
        // Если не удалось отправить фото, отправляем просто текст
        await ctx.telegram.sendMessage(
          userId,
          "📸 Отправьте <b><i>фотографию</i></b>, которую хотите оживить, и бот превратит её в волшебное видео 🎬",
          {
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [
                [{ text: "Назад", callback_data: "photo_animation" }],
              ],
            },
          }
        );
      }
    } else {
      // Если PHOTO_FILE_ID не указан, просто отправляем текст
      await ctx.telegram.sendMessage(
        userId,
        "📸 Отправьте <b><i>фотографию</i></b>, которую хотите оживить, и бот превратит её в волшебное видео 🎬",
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "Назад", callback_data: "photo_animation" }],
            ],
          },
        }
      );
    }
  });

  bot.action("video_instruction", async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes("query is too old")) {
        console.error("Oshibka answerCbQuery:", error.message);
      }
    }

    const userId = ctx.from?.id;
    if (!userId) return;
    try {
      await ctx.telegram.sendVideo(userId, INTRUCTION_FILE_ID, {
        caption:
          "📹 <b>Видео-инструкция по оживлению фото</b>\n\nСмотрите короткое видео, чтобы правильно и качественно выполнять шаги и получать потрясающие результаты 🔥",
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "Назад", callback_data: "photo_animation" }],
          ],
        },
      });
    } catch (error) {
      await ctx.reply("Ошибка воспроизведения видео!", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Назад", callback_data: "photo_animation" }],
          ],
        },
      });
    }
  });

  bot.action("order_video", async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes("query is too old")) {
        console.error("Ошибка answerCbQuery:", error.message);
      }
    }

    const userId = ctx.from?.id;
    if (!userId) return;

    const orderVideoMessage = `
😍 <b>Каждая семья — это история, которую стоит сохранить</b>

Выполнили заказ для Светланы,  сделали настоящее чудо — вдохнули жизнь в старые фото и записали песню о семье 💞

Теперь это не просто кадры, а целая история в музыке и образах.

💌 <b><i>Хотите сохранить свои воспоминания так же красиво?</i></b> Вы можете написать в нашу службу технической поддрежки — <a href="https://t.me/obrabotych_support">@obrabotych_support</a>
  `.trim();
    try {
      await ctx.telegram.sendVideo(userId, ORDER_VIDEO_FILE_ID, {
        caption: orderVideoMessage,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "Главное меню", callback_data: "main_menu" }],
          ],
        },
      });
    } catch (error) {
      await ctx.reply("Ошибка воспроизведения видео", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Назад", callback_data: "photo_animation" }],
          ],
        },
      });
    }
  });

  bot.action("order_video_gift", async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes("query is too old")) {
        console.error("Ошибка answerCbQuery:", error.message);
      }
    }

    const userId = ctx.from?.id;
    if (!userId) return;

    await ctx.telegram.sendMessage(
      userId,
      "💬 Свяжитесь с нами для заказа видео подарка:",
      Markup.inlineKeyboard([
        [Markup.button.url("Написать", "https://t.me/khodunow")],
        [Markup.button.callback("Главное меню", "main_menu")],
      ])
    );
  });

  // Потенциально неиспользуемая функция обработки inline-кнопки.
  // Схожая логика наблюдается в файле textHandlers.ts
  bot.action("start_generation", async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes("query is too old")) {
        console.error("Ошибка answerCbQuery:", error.message);
      }
    }

    const userId = ctx.from?.id;
    if (!userId) return;

    const userState = userStates.get(userId);

    if (!userState?.photoFileId || !userState?.prompt) {
      await ctx.reply(
        "❌ Ошибка: не найдены данные для генерации. Начните сначала с команды /start"
      );
      userStates.delete(userId);
      return;
    }

    const prompt = userState.prompt;
    const photoFileId = userState.photoFileId;

    const hasBalance = await Database.hasEnoughBalance(
      userId,
      PRICES.PHOTO_ANIMATION
    );

    if (!hasBalance) {
      const balance = await Database.getUserBalance(userId);
      await ctx.telegram.sendMessage(
        userId,
        `💰 Ваш баланс: ${balance.toFixed(2)}₽\n📹 Оживление : ${
          PRICES.PHOTO_ANIMATION
        }₽`,
        {
          parse_mode: "HTML",
          ...Markup.inlineKeyboard([
            [Markup.button.callback("💳 Пополнить баланс", "refill_balance")],
            [Markup.button.callback("Главное меню", "main_menu")],
          ]),
        }
      );
      return;
    }

    const deducted = await Database.deductBalance(
      userId,
      PRICES.PHOTO_ANIMATION,
      `Оживление фото: ${prompt.substring(0, 50)}...`
    );

    if (!deducted) {
      await ctx.reply("❌ Ошибка списания средств. Попробуйте позже.");
      userStates.delete(userId);
      return;
    }

    await ctx.telegram.sendMessage(
      userId,
      "⏳ Начинаю генерацию... Это займет около 3-х минут.\n\n<b>Следите за обновлениями в нашем Telegram-канале:</b>\nhttps://t.me/ai_lumin",
      {
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
      }
    );

    processVideoGeneration(ctx, userId, photoFileId, prompt);

    userStates.delete(userId);
  });
}
