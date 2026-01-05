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

    await Database.updateMailingStats(mailingId, {
      total_users: totalUsers,
    });

    let bonusInfo = "";
    if (mailing.bonus_amount && mailing.bonus_amount > 0) {
      bonusInfo = `Бонус: ${mailing.bonus_amount}₽\n`;
    }

    // Информация о кнопках
    let buttonsInfo = "";
    if (mailing.parsed_buttons && mailing.parsed_buttons.length > 0) {
      buttonsInfo = `Кнопок: ${mailing.parsed_buttons.length}\n`;
    } else if (mailing.button_text && mailing.button_callback) {
      buttonsInfo = `Кнопка: "${mailing.button_text}"\n`;
    }

    await this.notifyAdmin(
      adminId,
      `Начата рассылка #${mailingId}\n` +
        `${buttonsInfo}` +
        `${bonusInfo}` +
        `Пользователей: ${totalUsers}`
    );

    while (processed < totalUsers) {
      const users = await Database.getUsersBatch(processed, chunkSize);

      for (const userId of users) {
        try {
          await this.sendMessageToUser(userId, mailing);
          progress.sent++;

          if (mailing.bonus_amount && mailing.bonus_amount > 0) {
            try {
              await Database.addBalance(
                userId,
                mailing.bonus_amount,
                `Бонус из рассылки #${mailingId}`,
                "bonus"
              );
              console.log(
                `Начислен бонус ${mailing.bonus_amount}₽ пользователю ${userId}`
              );
            } catch (bonusError) {
              console.error(
                `Ошибка начисления бонуса пользователю ${userId}:`,
                bonusError
              );
            }
          }

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

        if (delayBetweenMessages > 0) {
          await this.delay(delayBetweenMessages);
        }

        processed++;

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

      await Database.updateMailingStats(mailingId, {
        sent_count: progress.sent,
        failed_count: progress.failed,
        blocked_count: progress.blocked,
      });
    }

    await Database.updateMailingStats(mailingId, {
      sent_count: progress.sent,
      failed_count: progress.failed,
      blocked_count: progress.blocked,
      status: "completed",
    });

    await this.sendFinalReport(
      adminId,
      mailingId,
      progress,
      totalUsers,
      mailing.bonus_amount,
      mailing.parsed_buttons
    );

    console.log(`✅ Рассылка ${mailingId} завершена`);
  }

  private async sendMessageToUser(userId: number, mailing: any): Promise<void> {
    try {
      let replyMarkup: any = undefined;

      // Используем новые кнопки из JSON
      if (mailing.parsed_buttons && mailing.parsed_buttons.length > 0) {
        const inlineKeyboard = mailing.parsed_buttons.map(
          (button: { text: any; callbackData: any }) => [
            {
              text: button.text,
              callback_data: button.callbackData,
            },
          ]
        );
        replyMarkup = { inline_keyboard: inlineKeyboard };
        console.log(`📤 Отправка с ${mailing.parsed_buttons.length} кнопками`);
      }
      // Обратная совместимость со старым форматом
      else if (mailing.button_text && mailing.button_callback) {
        replyMarkup = {
          inline_keyboard: [
            [
              {
                text: mailing.button_text,
                callback_data: mailing.button_callback,
              },
            ],
          ],
        };
      }

      const options: any = {};

      if (replyMarkup) {
        options.reply_markup = replyMarkup;
      }

      if (mailing.photo_file_id) {
        options.caption = mailing.message;
        options.caption_entities = mailing.entities;
        await this.bot.telegram.sendPhoto(
          userId,
          mailing.photo_file_id,
          options
        );
      } else if (mailing.video_file_id) {
        options.caption = mailing.message;
        options.caption_entities = mailing.entities;
        await this.bot.telegram.sendVideo(
          userId,
          mailing.video_file_id,
          options
        );
      } else {
        options.entities = mailing.entities;
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
    return "failed";
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
      `Прогресс рассылки #${mailingId}: ${percentage}%\n` +
        `Отправлено: ${progress.sent}\n` +
        `Ошибки: ${progress.failed}\n` +
        `Заблокировано: ${progress.blocked}`
    );
  }

  private async sendFinalReport(
    adminId: number,
    mailingId: number,
    progress: MailingProgress,
    totalUsers: number,
    bonusAmount?: number,
    buttons?: any[]
  ): Promise<void> {
    const successRate =
      totalUsers > 0 ? Math.round((progress.sent / totalUsers) * 100) : 0;

    let bonusInfo = "";
    if (bonusAmount && bonusAmount > 0) {
      const totalBonus = progress.sent * bonusAmount;
      bonusInfo = `Всего бонусов: ${totalBonus}₽ (${bonusAmount}₽ × ${progress.sent})\n`;
    }

    let buttonsInfo = "";
    if (buttons && buttons.length > 0) {
      buttonsInfo = `Кнопок: ${buttons.length}\n`;
    }

    await this.notifyAdmin(
      adminId,
      `Рассылка #${mailingId} завершена\n\n` +
        `Итоги:\n` +
        `Пользователей: ${totalUsers}\n` +
        `Отправлено: ${progress.sent} (${successRate}%)\n` +
        `Ошибки: ${progress.failed}\n` +
        `Заблокировали: ${progress.blocked}\n` +
        `${buttonsInfo}` +
        `${bonusInfo}`
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
