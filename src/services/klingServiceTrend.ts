import axios from "axios";
import fs from "fs";
import { tmpdir } from "os";
import { v4 as uuidv4 } from "uuid";
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
import path from "path";

const API_URL = "https://api.kie.ai/api/v1/jobs";
const API_KEY = config.klingApiKey;

const VIDEO_URL =
  "https://api.telegram.org/file/bot7949029273:AAGErbSImETPQg6zeVaTRG_099ta5UtUIhk/documents/file_231.mp4";
const PROMPT =
  "Character dancing exactly to the rhythm of the provided song, precise beat synchronization, joyful expressions, smooth natural movements, realistic body motion, high resolution, social media reel style. Maintain full visibility of all limbs at all times, hands and feet fully tracked, no disappearing limbs, no floating or jittering parts, preserve natural anatomy, motion control focused, continuous body connection, stable poses, follow beats strictly, avoid exaggeration. Negative prompt: floating limbs, missing arms, missing legs, broken anatomy, jittery motion, ghosted hands, ghosted feet, unstable poses, exaggerated movements.";

interface TaskStatusResponse {
  code: number;
  msg: string;
  data: {
    taskId: string;
    state: "waiting" | "queuing" | "generating" | "success" | "fail";
    resultJson?: string;
    failCode?: string;
    failMsg?: string;
  };
}

const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
ffmpeg.setFfmpegPath(ffmpegPath);
console.log(`✅ FFmpeg путь: ${ffmpegPath}`);

export async function CreateVideoTask(imageUrl: string): Promise<string> {
  const payload = {
    model: "kling-2.6/motion-control",
    input: {
      mode: "720p",
      video_urls: [VIDEO_URL],
      input_urls: [imageUrl],
      character_orientation: "video",
      prompt: PROMPT,
    },
  };

  console.log(
    "📤 Kling CreateVideoTask payload:\n",
    JSON.stringify(payload, null, 2)
  );

  const response = await axios.post(`${API_URL}/createTask`, payload, {
    headers: {
      Authorization: `Bearer ${process.env.KLING_API_KEY}`,
      "Content-Type": "application/json",
    },
    timeout: 30000,
  });

  const data = response.data;

  if (data.code !== 200) {
    console.error("❌ Kling create task failed:", data);
    throw new Error(`Kling API error: ${data.msg || "unknown error"}`);
  }

  if (!data.data?.taskId) {
    console.error("❌ Kling taskId missing:", data);
    throw new Error("Kling API did not return taskId");
  }

  console.log("✅ Kling task created:", data.data.taskId);

  return data.data.taskId;
}

async function checkTaskStatus(
  taskId: string
): Promise<TaskStatusResponse["data"]> {
  try {
    const response = await axios.get<TaskStatusResponse>(
      `${API_URL}/recordInfo`,
      {
        params: { taskId },
        headers: { Authorization: `Bearer ${API_KEY}` },
        timeout: 30_000,
      }
    );

    if (response.data.code !== 200) {
      throw new Error(
        `Kling recordInfo error (code=${response.data.code}): ${
          response.data.msg || "no message"
        }`
      );
    }

    const data = response.data.data;

    if (!data?.state) {
      throw new Error("Kling recordInfo: missing state field");
    }

    if (data.state === "fail") {
      throw new Error(
        `Kling generation failed (${data.failCode || "no_code"}): ${
          data.failMsg || "no message"
        }`
      );
    }

    return data;
  } catch (error: any) {
    console.error("❌ Kling recordInfo failed");

    if (error.response) {
      console.error("📡 HTTP status:", error.response.status);
      console.error(
        "📦 Response body:",
        JSON.stringify(error.response.data, null, 2)
      );
      throw new Error(
        `Kling recordInfo HTTP ${error.response.status}: ${
          error.response.data?.msg || "unknown error"
        }`
      );
    }

    throw error;
  }
}

async function waitForTaskCompletion(
  taskId: string,
  maxAttempts: number = 20
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const status = await checkTaskStatus(taskId);

    console.log(
      `📊 Статус задачи ${taskId}: ${status.state} (попытка ${
        attempt + 1
      }/${maxAttempts})`
    );

    if (status.state === "success") {
      if (!status.resultJson) throw new Error("Результат не найден");

      const result = JSON.parse(status.resultJson);
      if (!result.resultUrls || result.resultUrls.length === 0)
        throw new Error("URL видео не найден");

      return result.resultUrls[0];
    }

    if (status.state === "fail")
      throw new Error(`Генерация failed: ${status.failMsg || "Unknown error"}`);

    await new Promise((resolve) => setTimeout(resolve, 60000));
  }

  throw new Error("Превышено время ожидания генерации");
}

