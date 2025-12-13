import Bull from "bull";
import { MailingJobData } from "../types";

export class MailingQueueService {
  private queue!: Bull.Queue;

  constructor() {
    this.queue = new Bull("mailing", {
      redis: {
        host: process.env.REDIS_HOST || "redis",
        port: parseInt(process.env.REDIS_PORT || "6379"),
      },
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: true,
        removeOnFail: false,
      },
    });

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.queue.on("error", (error) => {
      console.error("❌ Ошибка подключения к Redis:", error.message);
    });

    this.queue.on("waiting", (jobId) => {
      console.log(`⏳ Задача ${jobId} ожидает обработки`);
    });

    this.queue.on("active", (job) => {
      console.log(`Задача ${job.id} начала обработку`);
    });

    this.queue.on("completed", (job) => {
      console.log(`✅ Задача ${job.id} завершена`);
    });

    this.queue.on("failed", (job, error) => {
      console.error(`❌ Задача ${job?.id} упала:`, error.message);
    });
  }

  async addMailingJob(data: MailingJobData): Promise<Bull.Job> {
    console.log(`📨 Добавлена задача рассылки ${data.mailingId}`);
    return await this.queue.add(data, {
      jobId: `mailing_${data.mailingId}_${Date.now()}`,
      priority: 1,
    });
  }

  async getJobCounts(): Promise<Bull.JobCounts> {
    return await this.queue.getJobCounts();
  }

  async close(): Promise<void> {
    await this.queue.close();
  }
}

export const mailingQueue = new MailingQueueService();
