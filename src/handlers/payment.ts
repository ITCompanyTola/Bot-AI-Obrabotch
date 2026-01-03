import { Telegraf, Markup } from "telegraf";
import { BotContext, UserState } from "../types";
import { Database } from "../database";
import { createPayment, checkPaymentStatus } from "../services/paymentService";
import { logToFile } from "../bot";
import crypto from "crypto";

const { v4: uuidv4 } = require("uuid");

async function showPaymentMessage(
  ctx: any,
  amount: number,
  userStates: Map<number, UserState>,
  backAction: string,
  useReply: boolean = false
) {
  const userId = ctx.from?.id;
  if (!userId) return;

  try {
    logToFile(
      `💳 Попытка создания платежа: userId=${userId}, amount=${amount}`
    );

    const email = await Database.getUserEmail(userId);

    const payment = await createPayment(
      amount,
      `Пополнение баланса на ${amount}₽`,
      userId,
      email || ""
    );

    logToFile(
      `✅ Платеж создан успешно: paymentId=${payment.paymentId}, url=${payment.confirmationUrl}`
    );

    const currentState = userStates.get(userId) || { step: null };
    userStates.set(userId, {
      ...currentState,
      paymentId: payment.paymentId,
      paymentAmount: amount,
      step: null,
      pendingPaymentAmount: undefined,
    });

    await Database.savePendingPayment(userId, payment.paymentId, amount);

    const paymentMessage = `
💳 Сумма к оплате: ${amount}₽

Ваша ссылка для оплаты:
${payment.confirmationUrl}

После успешной оплаты баланс будет автоматически начислен в течение нескольких секунд ⚡️
    `.trim();

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.url(`💳 Оплатить ${amount}₽`, payment.confirmationUrl)],
      // [Markup.button.callback('💳 Оплатить зарубежной картой', 'robokassa_pay')],
      [Markup.button.callback("Назад", backAction)],
    ]);

    if (useReply) {
      await ctx.reply(paymentMessage, keyboard);
    } else {
      await ctx.editMessageText(paymentMessage, keyboard);
    }

    logToFile(`✅ Сообщение с платежом отправлено userId=${userId}`);
  } catch (error: any) {
    logToFile(
      `❌ ОШИБКА создания платежа: userId=${userId}, error=${error.message}, stack=${error.stack}`
    );
    console.error("Ошибка создания платежа:", error);

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback("Назад", backAction)],
    ]);

    if (useReply) {
      await ctx.reply(
        "❌ Ошибка создания платежа. Попробуйте позже.",
        keyboard
      );
    } else {
      await ctx.editMessageText(
        "❌ Ошибка создания платежа. Попробуйте позже.",
        keyboard
      );
    }
  }
}

async function showRefillAmountSelection(
  ctx: any,
  userStates: Map<number, UserState>,
  refillSource:
    | "photo"
    | "profile"
    | "music"
    | "restoration"
    | "colorize"
    | "dm"
    | "postcardPhoto"
    | "postcardChristmas"
    | "postcardText",
  useEdit: boolean = false
) {
  const userId = ctx.from?.id;
  if (!userId) return;

  const currentState = userStates.get(userId) || { step: null };
  userStates.set(userId, {
    ...currentState,
    refillSource,
    step: null,
    pendingPaymentAmount: undefined,
  });

  const refillMessage = `Выберите сумму для пополнения баланса ⤵️`;

  const backActions = {
    photo: "photo_animation",
    profile: "profile",
    music: "music_creation",
    restoration: "photo_restoration",
    colorize: "photo_colorize",
    dm: "ded_moroz",
    postcardPhoto: "postcard_photo",
    postcardText: "postcard_text",
    postcardChristmas: "postcard_christmas",
  };

  const keyboard = [
    [
      { text: "150₽", callback_data: "refill_150" },
      { text: "300₽", callback_data: "refill_300" },
      { text: "800₽", callback_data: "refill_800" },
      { text: "1600₽", callback_data: "refill_1600" },
    ],
    [{ text: "Назад", callback_data: backActions[refillSource] }],
  ];

  if (useEdit && refillSource !== "dm") {
    await ctx.editMessageText(refillMessage, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: keyboard,
      },
    });
  } else {
    await ctx.telegram.sendMessage(userId, refillMessage, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: keyboard,
      },
    });
  }
}