export async function generateTrendVideoWithKling(
  imageUrl: string
): Promise<string> {
  console.log(`📸 Создаю трендовое видео по фото: ${imageUrl}`);

  const taskId = await CreateVideoTask(imageUrl);
  console.log(`✅ Задача создана: ${taskId}`);

  const videoUrl = await waitForTaskCompletion(taskId);
  console.log(`✅ Видео готово: ${videoUrl}`);

  return videoUrl;
}

async function getFileSizeMB(filePath: string): Promise<number> {
  const stats = await fs.promises.stat(filePath);
  return stats.size / (1024 * 1024);
}

async function compressVideo(
  inputPath: string,
  outputPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`🎬 Начинаю сжатие видео: ${inputPath} -> ${outputPath}`);

    ffmpeg(inputPath)
      .outputOptions([
        "-c:v",
        "libx264",
        "-crf",
        "25",
        "-preset",
        "medium",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-movflags",
        "+faststart",
        "-vf",
        "scale=720:-2",
        "-f",
        "mp4",
      ])
      .output(outputPath)
      .on("start", (commandLine: string) => {
        console.log(`🚀 Команда ffmpeg: ${commandLine}`);
      })
      .on("progress", (progress: any) => {
        if (progress.percent) {
          console.log(`📊 Прогресс сжатия: ${progress.percent.toFixed(1)}%`);
        }
      })
      .on("end", () => {
        console.log("✅ Сжатие видео завершено");
        resolve();
      })
      .on("error", (err: Error, stdout: string, stderr: string) => {
        console.error("❌ Ошибка при сжатии видео:", err.message);
        console.error("📋 STDOUT:", stdout);
        console.error("📋 STDERR:", stderr);
        reject(err);
      })
      .run();
  });
}

async function sendVideoWithRetry(
  ctx: any,
  userId: number,
  filePath: string,
  caption: string,
  maxAttempts: number = 5,
  delayMs: number = 10000
): Promise<any> {
  const originalSize = await getFileSizeMB(filePath);
  console.log(`📦 Размер оригинального видео: ${originalSize.toFixed(2)} MB`);

  let finalFilePath = filePath;

  if (originalSize > 48) {
    console.log("🎬 Видео слишком большое, запускаю сжатие...");
    const compressedPath = path.join(tmpdir(), `${uuidv4()}_compressed.mp4`);

    try {
      await compressVideo(filePath, compressedPath);
      const compressedSize = await getFileSizeMB(compressedPath);
      console.log(`✅ Видео сжато до: ${compressedSize.toFixed(2)} MB`);

      if (compressedSize > 48) {
        console.log(
          `⚠️ После сжатия видео все еще большое (${compressedSize.toFixed(
            2
          )} MB), использую оригинал`
        );
        fs.unlinkSync(compressedPath);
      } else {
        finalFilePath = compressedPath;
      }
    } catch (error) {
      console.error("❌ Ошибка сжатия видео, использую оригинал:", error);
    }
  }

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      console.log(
        `📤 Попытка отправки видео (${attempt + 1}/${maxAttempts})...`
      );

      const currentSize = await getFileSizeMB(finalFilePath);
      console.log(`📦 Размер файла для отправки: ${currentSize.toFixed(2)} MB`);

      const sentMessage = await ctx.telegram.sendVideo(
        userId,
        { source: fs.createReadStream(finalFilePath) },
        {
          caption,
          parse_mode: "HTML",
          supports_streaming: true,
          disable_notification: false,
          protect_content: false,
        }
      );

      console.log("✅ Видео успешно отправлено");

      if (finalFilePath !== filePath && fs.existsSync(finalFilePath)) {
        fs.unlink(finalFilePath, () => {
          console.log("🗑️ Удален временный сжатый файл");
        });
      }

      return sentMessage;
    } catch (error: any) {
      console.error(
        `❌ Ошибка отправки видео пользователю ${userId} (попытка ${
          attempt + 1
        }/${maxAttempts}):`,
        error.message
      );

      if (error.response?.error_code === 413 && finalFilePath === filePath) {
        console.log(
          "🔄 Видео все еще слишком большое, пробую дополнительное сжатие..."
        );
        const strongerCompressedPath = path.join(
          tmpdir(),
          `${uuidv4()}_strong_compressed.mp4`
        );

        try {
          await new Promise((resolve, reject) => {
            ffmpeg(filePath)
              .outputOptions([
                "-c:v",
                "libx264",
                "-crf",
                "32",
                "-preset",
                "fast",
                "-c:a",
                "aac",
                "-b:a",
                "96k",
                "-movflags",
                "+faststart",
                "-vf",
                "scale=720:-2",
                "-f",
                "mp4",
              ])
              .output(strongerCompressedPath)
              .on("end", resolve)
              .on("error", reject)
              .run();
          });

          const strongerSize = await getFileSizeMB(strongerCompressedPath);
          console.log(`✅ Сильное сжатие до: ${strongerSize.toFixed(2)} MB`);
          finalFilePath = strongerCompressedPath;
        } catch (compressError) {
          console.error("❌ Ошибка дополнительного сжатия:", compressError);
        }
      }

      if (attempt < maxAttempts - 1) {
        console.log(
          `⏳ Ожидание ${delayMs / 1000} секунд перед повторной попыткой...`
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      } else {
        if (finalFilePath !== filePath && fs.existsSync(finalFilePath)) {
          fs.unlink(finalFilePath, () => {});
        }
        throw new Error("Не удалось отправить видео после нескольких попыток");
      }
    }
  }
}

