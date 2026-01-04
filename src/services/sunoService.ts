import axios from "axios";
import { Buffer } from "buffer";
import { Markup } from "telegraf";
import { config } from "../config";
import { Database } from "../database";
import { MAIN_MENU_MESSAGE, mainMenuKeyboard, PRICES } from "../constants";

const API_URL = "https://api.kie.ai/api/v1";
const API_KEY = config.sunoApiKey;

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
    status:
      | "SUCCESS"
      | "FIRST_SUCCESS"
      | "TEXT_SUCCESS"
      | "PENDING"
      | "CREATE_TASK_FAILED"
      | "GENERATE_AUDIO_FAILED"
      | "CALLBACK_EXCEPTION"
      | "SENSITIVE_WORD_ERROR";
    response?: {
      sunoData: Array<{
        id: string;
        audioUrl: string;
        streamAudioUrl: string;
        imageUrl: string;
        prompt: string;
        title: string;
        tags: string;
        duration: number;
        createTime: string;
      }>;
    };
    errorMessage?: string;
  };
}

async function createMusicTask(
  prompt: string,
  style: string,
  instrumental: boolean
): Promise<string> {
  try {
    const response = await axios.post<TaskResponse>(
      `${API_URL}/generate`,
      {
        prompt: `${style} style: ${prompt}`,
        customMode: false,
        instrumental: instrumental,
        model: "V4_5",
        callBackUrl: config.callbackUrl,
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

async function checkTaskStatus(
  taskId: string
): Promise<TaskStatusResponse["data"]> {
  try {
    const response = await axios.get<TaskStatusResponse>(
      `${API_URL}/generate/record-info?taskId=${taskId}`,
      {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
        },
      }
    );

    if (response.data.code !== 200) {
      throw new Error(`API Error: ${response.data.msg}`);
    }

    return response.data.data;
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
    const status = await checkTaskStatus(taskId);

    console.log(
      `🎵 Статус задачи ${taskId}: ${status.status} (попытка ${
        attempt + 1
      }/${maxAttempts})`
    );

    if (status.status === "SUCCESS") {
      if (
        !status.response ||
        !status.response.sunoData ||
        status.response.sunoData.length === 0
      ) {
        throw new Error("Результат не найден");
      }

      const audioUrl = status.response.sunoData[0].audioUrl;
      if (!audioUrl) {
        throw new Error("URL аудио не найден");
      }

      return audioUrl;
    }

    if (status.status === "FIRST_SUCCESS") {
      if (
        !status.response ||
        !status.response.sunoData ||
        status.response.sunoData.length === 0
      ) {
        throw new Error("Результат не найден");
      }

      const audioUrl = status.response.sunoData[0].audioUrl;
      if (!audioUrl) {
        await new Promise((resolve) => setTimeout(resolve, 10000));
        continue;
      }

      return audioUrl;
    }

    if (
      status.status === "CREATE_TASK_FAILED" ||
      status.status === "GENERATE_AUDIO_FAILED" ||
      status.status === "CALLBACK_EXCEPTION" ||
      status.status === "SENSITIVE_WORD_ERROR"
    ) {
      throw new Error(
        `Генерация failed: ${status.errorMessage || status.status}`
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 10000));
  }

  throw new Error("Превышено время ожидания генерации");
}

export async function generateMusicWithSuno(
  prompt: string,
  style: string,
  instrumental: boolean = false
): Promise<string> {
  console.log(`🎵 Создаю музыку: ${style} стиль`);
  console.log(`💬 Тема: ${prompt}`);
  console.log(`🎹 Инструментальная: ${instrumental}`);

  const taskId = await createMusicTask(prompt, style, instrumental);
  console.log(`✅ Задача создана: ${taskId}`);

  const audioUrl = await waitForTaskCompletion(taskId);
  console.log(`✅ Аудио готово: ${audioUrl}`);

  return audioUrl;
}

export async function processMusicGeneration(
  ctx: any,
  userId: number,
  musicText: string,
  musicStyle: string,
  instrumental: boolean = false
) {
  try {
    const deducted = await Database.deductBalance(
      userId,
      PRICES.MUSIC_CREATION,
      "Создание музыки"
    );

    if (!deducted) {
      await ctx.telegram.sendMessage(
        userId,
        "❌ Недостаточно средств для генерации"
      );
      return;
    }

    console.log(`⏳ Начинается генерация музыки для пользователя ${userId}...`);

    const audioUrl = await generateMusicWithSuno(
      musicText,
      musicStyle,
      instrumental
    );

    const audioResponse = await axios.get(audioUrl, {
      responseType: "arraybuffer",
    });
    const audioBuffer = Buffer.from(audioResponse.data);

    const sentMessage = await ctx.telegram.sendAudio(
      userId,
      { source: audioBuffer },
      {
        caption: `✅ <b>Ваш трек готов!</b>\n\nСтиль: ${musicStyle}\nОписание:\n<blockquote><code>${musicText}</code></blockquote>`,
        parse_mode: "HTML",
      }
    );

    await Database.saveGeneratedFile(
      userId,
      "music",
      sentMessage.audio.file_id,
      musicText
    );

    console.log(`✅ Трек сгенерирован и сохранен для пользователя ${userId}`);
    console.log(`📁 File ID: ${sentMessage.audio.file_id}`);

    const mainMenuMessage = MAIN_MENU_MESSAGE;

    await ctx.telegram.sendMessage(userId, mainMenuMessage, {
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
      ...Markup.inlineKeyboard(mainMenuKeyboard),
    });
  } catch (error) {
    console.error("❌ Ошибка генерации музыки:", error);

    await Database.addBalance(
      userId,
      PRICES.MUSIC_CREATION,
      "Возврат средств за ошибку генерации",
      "bonus"
    );

    console.log(
      `💰 Возвращено ${PRICES.MUSIC_CREATION}₽ пользователю ${userId}`
    );

    await ctx.telegram.sendMessage(
      userId,
      "❌ Произошла ошибка при создании трека. Средства возвращены на баланс."
    );
  }
}
