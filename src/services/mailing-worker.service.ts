import Bull from "bull";
import { Telegraf } from "telegraf";
import { config } from "../config";
import { Database } from "../database";
import { MailingJobData, MailingProgress } from "../types";

export class MailingWorker {
  private bot!: Telegraf;
  private queue!: Bull.Queue;
  private isProcessing = false;
  private readonly CHUNK_SIZE = 100;
  private readonly DELAY_BETWEEN_MESSAGES = 500;
  private readonly PROGRESS_UPDATE_INTERVAL = 1000;

  constructor() {
    // Создаем отдельный экземпляр бота для воркера
    this.bot = new Telegraf(config.botToken);
    this.setupQueue();
    this.setupWorker();
  }

  private setupQueue(): void {
    this.queue = new Bull("mailing", {
      redis: {
        host: process.env.REDIS_HOST || "redis",
        port: parseInt(process.env.REDIS_PORT || "6379"),
      },
      defaultJobOptions: {
        attempts: 1,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    });

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.queue.on("completed", (job) => {
      console.log(`✅ Задача рассылки ${job.id} завершена`);
    });

    this.queue.on("failed", (job, error) => {
      console.error(`❌ Задача рассылки ${job?.id} упала:`, error.message);
    });

    this.queue.on("stalled", (job) => {
      console.warn(`⚠️ Задача рассылки ${job.id} зависла`);
    });

    this.queue.on("error", (error) => {
      console.error("❌ Ошибка очереди Redis:", error);
    });
  }

  private setupWorker(): void {
    this.queue.process(async (job) => {
      if (this.isProcessing) {
        console.log("⚠️ Воркер уже занят, пропускаем задачу");
        return;
      }

      this.isProcessing = true;
      try {
        console.log(`Начата обработка задачи ${job.id}`);
        await this.processMailingJob(job.data);
        console.log(`✅ Задача ${job.id} успешно обработана`);
      } catch (error) {
        console.error(
          `❌ Критическая ошибка при обработке задачи ${job.id}:`,
          error
        );
        throw error;
      } finally {
        this.isProcessing = false;
      }
    });

    console.log("Воркер запущен и ожидает задач...");
  }

  private async processMailingJob(data: MailingJobData): Promise<void> {
    const {
      mailingId,
      adminId,
      chunkSize = this.CHUNK_SIZE,
      delayBetweenMessages = this.DELAY_BETWEEN_MESSAGES,
    } = data;

    console.log(`📤 Обработка рассылки ID: ${mailingId}`);

    const mailing = await Database.getMailingData(mailingId);
    if (!mailing) {
      console.error(`❌ Рассылка ${mailingId} не найдена`);
      await this.notifyAdmin(adminId, `❌ Рассылка не найдена`);
      return;
    }

    const totalUsers = await Database.getTotalUsersCount();
    let processed = 0;
    let progress: MailingProgress = { sent: 0, failed: 0, blocked: 0 };

    // Обновляем общее количество пользователей
    await Database.updateMailingStats(mailingId, {
      total_users: totalUsers,
    });

    // Отправляем начальное уведомление
    await this.notifyAdmin(
      adminId,
      `Начата рассылка #${mailingId}\n` +
        `👥 Всего пользователей: ${totalUsers}\n` +
        `💬 Сообщение: ${mailing.message.substring(0, 50)}${
          mailing.message.length > 50 ? "..." : ""
        }`
    );

    // Обрабатываем пользователей порциями
    while (processed < totalUsers) {
      const users = await Database.getUsersBatch(processed, chunkSize);

      for (const userId of users) {
        try {
          await this.sendMessageToUser(userId, mailing);
          progress.sent++;

          await Database.createMailingTask({
            mailing_id: mailingId,
            user_id: userId,
            status: "sent",
          });
        } catch (error: any) {
          const status = this.determineErrorStatus(error);
          progress[status]++;

          await Database.createMailingTask({
            mailing_id: mailingId,
            user_id: userId,
            status,
            error_message: error.message?.substring(0, 500),
          });
        }

        // Задержка между сообщениями
        if (delayBetweenMessages > 0) {
          await this.delay(delayBetweenMessages);
        }

        processed++;

        // Обновляем счетчики каждые 1000 сообщений
        if (processed % this.PROGRESS_UPDATE_INTERVAL === 0) {
          await this.updateProgress(
            adminId,
            mailingId,
            processed,
            totalUsers,
            progress
          );
        }
      }

      // Обновляем счетчики в БД после каждой порции
      await Database.updateMailingStats(mailingId, {
        sent_count: progress.sent,
        failed_count: progress.failed,
        blocked_count: progress.blocked,
      });
    }

    // Завершаем рассылку
    await Database.updateMailingStats(mailingId, {
      sent_count: progress.sent,
      failed_count: progress.failed,
      blocked_count: progress.blocked,
      status: "completed",
    });

    // Отправляем итоговое уведомление
    await this.sendFinalReport(adminId, mailingId, progress, totalUsers);

    console.log(`✅ Рассылка ${mailingId} завершена`);
  }

  private async sendMessageToUser(userId: number, mailing: any): Promise<void> {
    try {
      // Создаем клавиатуру с кнопкой если есть
      let replyMarkup: any = undefined;
      
      if (mailing.button_text && mailing.button_callback) {
        replyMarkup = {
          inline_keyboard: [[
            { 
              text: mailing.button_text, 
              callback_data: mailing.button_callback 
            }
          ]]
        };
      }

      if (mailing.photo_file_id) {
        const options: any = {
          caption: mailing.message,
          caption_entities: mailing.entities,
        };
        if (replyMarkup) {
          options.reply_markup = replyMarkup;
        }
        await this.bot.telegram.sendPhoto(userId, mailing.photo_file_id, options);
      } else if (mailing.video_file_id) {
        const options: any = {
          caption: mailing.message,
          caption_entities: mailing.entities,
        };
        if (replyMarkup) {
          options.reply_markup = replyMarkup;
        }
        await this.bot.telegram.sendVideo(userId, mailing.video_file_id, options);
      } else {
        const options: any = {
          entities: mailing.entities,
        };
        if (replyMarkup) {
          options.reply_markup = replyMarkup;
        }
        await this.bot.telegram.sendMessage(userId, mailing.message, options);
      }
    } catch (error: any) {
      console.error(
        `❌ Ошибка отправки пользователю ${userId}:`,
        error.message
      );
      throw error;
    }
  }

  private determineErrorStatus(error: any): "failed" | "blocked" {
    const errorMessage = error.message || "";

    if (errorMessage.includes("bot was blocked")) return "blocked";

    return 'failed';
  }

  private async updateProgress(
    adminId: number,
    mailingId: number,
    processed: number,
    totalUsers: number,
    progress: MailingProgress
  ): Promise<void> {
    const percentage = Math.round((processed / totalUsers) * 100);

    await this.notifyAdmin(
      adminId,
      `📊 Прогресс рассылки #${mailingId}: ${percentage}%\n` +
        `✅ Отправлено: ${progress.sent}\n` +
        `❌ Ошибки: ${progress.failed}\n` +
        `🚫 Заблокировано: ${progress.blocked}`
    );
  }

  private async sendFinalReport(
    adminId: number,
    mailingId: number,
    progress: MailingProgress,
    totalUsers: number
  ): Promise<void> {
    const successRate =
      totalUsers > 0 ? Math.round((progress.sent / totalUsers) * 100) : 0;

    await this.notifyAdmin(
      adminId,
      `Рассылка #${mailingId} завершена!\n\n` +
        `Итоги:\n` +
        `👥 Всего пользователей: ${totalUsers}\n` +
        `✅ Успешно отправлено: ${progress.sent} (${successRate}%)\n` +
        `❌ Ошибки отправки: ${progress.failed}\n` +
        `🚫 Заблокировали бота: ${progress.blocked}`
    );
  }

  private async notifyAdmin(adminId: number, message: string): Promise<void> {
    try {
      await this.bot.telegram.sendMessage(adminId, message);
    } catch (error) {
      console.error(
        `❌ Не удалось отправить уведомление админу ${adminId}:`,
        error
      );
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async stop(): Promise<void> {
    await this.queue.close();
    this.bot.stop();
    console.log("🛑 Воркер остановлен");
  }
}