export async function processTrendVideoGeneration(
  ctx: any,
  userId: number,
  photoFileId: string
) {
  try {
    const deducted = await Database.deductBalance(
      userId,
      PRICES.PHOTO_ANIMATION,
      "Создание трендового видео"
    );
    if (!deducted) {
      await ctx.telegram.sendMessage(
        userId,
        "❌ Недостаточно средств для генерации"
      );
      return;
    }

    console.log(
      `⏳ Начинается генерация трендового видео для пользователя ${userId}...`
    );
    if (await isSubscribed(userId)) {
      await ctx.reply("⏳ Начинаю генерацию... Это займет около 15 минут.", {
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
      });
    } else {
      await ctx.reply(
        "⏳ Начинаю генерацию... Это займет около 15 минут.\n\n<b>Следите за обновлениями в нашем Telegram-канале:</b>\nhttps://t.me/+4gfCmvy5mS82NjAy",
        { parse_mode: "HTML", link_preview_options: { is_disabled: true } }
      );
    }

    const photoUrl = await ctx.telegram.getFileLink(photoFileId);
    const photoUrlString = photoUrl.href;
    console.log(`📸 URL фото: ${photoUrlString}`);

    const videoUrl = await generateTrendVideoWithKling(photoUrlString);

    const tmpFilePath = path.join(tmpdir(), `${uuidv4()}.mp4`);
    const videoResponse = await axiosRetry(videoUrl, 5, {
      responseType: "stream",
      timeout: 60000,
    });
    if (!videoResponse) throw new Error("Видео не загрузилось");

    const writer = fs.createWriteStream(tmpFilePath);
    videoResponse.data.pipe(writer);
    await new Promise<void>((resolve, reject) => {
      writer.on("finish", () => resolve());
      writer.on("error", (err) => reject(err));
    });

    const originalSize = await getFileSizeMB(tmpFilePath);
    console.log(`📊 Размер скачанного видео: ${originalSize.toFixed(2)} MB`);

    const caption = `✅ <b>Ваше видео готово!</b>`;

    const sentMessage = await sendVideoWithRetry(
      ctx,
      userId,
      tmpFilePath,
      caption
    );

    await Database.saveGeneratedFile(
      userId,
      "trend_video",
      sentMessage.video.file_id
    );

    console.log(
      `✅ Трендовое видео сгенерировано и сохранено для пользователя ${userId}`
    );
    console.log(`📁 Video File ID: ${sentMessage.video.file_id}`);

    let mainMenuMessage = MAIN_MENU_MESSAGE;
    if (!(await isSubscribed(userId)))
      mainMenuMessage += TELEGRAM_CHANNEL_MESSAGE;

    await ctx.telegram.sendMessage(userId, mainMenuMessage, {
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
      ...Markup.inlineKeyboard(mainMenuKeyboard),
    });

    if (fs.existsSync(tmpFilePath)) {
      fs.unlink(tmpFilePath, () => {
        console.log("🗑️ Удален оригинальный временный файл");
      });
    }
  } catch (error) {
    console.error("❌ Ошибка генерации видео:", error);
    await Database.addBalance(
      userId,
      PRICES.PHOTO_ANIMATION,
      "Возврат средств за ошибку генерации",
      "bonus"
    );
    console.log(
      `💰 Возвращено ${PRICES.PHOTO_ANIMATION}₽ пользователю ${userId}`
    );
    await ctx.telegram.sendMessage(
      userId,
      "❌ Произошла ошибка при генерации. Средства возвращены на баланс."
    );
  }
}