async function requestEmailOrProceed(
  ctx: any,
  amount: number,
  userStates: Map<number, UserState>,
  backAction: string
) {
  const userId = ctx.from?.id;
  if (!userId) return;

  const email = await Database.getUserEmail(userId);

  if (!email) {
    const currentState = userStates.get(userId) || { step: null };
    userStates.set(userId, {
      ...currentState,
      step: "waiting_email",
      pendingPaymentAmount: amount,
    });

    await ctx.editMessageText(
      "📧 Для создания платежа необходимо указать ваш email.\n\nПожалуйста, отправьте ваш email:",
      Markup.inlineKeyboard([[Markup.button.callback("Назад", backAction)]])
    );

    logToFile(`📧 Запрошен email у пользователя ${userId}`);
  } else {
    await showPaymentMessage(ctx, amount, userStates, backAction);
  }
}

export function registerPaymentHandlers(
  bot: Telegraf<BotContext>,
  userStates: Map<number, UserState>
) {
  bot.action("refill_balance", async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes("query is too old")) {
        console.error("Ошибка answerCbQuery:", error.message);
      }
    }

    const userId = ctx.from?.id;
    if (!userId) return;

    logToFile(`📝 refill_balance вызван: userId=${userId}`);

    const userState = userStates.get(userId);
    const useEdit = userState?.step === "waiting_email";

    await showRefillAmountSelection(ctx, userStates, "photo", useEdit);
  });

  bot.action("refill_balance_from_profile", async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes("query is too old")) {
        console.error("Ошибка answerCbQuery:", error.message);
      }
    }

    const userId = ctx.from?.id;
    if (!userId) return;

    logToFile(`📝 refill_balance_from_profile вызван: userId=${userId}`);

    await showRefillAmountSelection(ctx, userStates, "profile", false);
  });

  bot.action("refill_balance_from_postcard_christmas", async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes("query is too old")) {
        console.error("Ошибка answerCbQuery:", error.message);
      }
    }

    const userId = ctx.from?.id;
    if (!userId) return;

    logToFile(
      `📝 refill_balance_from_postcard_christmas вызван: userId=${userId}`
    );

    await showRefillAmountSelection(
      ctx,
      userStates,
      "postcardChristmas",
      false
    );
  });

  bot.action("refill_balance_from_postcard_text", async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes("query is too old")) {
        console.error("Ошибка answerCbQuery:", error.message);
      }
    }

    const userId = ctx.from?.id;
    if (!userId) return;

    logToFile(`📝 refill_balance_from_postcard_text вызван: userId=${userId}`);

    await showRefillAmountSelection(ctx, userStates, "postcardText", false);
  });

  bot.action("refill_balance_from_postcard_photo", async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes("query is too old")) {
        console.error("Ошибка answerCbQuery:", error.message);
      }
    }

    const userId = ctx.from?.id;
    if (!userId) return;

    logToFile(`📝 refill_balance_from_postcard_photo вызван: userId=${userId}`);

    await showRefillAmountSelection(ctx, userStates, "postcardPhoto", false);
  });

  bot.action("refill_balance_from_music", async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes("query is too old")) {
        console.error("Ошибка answerCbQuery:", error.message);
      }
    }

    const userId = ctx.from?.id;
    if (!userId) return;

    logToFile(`📝 refill_balance_from_music вызван: userId=${userId}`);

    await showRefillAmountSelection(ctx, userStates, "music", false);
  });

  bot.action("refill_balance_from_restoration", async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes("query is too old")) {
        console.error("Ошибка answerCbQuery:", error.message);
      }
    }

    const userId = ctx.from?.id;
    if (!userId) return;

    logToFile(`📝 refill_balance_from_restoration вызван: userId=${userId}`);

    await showRefillAmountSelection(ctx, userStates, "restoration", false);
  });

  bot.action("refill_balance_from_colorize", async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes("query is too old")) {
        console.error("Ошибка answerCbQuery:", error.message);
      }
    }

    const userId = ctx.from?.id;
    if (!userId) return;

    logToFile(`📝 refill_balance_from_colorize вызван: userId=${userId}`);

    await showRefillAmountSelection(ctx, userStates, "colorize", false);
  });

  bot.action("refill_balance_from_dm", async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes("query is too old")) {
        console.error("Ошибка answerCbQuery:", error.message);
      }
    }

    const userId = ctx.from?.id;
    if (!userId) return;

    logToFile(`📝 refill_balance_from_dm вызван: userId=${userId}`);

    await showRefillAmountSelection(ctx, userStates, "dm", false);
  });

  bot.action("refill_150", async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes("query is too old")) {
        console.error("Ошибка answerCbQuery:", error.message);
      }
    }

    const userId = ctx.from?.id;
    if (!userId) return;

    logToFile(`📝 refill_150 вызван: userId=${userId}`);

    const userState = userStates.get(userId);
    let backAction = "refill_balance";

    if (userState?.refillSource === "profile") {
      backAction = "refill_balance_from_profile";
    } else if (userState?.refillSource === "music") {
      backAction = "refill_balance_from_music";
    } else if (userState?.refillSource === "restoration") {
      backAction = "refill_balance_from_restoration";
    } else if (userState?.refillSource === "colorize") {
      backAction = "refill_balance_from_colorize";
    } else if (userState?.refillSource === "dm") {
      backAction = "refill_balance_from_dm";
    } else if (userState?.refillSource === "postcardText") {
      backAction = "refill_balance_from_postcard_text";
    } else if (userState?.refillSource === "postcardPhoto") {
      backAction = "refill_balance_from_postcard_photo";
    } else if (userState?.refillSource === "postcardChristmas") {
      backAction = "refill_balance_from_postcard_christmas";
    }
    await requestEmailOrProceed(ctx, 150, userStates, backAction);
  });

  bot.action("refill_300", async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes("query is too old")) {
        console.error("Ошибка answerCbQuery:", error.message);
      }
    }

    const userId = ctx.from?.id;
    if (!userId) return;

    logToFile(`📝 refill_300 вызван: userId=${userId}`);

    const userState = userStates.get(userId);
    let backAction = "refill_balance";

    if (userState?.refillSource === "profile") {
      backAction = "refill_balance_from_profile";
    } else if (userState?.refillSource === "music") {
      backAction = "refill_balance_from_music";
    } else if (userState?.refillSource === "restoration") {
      backAction = "refill_balance_from_restoration";
    } else if (userState?.refillSource === "colorize") {
      backAction = "refill_balance_from_colorize";
    } else if (userState?.refillSource === "dm") {
      backAction = "refill_balance_from_dm";
    } else if (userState?.refillSource === "postcardText") {
      backAction = "refill_balance_from_postcard_text";
    } else if (userState?.refillSource === "postcardPhoto") {
      backAction = "refill_balance_from_postcard_photo";
    } else if (userState?.refillSource === "postcardChristmas") {
      backAction = "refill_balance_from_postcard_christmas";
    }

    await requestEmailOrProceed(ctx, 300, userStates, backAction);
  });

  bot.action("refill_800", async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes("query is too old")) {
        console.error("Ошибка answerCbQuery:", error.message);
      }
    }

    const userId = ctx.from?.id;
    if (!userId) return;

    logToFile(`📝 refill_800 вызван: userId=${userId}`);

    const userState = userStates.get(userId);
    let backAction = "refill_balance";

    if (userState?.refillSource === "profile") {
      backAction = "refill_balance_from_profile";
    } else if (userState?.refillSource === "music") {
      backAction = "refill_balance_from_music";
    } else if (userState?.refillSource === "restoration") {
      backAction = "refill_balance_from_restoration";
    } else if (userState?.refillSource === "colorize") {
      backAction = "refill_balance_from_colorize";
    } else if (userState?.refillSource === "dm") {
      backAction = "refill_balance_from_dm";
    } else if (userState?.refillSource === "postcardText") {
      backAction = "refill_balance_from_postcard_text";
    } else if (userState?.refillSource === "postcardPhoto") {
      backAction = "refill_balance_from_postcard_photo";
    } else if (userState?.refillSource === "postcardChristmas") {
      backAction = "refill_balance_from_postcard_christmas";
    }

    await requestEmailOrProceed(ctx, 800, userStates, backAction);
  });

  bot.action("refill_1600", async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes("query is too old")) {
        console.error("Ошибка answerCbQuery:", error.message);
      }
    }

    const userId = ctx.from?.id;
    if (!userId) return;

    logToFile(`📝 refill_1600 вызван: userId=${userId}`);

    const userState = userStates.get(userId);
    let backAction = "refill_balance";

    if (userState?.refillSource === "profile") {
      backAction = "refill_balance_from_profile";
    } else if (userState?.refillSource === "music") {
      backAction = "refill_balance_from_music";
    } else if (userState?.refillSource === "restoration") {
      backAction = "refill_balance_from_restoration";
    } else if (userState?.refillSource === "colorize") {
      backAction = "refill_balance_from_colorize";
    } else if (userState?.refillSource === "dm") {
      backAction = "refill_balance_from_dm";
    } else if (userState?.refillSource === "postcardText") {
      backAction = "refill_balance_from_postcard_text";
    } else if (userState?.refillSource === "postcardPhoto") {
      backAction = "refill_balance_from_postcard_photo";
    } else if (userState?.refillSource === "postcardChristmas") {
      backAction = "refill_balance_from_postcard_christmas";
    }

    await requestEmailOrProceed(ctx, 1600, userStates, backAction);
  });

  bot.command("robokassa_pay", async (ctx) => {
    console.log("📝 robokassa_pay вызван");
    try {
      await ctx.answerCbQuery();
    } catch (error: any) {
      if (!error.description?.includes("query is too old")) {
        console.error("Ошибка answerCbQuery:", error.message);
      }
    }

    const userId = ctx.from?.id;
    if (!userId) return;

    const isAdmin = await Database.isAdmin(userId);
    if (!isAdmin) return;

    console.log(`📝 robokassa_pay вызван: userId=${userId}`);

    const userState = userStates.get(userId);
    // if (userState?.paymentAmount === undefined) {
    //   return;
    // }

    // const invoiceId = Date.now();
    // const amount = '5.00';

    // const crcString = `${process.env.MERCHANT_LOGIN}:${amount}:${invoiceId}:${process.env.ROBOKASSA_PASS_1}:Shp_user_id=${userId}`;
    // const crc = crypto.createHash('md5').update(crcString).digest('hex');

    // const paymentUrl =
    //   `https://auth.robokassa.ru/Merchant/Index.aspx` +
    //   `?MerchantLogin=${process.env.MERCHANT_LOGIN}` +
    //   `&OutSum=${amount}` +
    //   `&InvId=${invoiceId}` +
    //   `&SignatureValue=${crc}` +
    //   `&Shp_user_id=${userId}`;

    // await Database.savePendingPayment(userId, String(invoiceId), Number(amount));

    await ctx.telegram.sendMessage(
      userId,
      `💳 Оплата через Robokassa:\nhttp://localhost:5173/?ID=${userId}`,
      {
        parse_mode: "HTML",
      }
    );
  });
}

export { showPaymentMessage };
