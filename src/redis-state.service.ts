import Redis from "ioredis";
import { UserState } from "./types";

export class RedisStateService {
  private redis: Redis;
  private readonly PREFIX = "user_state:";
  private readonly TTL = 60 * 60 * 3; // 3 часа TTL

  constructor() {
    const redisHost = process.env.REDIS_HOST || "redis";
    const redisPort = parseInt(process.env.REDIS_PORT || "6379");

    this.redis = new Redis({
      host: redisHost,
      port: redisPort,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
    });

    this.redis.on("connect", () => {
      console.log("✅ Redis State Service connected");
    });

    this.redis.on("error", (err) => {
      console.error("❌ Redis State Service error:", err);
    });
  }

  async set(userId: number, state: UserState): Promise<void> {
    const key = `${this.PREFIX}${userId}`;
    const data = JSON.stringify(state);
    await this.redis.setex(key, this.TTL, data);
  }

  async get(userId: number): Promise<UserState | null> {
    const key = `${this.PREFIX}${userId}`;
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  async delete(userId: number): Promise<void> {
    const key = `${this.PREFIX}${userId}`;
    await this.redis.del(key);
  }

  async has(userId: number): Promise<boolean> {
    const key = `${this.PREFIX}${userId}`;
    const exists = await this.redis.exists(key);
    return exists === 1;
  }

  async clearAll(): Promise<void> {
    const keys = await this.redis.keys(`${this.PREFIX}*`);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  async disconnect(): Promise<void> {
    await this.redis.quit();
  }
}

export const redisStateService = new RedisStateService();
