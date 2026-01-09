import axios from "axios";
import { Buffer } from "buffer";
import { Markup } from "telegraf";
import { config } from "../config";
import { Database } from "../database";
import {
  getDedMorozVideoPrompt,
  MAIN_MENU_MESSAGE,
  mainMenuKeyboard,
  PRICES,
  TELEGRAM_CHANNEL_MESSAGE,
} from "../constants";
import { axiosRetry } from "../utils/axiosRetry";
import { redisStateService } from "../redis-state.service";
import { isSubscribed } from "../utils/isSubscribed";

const API_URL = "https://api.kie.ai/api/v1/veo";
const API_KEY = config.klingApiKey;

interface TaskResponse {
  code: number;
  msg: string;
  data: {
    taskId: string;
  };
}

interface TaskStatusResponse {
  code: number;
  msg: string;
  data: {
    taskId: string;
    state: "waiting" | "queuing" | "generating" | "success" | "fail";
    response: {
      resultUrls: string[];
    };
    errorCode: number;
    errorMessage: string;
    successFlag: number;
  };
}

async function createVideoTask(
  imageUrl: string,
  prompt: string
): Promise<string> {
  const imageUrls = [];
  imageUrls.push(imageUrl);
  console.log(imageUrls);
  try {
    const response = await axios.post<TaskResponse>(
      `${API_URL}/generate`,
      {
        model: "veo3_fast",
        imageUrls: imageUrls,
        prompt: prompt,
        aspectRatio: "Auto",
      },
      {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data.code !== 200) {
      throw new Error(`API Error: ${response.data.msg}`);
    }

    return response.data.data.taskId;
  } catch (error) {
    console.error("Ошибка создания задачи:", error);
    throw error;
  }
}

async function checkTaskStatus(taskId: string): Promise<TaskStatusResponse> {
  try {
    // добавить систему retry, чтобы не терять загруженное видео
    const response = await axios.get<TaskStatusResponse>(
      `${API_URL}/record-info?taskId=${taskId}`,
      {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
        },
      }
    );

    if (response.data.code !== 200) {
      console.error("Error code:", response.data.code);
      throw new Error(`API Error: ${response.data.data.errorMessage}`);
    }

    return response.data;
  } catch (error) {
    console.error("Ошибка проверки статуса:", error);
    throw error;
  }
}

async function waitForTaskCompletion(
  taskId: string,
  maxAttempts: number = 60
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await checkTaskStatus(taskId);

    console.log(
      `📊 Статус задачи ${taskId}: ${response.msg} (попытка ${
        attempt + 1
      }/${maxAttempts})`
    );

    if (response.data.successFlag === 1) {
      if (!response.data.response.resultUrls) {
        throw new Error("Результат не найден");
      }

      const result = response.data.response;
      console.log(result);
      if (!result || result.resultUrls.length === 0) {
        throw new Error("URL видео не найден");
      }

      return result.resultUrls[0];
    }

    if (response.data.successFlag === 2 || response.data.successFlag === 3) {
      throw new Error(
        `Генерация failed: ${response.data.errorMessage || "Unknown error"}`
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  throw new Error("Превышено время ожидания генерации");
}

export async function generateVideoWithVeo(
  imageUrl: string,
  prompt: string
): Promise<string> {
  console.log(`📸 Оживляю фото Деда Мороза: ${imageUrl}`);
  console.log(`💬 С описанием: ${prompt}`);

  const taskId = await createVideoTask(imageUrl, prompt);
  console.log(`✅ Задача создана: ${taskId}`);

  const videoUrl = await waitForTaskCompletion(taskId);
  console.log(`✅ Видео готово: ${videoUrl}`);

  return videoUrl;
}

export async function processVideoDMGeneration(
  ctx: any,
  userId: number,
  photoFileId: string,
  prompt: string
) {
  try {
    const deducted = await Database.deductBalance(
      userId,
      PRICES.DED_MOROZ,
      "Создание Деда Мороза"
    );

    if (!deducted) {
      await ctx.telegram.sendMessage(
        userId,
        "❌ Недостаточно средств для генерации"
      );
      return;
    }

    console.log(`⏳ Начинается генерация видео для пользователя ${userId}...`);

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

    const photoUrl = await ctx.telegram.getFileLink(photoFileId);
    console.log(`📸 URL фото: ${photoUrl.href}`);

    const newPrompt = getDedMorozVideoPrompt(prompt);

    const videoUrl = await generateVideoWithVeo(photoUrl.href, newPrompt);

    const videoResponse = await axiosRetry(videoUrl, 5, {
      responseType: "arraybuffer",
    });
    if (videoResponse == null) {
      throw new Error("Видео не загрузилось");
    }
    const videoBuffer = Buffer.from(videoResponse.data);

    const caption =
      `✅ <b>Ваше поздравление готово!</b>\n\nОписание:\n<blockquote><code>${prompt}</code></blockquote>`.trim();
    const message =
      caption +
      `\n\nЕсли вам нужна помощь в создании <b><i>полноценного новогоднего поздравления от Деда Мороза</i></b>, вы можете обратиться в нашу службу технической поддержки — <a href="https://t.me/obrabotych_support">@obrabotych_support</a>`;
    const sentMessage = await ctx.telegram.sendVideo(
      userId,
      { source: videoBuffer },
      {
        caption: message,
        parse_mode: "HTML",
      }
    );

    await Database.saveGeneratedFile(
      userId,
      "dm_video",
      sentMessage.video.file_id,
      prompt
    );
    await Database.saveGeneratedFile(
      userId,
      "dm_photo",
      photoFileId,
      "Дед Мороз"
    );

    console.log(
      `✅ Видео сгенерировано и сохранено для пользователя ${userId}`
    );
    console.log(`📁 File ID: ${sentMessage.video.file_id}`);

    await redisStateService.delete(userId);

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
    console.error("❌ Ошибка генерации видео:", error);

    await Database.addBalance(
      userId,
      PRICES.DED_MOROZ,
      "Возврат средств за ошибку генерации",
      "bonus"
    );

    console.log(`💰 Возвращено ${PRICES.DED_MOROZ}₽ пользователю ${userId}`);

    await ctx.telegram.sendMessage(
      userId,
      "❌ Произошла ошибка при генерации. Средства возвращены на баланс."
    );
  }
}
