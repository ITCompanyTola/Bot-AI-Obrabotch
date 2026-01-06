import axios from "axios";
import { Buffer } from "buffer";
import { Markup } from "telegraf";
import { config } from "../config";
import { Database } from "../database";
import {
  MAIN_MENU_MESSAGE,
  mainMenuKeyboard,
  PRICES,
  TELEGRAM_CHANNEL_MESSAGE,
} from "../constants";
import { axiosRetry } from "../utils/axiosRetry";
import { isSubscribed } from "../utils/isSubscribed";

const API_URL = "https://api.kie.ai/api/v1/jobs";
const API_KEY = config.nanoBananaApiKey;

const MODEL = "flux-2/flex-text-to-image";

interface TaskResponse {
  code: number;
  message: number;
  data: {
    taskId: string;
  };
}

interface TaskStatusResponse {
  code: number;
  message: string;
  data: {
    taskId: string;
    model: string;
    state: "waiting" | "queuing" | "generating" | "success" | "fail";
    resultJson?: string;
    failCode?: string;
    failMsg?: string;
  };
}

async function createColorizeTask(prompt: string): Promise<string> {
  try {
    const response = await axios.post<TaskResponse>(
      `${API_URL}/createTask`,
      {
        model: MODEL,
        input: {
          prompt: prompt,
          aspect_ratio: "1:1",
          resolution: "1K",
        },
      },
      {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data.code !== 200) {
      throw new Error(`API Error: ${response.data.message}`);
    }

    return response.data.data.taskId;
  } catch (error) {
    console.error("Ошибка создания задачи на создание открытки: ", error);
    throw error;
  }
}

async function checkColorizeTaskStatus(
  taskId: string
): Promise<TaskStatusResponse["data"]> {
  try {
    const response = await axios.get(`${API_URL}/recordInfo?taskId=${taskId}`, {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
      },
    });

    if (response.data.code !== 200) {
      console.error("Error code:", response.data.code);
      console.error(response.data.data.failMsg);
      throw new Error(`API Error: ${response.data.message}`);
    }

    return response.data.data;
  } catch (error) {
    console.error("Ошибка проверки статуса создания открытки:", error);
    throw error;
  }
}

async function waitForColorizeTaskCompletion(
  taskId: string,
  maxAttempts: number = 50
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const status = await checkColorizeTaskStatus(taskId);

    console.log(
      `📊 Статус задачи ${taskId}: ${status.state} (попытка ${
        attempt + 1
      }/${maxAttempts})`
    );

    if (status.state === "success") {
      if (!status.resultJson) {
        throw new Error("Результат не найден");
      }

      const result = JSON.parse(status.resultJson);
      if (!result.resultUrls || result.resultUrls.length === 0) {
        throw new Error("URL фото не найден");
      }

      return result.resultUrls[0];
    }

    if (status.state === "fail") {
      throw new Error(`Генерация failed: ${status.failMsg || "Unknown error"}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  throw new Error("Превышено время ожидания генерации");
}

async function generatePhotoWithFlux(prompt: string): Promise<string> {
  console.log(`📸 Создаю открытку`);
  console.log(`💬 С описанием: ${prompt}`);

  const taskId = await createColorizeTask(prompt);
  console.log(`✅ Задача создана: ${taskId}`);

  const photoUrl = await waitForColorizeTaskCompletion(taskId);
  console.log(`✅ Открытка готово: ${photoUrl}`);

  return photoUrl;
}

export async function processPostcardCreation(
  ctx: any,
  userId: number,
  prompt: string
) {
  try {
    const deducted = await Database.deductBalance(
      userId,
      PRICES.POSTCARD_TEXT,
      "Создание открытки"
    );

    if (!deducted) {
      await ctx.telegram.sendMessage(
        userId,
        "❌ Недостаточно средств для генерации"
      );
      return;
    }

    console.log(
      `⏳ Начинается создание открытки для пользователя ${userId}...`
    );

    if (await isSubscribed(userId)) {
      await ctx.editMessageText(
        "⏳ Начинаю генерацию... Это займет около 3-х минут.",
        {
          parse_mode: "HTML",
          link_preview_options: { is_disabled: true },
        }
      );
    } else {
      await ctx.editMessageText(
        "⏳ Начинаю генерацию... Это займет около 3-х минут.\n\n<b>Следите за обновлениями в нашем Telegram-канале:</b>\nhttps://t.me/ai_lumin",
        {
          parse_mode: "HTML",
          link_preview_options: { is_disabled: true },
        }
      );
    }

    const colorizedPhotoUrl = await generatePhotoWithFlux(prompt);

    const photoResponse = await axiosRetry(colorizedPhotoUrl, 5);
    if (photoResponse == null) {
      throw new Error("Фото не загрузилось");
    }
    const photoBuffer = Buffer.from(photoResponse.data);

    const caption = `✅ <b>Ваша открытка готова!</b>`.trim();
    const sentMessage = await ctx.telegram.sendPhoto(
      userId,
      { source: photoBuffer },
      {
        caption: caption,
        parse_mode: "HTML",
      }
    );

    const fileId = sentMessage.photo[sentMessage.photo.length - 1].file_id;
    await Database.saveGeneratedFile(userId, "postcard_text", fileId, prompt);

    console.log(
      `✅ Открытка из текста сгенерирована и сохранена для пользователя ${userId}`
    );
    console.log(`📁 File ID: ${fileId}`);

    let mainMenuMessage = MAIN_MENU_MESSAGE;

    if (!(await isSubscribed(userId))) {
      mainMenuMessage += TELEGRAM_CHANNEL_MESSAGE;
    }

    await ctx.telegram.sendMessage(userId, mainMenuMessage, {
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
      ...Markup.inlineKeyboard(mainMenuKeyboard),
    });
  } catch (error) {
    console.error("❌ Ошибка генерации открытки:", error);

    await Database.addBalance(
      userId,
      PRICES.POSTCARD_TEXT,
      "Возврат средств за ошибку генерации",
      "bonus"
    );

    console.log(
      `💰 Возвращено ${PRICES.POSTCARD_TEXT}₽ пользователю ${userId}`
    );

    await ctx.telegram.sendMessage(
      userId,
      "❌ Произошла ошибка при генерации. Средства возвращены на баланс."
    );
  }
}
