import { Database } from "../database";
import {
  MAIN_MENU_MESSAGE,
  mainMenuKeyboard,
  POSTCARD_CHRISTMAS_PROMPT,
  POSTCARD_PHOTO_PROMPT,
  PRICES,
  TELEGRAM_CHANNEL_MESSAGE,
} from "../constants";

import fs from "fs";
import path from "path";
import axios from "axios";
import OpenAI, { toFile } from "openai";
import { Markup } from "telegraf";

import { File } from "node:buffer";
(globalThis as any).File = File;

import { ProxyAgent } from "undici";
import { isSubscribed } from "../utils/isSubscribed";

export const openAIProxyAgent = process.env.HTTPS_PROXY_FOR_OPENAI
  ? new ProxyAgent(process.env.HTTPS_PROXY_FOR_OPENAI)
  : undefined;

if (openAIProxyAgent) {
  console.log("🟢 OpenAI proxy enabled");
} else {
  console.log("🟡 OpenAI proxy NOT set");
}

export async function generatePostcard(
  ctx: any,
  userId: number,
  photoFileId: string,
  postcardType: "photo" | "christmas"
): Promise<void> {
  const tempImagePath = path.join(process.cwd(), `temp_${userId}.png`);
  const resultPath = path.join(process.cwd(), `postcard_${userId}.png`);

  console.log("🟡 [1] generatePostcard START", { userId });

  try {
    console.log("🟡 [2] Deducting balance...");
    const deductedBalance =
      postcardType === "photo"
        ? PRICES.POSTCARD_PHOTO
        : PRICES.POSTCARD_CHRISTMAS;

    const deducted = await Database.deductBalance(
      userId,
      deductedBalance,
      "Создание открытки"
    );

    if (!deducted) {
      console.log("🔴 [2.1] Not enough balance");
      await ctx.telegram.sendMessage(userId, "❌ Недостаточно средств");
      return;
    }

    console.log("🟢 [3] Balance deducted");

    if (await isSubscribed(userId)) {
      await ctx.reply("⏳ Начинаю генерацию... Это займет около 3-х минут.", {
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
      });
    } else {
      await ctx.reply(
        "⏳ Начинаю генерацию... Это займет около 3-х минут.\n\n<b>Следите за обновлениями в нашем Telegram-канале:</b>\nhttps://t.me/+4gfCmvy5mS82NjAy",
        {
          parse_mode: "HTML",
          link_preview_options: { is_disabled: true },
        }
      );
    }

    console.log("🟡 [4] Creating OpenAI client");
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      fetch: (url, options) => {
        return fetch(url, {
          ...options,
          dispatcher: openAIProxyAgent, // 👈 ПРОКСИ
        });
      },
    });

    console.log("🟡 [5] Getting Telegram file link");
    const photoUrl = await ctx.telegram.getFileLink(photoFileId);
    console.log("🟢 [5.1] Photo URL:", photoUrl.href);

    console.log("🟡 [6] Downloading image from Telegram");
    const imageResponse = await axios.get(photoUrl.href, {
      responseType: "arraybuffer",
      timeout: 30_000,
    });

    console.log(
      "🟢 [6.1] Image downloaded, size:",
      imageResponse.data.byteLength
    );

    fs.writeFileSync(tempImagePath, imageResponse.data);
    console.log("🟢 [7] Temp image saved:", tempImagePath);

    console.log("🟡 [8] Sending image to OpenAI (images.edit)");
    console.time("🧠 OpenAI image edit");

    const usedPrompt =
      postcardType === "photo"
        ? POSTCARD_PHOTO_PROMPT
        : POSTCARD_CHRISTMAS_PROMPT;

    const response = await openai.images.edit({
      model: "chatgpt-image-latest",
      image: await toFile(fs.createReadStream(tempImagePath), null, {
        type: "image/jpeg",
      }),
      prompt: usedPrompt,
    });

    console.timeEnd("🧠 OpenAI image edit");
    console.log("🟢 [9] OpenAI responded");

    if (!response.data || response.data.length === 0) {
      throw new Error("OpenAI вернул пустой data[]");
    }

    const imageBase64 = response.data[0].b64_json;
    if (!imageBase64) {
      throw new Error("b64_json отсутствует");
    }

    console.log("🟢 [10] Decoding base64");
    const imageBuffer = Buffer.from(imageBase64, "base64");
    fs.writeFileSync(resultPath, imageBuffer);

    console.log("🟢 [11] Result image saved:", resultPath);

    console.log("🟡 [12] Sending photo to Telegram");
    const sentMessage = await ctx.telegram.sendPhoto(
      userId,
      { source: fs.createReadStream(resultPath) },
      {
        caption: "✅ <b>Ваша открытка готова!</b>",
        parse_mode: "HTML",
      }
    );

    console.log("🟢 [13] Photo sent");

    const fileId = sentMessage.photo.at(-1)?.file_id;
    console.log("🟢 [14] Telegram file_id:", fileId);
    if (postcardType === "photo") {
      await Database.saveGeneratedFile(
        userId,
        "postcard_photo",
        fileId,
        usedPrompt
      );
    } else {
      await Database.saveGeneratedFile(
        userId,
        "postcard_christmas",
        fileId,
        usedPrompt
      );
    }

    console.log("🟢 [15] Saved to DB");

    let mainMenuMessage = MAIN_MENU_MESSAGE;

    if (!(await isSubscribed(userId))) {
      mainMenuMessage += TELEGRAM_CHANNEL_MESSAGE;
    }

    await ctx.telegram.sendMessage(userId, mainMenuMessage, {
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
      ...Markup.inlineKeyboard(mainMenuKeyboard),
    });

    fs.unlinkSync(tempImagePath);
    fs.unlinkSync(resultPath);

    console.log("✅ [16] DONE");
  } catch (error) {
    console.error("❌ ERROR:", error);

    const addedBalance =
      postcardType === "photo"
        ? PRICES.POSTCARD_PHOTO
        : PRICES.POSTCARD_CHRISTMAS;

    await Database.addBalance(
      userId,
      addedBalance,
      "Возврат средств за ошибку генерации",
      "bonus"
    );

    await ctx.telegram.sendMessage(
      userId,
      "❌ Произошла ошибка при генерации. Средства возвращены."
    );
  }
}
