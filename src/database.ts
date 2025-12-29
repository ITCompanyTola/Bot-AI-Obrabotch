import { Pool } from 'pg';
import { config } from './config';
import { CreateMailingData, CreateMailingTask, MailingData, MailingTask, UpdateMailingStats } from './types';

const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseUrl.includes('localhost') ? false : { rejectUnauthorized: false }
});

export interface User {
  id: number;
  username?: string;
  email?: string;
  phone?: string;
  first_name?: string;
  last_name?: string;
  balance: number;
  total_generations: number;
  is_admin: boolean;
  source_key?: string;
  created_at: Date;
  updated_at: Date;
}

export interface ReferralSource {
  id: number;
  source_name: string;
  key_substring: string;
  created_at: Date;
  updated_at: Date;
}

export interface Transaction {
  id: number;
  user_id: number;
  amount: number;
  type: 'generation' | 'refill' | 'bonus' | 'pending';
  description?: string;
  created_at: Date;
}

export interface UserRefferalData {
  source_key?: string;
  refferal_key_used?: boolean;
}

export class Database {
  static async initialize() {
    try {
      const client = await pool.connect();
      console.log('✅ Подключение к PostgreSQL успешно');
      client.release();
    } catch (error) {
      console.error('❌ Ошибка подключения к PostgreSQL:', error);
      throw error;
    }
  }

  static async getOrCreateUser(
    userId: number,
    username?: string,
    firstName?: string,
    lastName?: string,
    startPayload?: string
  ): Promise<{ user: User; isNew: boolean }> {
    const client = await pool.connect();
    try {
      let result = await client.query(
        'SELECT * FROM users WHERE id = $1',
        [userId]
      );

      if (result.rows.length > 0) {
        return { user: result.rows[0], isNew: false };
      }

      // Сохраняем ключевую подстроку напрямую
      const sourceKey = startPayload || null;

      result = await client.query(
        `INSERT INTO users (id, username, first_name, last_name, balance, total_generations, source_key)
         VALUES ($1, $2, $3, $4, 0.00, 0, $5)
         RETURNING *`,
        [userId, username, firstName, lastName, sourceKey]
      );

      console.log(`✅ Создан новый пользователь: ${userId}${sourceKey ? ` из источника ${sourceKey}` : ''}`);
      return { user: result.rows[0], isNew: true };
    } finally {
      client.release();
    }
  }

  static async getUserBalance(userId: number): Promise<number> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT balance FROM users WHERE id = $1',
        [userId]
      );

      if (result.rows.length === 0) {
        return 0;
      }

      return parseFloat(result.rows[0].balance);
    } finally {
      client.release();
    }
  }

  static async hasEnoughBalance(userId: number, amount: number): Promise<boolean> {
    const balance = await this.getUserBalance(userId);
    return balance >= amount;
  }

  static async deductBalance(
    userId: number,
    amount: number,
    description: string
  ): Promise<boolean> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const userResult = await client.query(
        'SELECT balance FROM users WHERE id = $1 FOR UPDATE',
        [userId]
      );

      if (userResult.rows.length === 0) {
        throw new Error('Пользователь не найден');
      }

      const currentBalance = parseFloat(userResult.rows[0].balance);

      if (currentBalance < amount) {
        await client.query('ROLLBACK');
        return false;
      }

      await client.query(
        'UPDATE users SET balance = balance - $1, total_generations = total_generations + 1 WHERE id = $2',
        [amount, userId]
      );

      await client.query(
        `INSERT INTO transactions (user_id, amount, type, description)
         VALUES ($1, $2, $3, $4)`,
        [userId, -amount, 'generation', description]
      );

      await client.query('COMMIT');
      console.log(`✅ Списано ${amount}₽ у пользователя ${userId}`);
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Ошибка списания средств:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async addBalance(
    userId: number,
    amount: number,
    description: string,
    type: 'refill' | 'bonus' = 'refill'
  ): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        'UPDATE users SET balance = balance + $1 WHERE id = $2',
        [amount, userId]
      );

      await client.query(
        `INSERT INTO transactions (user_id, amount, type, description)
         VALUES ($1, $2, $3, $4)`,
        [userId, amount, type, description]
      );

      await client.query('COMMIT');
      console.log(`✅ Пополнено ${amount}₽ пользователю ${userId}`);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Ошибка пополнения баланса:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async getTransactionHistory(
    userId: number,
    limit: number = 10
  ): Promise<Transaction[]> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT * FROM transactions 
         WHERE user_id = $1 
         ORDER BY created_at DESC 
         LIMIT $2`,
        [userId, limit]
      );

      return result.rows;
    } finally {
      client.release();
    }
  }

  static async getUserStats(userId: number) {
    const client = await pool.connect();
    try {
      const userResult = await client.query(
        'SELECT balance, total_generations FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        return null;
      }

      const totalSpent = await client.query(
        `SELECT COALESCE(SUM(ABS(amount)), 0) as total 
         FROM transactions 
         WHERE user_id = $1 AND type = 'generation'`,
        [userId]
      );

      return {
        balance: parseFloat(userResult.rows[0].balance),
        total_generations: userResult.rows[0].total_generations,
        total_spent: parseFloat(totalSpent.rows[0].total)
      };
    } finally {
      client.release();
    }
  }

  static async getUserEmail(userId: number): Promise<string | null> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT email FROM users WHERE id = $1',
        [userId]
      );

      if (result.rows.length === 0 || !result.rows[0].email) {
        return null;
      }

      return result.rows[0].email;
    } finally {
      client.release();
    }
  }

  static async saveUserEmail(userId: number, email: string): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query(
        'UPDATE users SET email = $1 WHERE id = $2',
        [email, userId]
      );
      console.log(`✅ Email сохранен для пользователя ${userId}`);
    } finally {
      client.release();
    }
  }

  // Добавить новый тип для реставрации
  static async saveGeneratedFile(
    userId: number,
    fileType: 'photo' | 'music' | 'restoration' | 'colorize' | 'dm_photo' | 'dm_video' | 'postcard_photo' | 'postcard_text',
    fileId: string,
    prompt?: string
  ): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query(
        `INSERT INTO generated_files (user_id, file_type, file_id, prompt)
         VALUES ($1, $2, $3, $4)`,
        [userId, fileType, fileId, prompt]
      );
      console.log(`✅ Сохранен файл для пользователя ${userId}`);
    } finally {
      client.release();
    }
  }

  static async getUserPhotos(userId: number): Promise<any[]> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT * FROM generated_files 
         WHERE user_id = $1 AND file_type = 'photo' 
         ORDER BY created_at ASC`,
        [userId]
      );
      return result.rows;
    } finally {
      client.release();
    }
  }

  static async getUserTracks(userId: number): Promise<any[]> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT * FROM generated_files 
         WHERE user_id = $1 AND file_type = 'music' 
         ORDER BY created_at ASC`,
        [userId]
      );
      return result.rows;
    } finally {
      client.release();
    }
  }

  static async getUserRestorations(userId: number): Promise<any[]> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT * FROM generated_files
         WHERE user_id = $1 AND file_type = 'restoration'
         ORDER BY created_at ASC`,
        [userId]
      );
      return result.rows;
    } finally {
      client.release();
    }
  }

  static async getUserColorize(userId: number): Promise<any[]> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT * FROM generated_files
         WHERE user_id = $1 AND file_type = 'colorize'
         ORDER BY created_at ASC`,
        [userId]
      );
      return result.rows;
    } finally {
      client.release();
    }
  }

  static async getUserDMPhotos(userId: number): Promise<any[]> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT * FROM generated_files
         WHERE user_id = $1 AND file_type = 'dm_photo'
         ORDER BY created_at ASC`,
        [userId]
      );
      return result.rows;
    } finally {
      client.release();
    }
  }

  static async getUserDMVideos(userId: number): Promise<any[]> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT * FROM generated_files
         WHERE user_id = $1 AND file_type = 'dm_video'
         ORDER BY created_at ASC`,
        [userId]
      );
      return result.rows;
    } finally {
      client.release();
    }
  }

  static async setPolicyAccepted(userId: number): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query(
        'UPDATE users SET policy_accepted = TRUE WHERE id = $1',
        [userId]
      );
      console.log(`✅ Пользователь ${userId} принял политику`);
    } finally {
      client.release();
    }
  }

  static async hasPolicyAccepted(userId: number): Promise<boolean> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT policy_accepted FROM users WHERE id = $1',
        [userId]
      );
      
      if (result.rows.length === 0) {
        return false;
      }
      
      return result.rows[0].policy_accepted === true;
    } finally {
      client.release();
    }
  }

  static async savePendingPayment(userId: number, paymentId: string, amount: number): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query(
        `INSERT INTO transactions (user_id, amount, type, description)
         VALUES ($1, $2, $3, $4)`,
        [userId, 0, 'pending', `Ожидание оплаты: ${paymentId}`]
      );
      console.log(`💳 Создан платеж ${paymentId} на сумму ${amount}₽ для пользователя ${userId}`);
    } finally {
      client.release();
    }
  }

  static async isPaymentProcessed(paymentId: string): Promise<boolean> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT COUNT(*) as count FROM transactions 
         WHERE description LIKE $1 AND type = 'refill'`,
        [`%${paymentId}%`]
      );
      return parseInt(result.rows[0].count) > 0;
    } finally {
      client.release();
    }
  }

  static async getGlobalStats() {
    const client = await pool.connect();
    try {
      // Определяем временные границы
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // За все время
      const usersCountAll = await client.query('SELECT COUNT(*) as count FROM users');
      const paymentsCountAll = await client.query(`SELECT COUNT(*) as count FROM transactions WHERE type = 'refill'`);
      const paymentsSumAll = await client.query(`SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = 'refill'`);
      const photoGenAll = await client.query(`SELECT COUNT(*) as count FROM generated_files WHERE file_type = 'photo'`);
      const musicGenAll = await client.query(`SELECT COUNT(*) as count FROM generated_files WHERE file_type = 'music'`);
      const restorationGenAll = await client.query(`SELECT COUNT(*) as count FROM generated_files WHERE file_type = 'restoration'`);
      const colorizeGenAll = await client.query(`SELECT COUNT(*) as count FROM generated_files WHERE file_type = 'colorize'`);
      const dmVideoGenAll = await client.query(`SELECT COUNT(*) as count FROM generated_files WHERE file_type = 'dm_video'`);
      const postcardTextGenAll = await client.query(`SELECT COUNT(*) as count FROM generated_files WHERE file_type = 'postcard_text'`);
      const postcardPhotoGenAll = await client.query(`SELECT COUNT(*) as count FROM generated_files WHERE file_type = 'postcard_photo'`);

      // За последние 7 дней
      const usersCount7d = await client.query('SELECT COUNT(*) as count FROM users WHERE created_at >= $1', [sevenDaysAgo]);
      const paymentsCount7d = await client.query(`SELECT COUNT(*) as count FROM transactions WHERE type = 'refill' AND created_at >= $1`, [sevenDaysAgo]);
      const paymentsSum7d = await client.query(`SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = 'refill' AND created_at >= $1`, [sevenDaysAgo]);
      const photoGen7d = await client.query(`SELECT COUNT(*) as count FROM generated_files WHERE file_type = 'photo' AND created_at >= $1`, [sevenDaysAgo]);
      const musicGen7d = await client.query(`SELECT COUNT(*) as count FROM generated_files WHERE file_type = 'music' AND created_at >= $1`, [sevenDaysAgo]);
      const restorationGen7d = await client.query(`SELECT COUNT(*) as count FROM generated_files WHERE file_type = 'restoration' AND created_at >= $1`, [sevenDaysAgo]);
      const colorizeGen7d = await client.query(`SELECT COUNT(*) as count FROM generated_files WHERE file_type = 'colorize' AND created_at >= $1`, [sevenDaysAgo]);
      const dmVideoGen7d = await client.query(`SELECT COUNT(*) as count FROM generated_files WHERE file_type = 'dm_video' AND created_at >= $1`, [sevenDaysAgo]);
      const postcardTextGen7d = await client.query(`SELECT COUNT(*) as count FROM generated_files WHERE file_type = 'postcard_text' AND created_at >= $1`, [sevenDaysAgo]);
      const postcardPhotoGen7d = await client.query(`SELECT COUNT(*) as count FROM generated_files WHERE file_type = 'postcard_photo' AND created_at >= $1`, [sevenDaysAgo]);

      // За сегодня
      const usersCountToday = await client.query('SELECT COUNT(*) as count FROM users WHERE created_at >= $1', [startOfToday]);
      const paymentsCountToday = await client.query(`SELECT COUNT(*) as count FROM transactions WHERE type = 'refill' AND created_at >= $1`, [startOfToday]);
      const paymentsSumToday = await client.query(`SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = 'refill' AND created_at >= $1`, [startOfToday]);
      const photoGenToday = await client.query(`SELECT COUNT(*) as count FROM generated_files WHERE file_type = 'photo' AND created_at >= $1`, [startOfToday]);
      const musicGenToday = await client.query(`SELECT COUNT(*) as count FROM generated_files WHERE file_type = 'music' AND created_at >= $1`, [startOfToday]);
      const restorationGenToday = await client.query(`SELECT COUNT(*) as count FROM generated_files WHERE file_type = 'restoration' AND created_at >= $1`, [startOfToday]);
      const colorizeGenToday = await client.query(`SELECT COUNT(*) as count FROM generated_files WHERE file_type = 'colorize' AND created_at >= $1`, [startOfToday]);
      const dmVideoGenToday = await client.query(`SELECT COUNT(*) as count FROM generated_files WHERE file_type = 'dm_video' AND created_at >= $1`, [startOfToday]);
      const postcardTextGenToday = await client.query(`SELECT COUNT(*) as count FROM generated_files WHERE file_type = 'postcard_text' AND created_at >= $1`, [startOfToday]);
      const postcardPhotoGenToday = await client.query(`SELECT COUNT(*) as count FROM generated_files WHERE file_type = 'postcard_photo' AND created_at >= $1`, [startOfToday]);

      return {
        all: {
          usersCount: parseInt(usersCountAll.rows[0].count),
          successfulPayments: parseInt(paymentsCountAll.rows[0].count),
          totalPaymentsAmount: parseFloat(paymentsSumAll.rows[0].total),
          photoGenerations: parseInt(photoGenAll.rows[0].count),
          musicGenerations: parseInt(musicGenAll.rows[0].count),
          restorationGenerations: parseInt(restorationGenAll.rows[0].count),
          colorizeGenerations: parseInt(colorizeGenAll.rows[0].count),
          dmVideoGenerations: parseInt(dmVideoGenAll.rows[0].count),
          postcardTextGenerations: parseInt(postcardTextGenAll.rows[0].count),
          postcardPhotoGenerations: parseInt(postcardPhotoGenAll.rows[0].count)
        },
        last7Days: {
          usersCount: parseInt(usersCount7d.rows[0].count),
          successfulPayments: parseInt(paymentsCount7d.rows[0].count),
          totalPaymentsAmount: parseFloat(paymentsSum7d.rows[0].total),
          photoGenerations: parseInt(photoGen7d.rows[0].count),
          musicGenerations: parseInt(musicGen7d.rows[0].count),
          restorationGenerations: parseInt(restorationGen7d.rows[0].count),
          colorizeGenerations: parseInt(colorizeGen7d.rows[0].count),
          dmVideoGenerations: parseInt(dmVideoGen7d.rows[0].count),
          postcardTextGenerations: parseInt(postcardTextGen7d.rows[0].count),
          postcardPhotoGenerations: parseInt(postcardPhotoGen7d.rows[0].count)
        },
        today: {
          usersCount: parseInt(usersCountToday.rows[0].count),
          successfulPayments: parseInt(paymentsCountToday.rows[0].count),
          totalPaymentsAmount: parseFloat(paymentsSumToday.rows[0].total),
          photoGenerations: parseInt(photoGenToday.rows[0].count),
          musicGenerations: parseInt(musicGenToday.rows[0].count),
          restorationGenerations: parseInt(restorationGenToday.rows[0].count),
          colorizeGenerations: parseInt(colorizeGenToday.rows[0].count),
          dmVideoGenerations: parseInt(dmVideoGenToday.rows[0].count),
          postcardTextGenerations: parseInt(postcardTextGenToday.rows[0].count),
          postcardPhotoGenerations: parseInt(postcardPhotoGenToday.rows[0].count)
        }
      };
    } finally {
      client.release();
    }
  }

  static async getSourceStats(keySubstring: string) {
    const client = await pool.connect();
    try {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // За все время
      const usersCountAll = await client.query('SELECT COUNT(*) as count FROM users WHERE source_key = $1', [keySubstring]);
      const paymentsCountAll = await client.query(
        `SELECT COUNT(*) as count FROM transactions t 
         JOIN users u ON t.user_id = u.id 
         WHERE u.source_key = $1 AND t.type = 'refill'`,
        [keySubstring]
      );
      const paymentsSumAll = await client.query(
        `SELECT COALESCE(SUM(t.amount), 0) as total FROM transactions t 
         JOIN users u ON t.user_id = u.id 
         WHERE u.source_key = $1 AND t.type = 'refill'`,
        [keySubstring]
      );
      const photoGenAll = await client.query(
        `SELECT COUNT(*) as count FROM generated_files g 
         JOIN users u ON g.user_id = u.id 
         WHERE u.source_key = $1 AND g.file_type = 'photo'`,
        [keySubstring]
      );
      const musicGenAll = await client.query(
        `SELECT COUNT(*) as count FROM generated_files g 
         JOIN users u ON g.user_id = u.id 
         WHERE u.source_key = $1 AND g.file_type = 'music'`,
        [keySubstring]
      );
      const dmGenAll = await client.query(
        `SELECT COUNT(*) as count FROM generated_files g
         JOIN users u ON g.user_id = u.id
         WHERE u.source_key = $1 AND g.file_type = 'dm_video'`,
        [keySubstring]
      );
      const colorizeGenAll = await client.query(
        `SELECT COUNT(*) as count FROM generated_files g 
         JOIN users u ON g.user_id = u.id 
         WHERE u.source_key = $1 AND g.file_type = 'colorize'`,
        [keySubstring]
      );
      const restorationGenAll = await client.query(
        `SELECT COUNT(*) as count FROM generated_files g 
         JOIN users u ON g.user_id = u.id 
         WHERE u.source_key = $1 AND g.file_type = 'restoration'`,
        [keySubstring]
      );
      const postcardTextGenAll = await client.query(
        `SELECT COUNT(*) as count FROM generated_files g 
         JOIN users u ON g.user_id = u.id 
         WHERE u.source_key = $1 AND g.file_type = 'postcard_text'`,
        [keySubstring]
      );
      const postcardPhotoGenAll = await client.query(
        `SELECT COUNT(*) as count FROM generated_files g 
         JOIN users u ON g.user_id = u.id 
         WHERE u.source_key = $1 AND g.file_type = 'postcard_photo'`,
        [keySubstring]
      );

      // За последние 7 дней
      const usersCount7d = await client.query(
        'SELECT COUNT(*) as count FROM users WHERE source_key = $1 AND created_at >= $2',
        [keySubstring, sevenDaysAgo]
      );
      const paymentsCount7d = await client.query(
        `SELECT COUNT(*) as count FROM transactions t 
         JOIN users u ON t.user_id = u.id 
         WHERE u.source_key = $1 AND t.type = 'refill' AND t.created_at >= $2`,
        [keySubstring, sevenDaysAgo]
      );
      const paymentsSum7d = await client.query(
        `SELECT COALESCE(SUM(t.amount), 0) as total FROM transactions t 
         JOIN users u ON t.user_id = u.id 
         WHERE u.source_key = $1 AND t.type = 'refill' AND t.created_at >= $2`,
        [keySubstring, sevenDaysAgo]
      );
      const photoGen7d = await client.query(
        `SELECT COUNT(*) as count FROM generated_files g 
         JOIN users u ON g.user_id = u.id 
         WHERE u.source_key = $1 AND g.file_type = 'photo' AND g.created_at >= $2`,
        [keySubstring, sevenDaysAgo]
      );
      const musicGen7d = await client.query(
        `SELECT COUNT(*) as count FROM generated_files g 
         JOIN users u ON g.user_id = u.id 
         WHERE u.source_key = $1 AND g.file_type = 'music' AND g.created_at >= $2`,
        [keySubstring, sevenDaysAgo]
      );
      const dmGen7d = await client.query(
        `SELECT COUNT(*) as count FROM generated_files g
         JOIN users u ON g.user_id = u.id
         WHERE u.source_key = $1 AND g.file_type = 'dm_video' AND g.created_at >= $2`,
        [keySubstring, sevenDaysAgo]
      );
      const colorizeGen7d = await client.query(
        `SELECT COUNT(*) as count FROM generated_files g 
         JOIN users u ON g.user_id = u.id 
         WHERE u.source_key = $1 AND g.file_type = 'colorize' AND g.created_at >= $2`,
        [keySubstring, sevenDaysAgo]
      );
      const restorationGen7d = await client.query(
        `SELECT COUNT(*) as count FROM generated_files g 
         JOIN users u ON g.user_id = u.id 
         WHERE u.source_key = $1 AND g.file_type = 'restoration' AND g.created_at >= $2`,
        [keySubstring, sevenDaysAgo]
      );
      const postcardTextGen7d = await client.query(
        `SELECT COUNT(*) as count FROM generated_files g 
         JOIN users u ON g.user_id = u.id 
         WHERE u.source_key = $1 AND g.file_type = 'postcard_text' AND g.created_at >= $2`,
        [keySubstring, sevenDaysAgo]
      );
      const postcardPhotoGen7d = await client.query(
        `SELECT COUNT(*) as count FROM generated_files g 
         JOIN users u ON g.user_id = u.id 
         WHERE u.source_key = $1 AND g.file_type = 'postcard_photo' AND g.created_at >= $2`,
        [keySubstring, sevenDaysAgo]
      );

      // За сегодня
      const usersCountToday = await client.query(
        'SELECT COUNT(*) as count FROM users WHERE source_key = $1 AND created_at >= $2',
        [keySubstring, startOfToday]
      );
      const paymentsCountToday = await client.query(
        `SELECT COUNT(*) as count FROM transactions t 
         JOIN users u ON t.user_id = u.id 
         WHERE u.source_key = $1 AND t.type = 'refill' AND t.created_at >= $2`,
        [keySubstring, startOfToday]
      );
      const paymentsSumToday = await client.query(
        `SELECT COALESCE(SUM(t.amount), 0) as total FROM transactions t 
         JOIN users u ON t.user_id = u.id 
         WHERE u.source_key = $1 AND t.type = 'refill' AND t.created_at >= $2`,
        [keySubstring, startOfToday]
      );
      const photoGenToday = await client.query(
        `SELECT COUNT(*) as count FROM generated_files g 
         JOIN users u ON g.user_id = u.id 
         WHERE u.source_key = $1 AND g.file_type = 'photo' AND g.created_at >= $2`,
        [keySubstring, startOfToday]
      );
      const musicGenToday = await client.query(
        `SELECT COUNT(*) as count FROM generated_files g 
         JOIN users u ON g.user_id = u.id 
         WHERE u.source_key = $1 AND g.file_type = 'music' AND g.created_at >= $2`,
        [keySubstring, startOfToday]
      );
      const dmGenToday = await client.query(
        `SELECT COUNT(*) as count FROM generated_files g
         JOIN users u ON g.user_id = u.id
         WHERE u.source_key = $1 AND g.file_type = 'dm_video' AND g.created_at >= $2`,
        [keySubstring, startOfToday]
      );
      const colorizeGenToday = await client.query(
        `SELECT COUNT(*) as count FROM generated_files g 
         JOIN users u ON g.user_id = u.id 
         WHERE u.source_key = $1 AND g.file_type = 'colorize' AND g.created_at >= $2`,
        [keySubstring, startOfToday]
      );
      const restorationGenToday = await client.query(
        `SELECT COUNT(*) as count FROM generated_files g 
         JOIN users u ON g.user_id = u.id 
         WHERE u.source_key = $1 AND g.file_type = 'restoration' AND g.created_at >= $2`,
        [keySubstring, startOfToday]
      );
      const postcardTextGenToday = await client.query(
        `SELECT COUNT(*) as count FROM generated_files g 
         JOIN users u ON g.user_id = u.id 
         WHERE u.source_key = $1 AND g.file_type = 'postcard_text' AND g.created_at >= $2`,
        [keySubstring, startOfToday]
      );
      const postcardPhotoGenToday = await client.query(
        `SELECT COUNT(*) as count FROM generated_files g 
         JOIN users u ON g.user_id = u.id 
         WHERE u.source_key = $1 AND g.file_type = 'postcard_photo' AND g.created_at >= $2`,
        [keySubstring, startOfToday]
      );

      return {
        all: {
          usersCount: parseInt(usersCountAll.rows[0].count),
          successfulPayments: parseInt(paymentsCountAll.rows[0].count),
          totalPaymentsAmount: parseFloat(paymentsSumAll.rows[0].total),
          photoGenerations: parseInt(photoGenAll.rows[0].count),
          musicGenerations: parseInt(musicGenAll.rows[0].count),
          dmVideoGenerations: parseInt(dmGenAll.rows[0].count),
          colorizeGenerations: parseInt(colorizeGenAll.rows[0].count),
          restorationGenerations: parseInt(restorationGenAll.rows[0].count),
          postcardTextGenerations: parseInt(postcardTextGenAll.rows[0].count),
          postcardPhotoGenerations: parseInt(postcardPhotoGenAll.rows[0].count)
        },
        last7Days: {
          usersCount: parseInt(usersCount7d.rows[0].count),
          successfulPayments: parseInt(paymentsCount7d.rows[0].count),
          totalPaymentsAmount: parseFloat(paymentsSum7d.rows[0].total),
          photoGenerations: parseInt(photoGen7d.rows[0].count),
          musicGenerations: parseInt(musicGen7d.rows[0].count),
          dmVideoGenerations: parseInt(dmGen7d.rows[0].count),
          colorizeGenerations: parseInt(colorizeGen7d.rows[0].count),
          restorationGenerations: parseInt(restorationGen7d.rows[0].count),
          postcardTextGenerations: parseInt(postcardTextGen7d.rows[0].count),
          postcardPhotoGenerations: parseInt(postcardPhotoGen7d.rows[0].count)
        },
        today: {
          usersCount: parseInt(usersCountToday.rows[0].count),
          successfulPayments: parseInt(paymentsCountToday.rows[0].count),
          totalPaymentsAmount: parseFloat(paymentsSumToday.rows[0].total),
          photoGenerations: parseInt(photoGenToday.rows[0].count),
          musicGenerations: parseInt(musicGenToday.rows[0].count),
          dmVideoGenerations: parseInt(dmGenToday.rows[0].count),
          colorizeGenerations: parseInt(colorizeGenToday.rows[0].count),
          restorationGenerations: parseInt(restorationGenToday.rows[0].count),
          postcardTextGenerations: parseInt(postcardTextGenToday.rows[0].count),
          postcardPhotoGenerations: parseInt(postcardPhotoGenToday.rows[0].count)
        }
      };
    } finally {
      client.release();
    }
  }

  static async isAdmin(userId: number): Promise<boolean> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT is_admin FROM users WHERE id = $1',
        [userId]
      );
      
      if (result.rows.length === 0) {
        return false;
      }
      
      return result.rows[0].is_admin === true;
    } finally {
      client.release();
    }
  }

  static async createReferralSource(
    sourceName: string,
    keySubstring: string
  ): Promise<ReferralSource> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `INSERT INTO referral_sources (source_name, key_substring)
         VALUES ($1, $2)
         RETURNING *`,
        [sourceName, keySubstring]
      );

      console.log(`✅ Создан новый источник: ${sourceName}`);
      return result.rows[0];
    } catch (error: any) {
      if (error.code === '23505') {
        throw new Error('Источник с таким именем или ключевой подстрокой уже существует');
      }
      throw error;
    } finally {
      client.release();
    }
  }

  static async getReferralSource(sourceName: string): Promise<ReferralSource | null> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM referral_sources WHERE source_name = $1',
        [sourceName]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];
    } finally {
      client.release();
    }
  }

  static async getAllReferralSources(): Promise<ReferralSource[]> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM referral_sources ORDER BY created_at DESC'
      );

      return result.rows;
    } finally {
      client.release();
    }
  }

  static async getUserEngagementStats() {
    const client = await pool.connect();
    try {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // За все время
      const repeatPaymentsAll = await client.query(
        `SELECT COUNT(DISTINCT user_id) as count 
         FROM transactions 
         WHERE type = 'refill' 
         AND user_id IN (
           SELECT user_id 
           FROM transactions 
           WHERE type = 'refill' 
           GROUP BY user_id 
           HAVING COUNT(*) >= 2
         )`
      );
      
      const twoGenAll = await client.query(
        `SELECT COUNT(*) as count 
         FROM users 
         WHERE total_generations = 2`
      );
      
      const threeGenAll = await client.query(
        `SELECT COUNT(*) as count 
         FROM users 
         WHERE total_generations = 3`
      );
      
      const fourPlusGenAll = await client.query(
        `SELECT COUNT(*) as count 
         FROM users 
         WHERE total_generations >= 4`
      );

      // За последние 7 дней
      const repeatPayments7d = await client.query(
        `SELECT COUNT(DISTINCT user_id) as count 
         FROM transactions 
         WHERE type = 'refill' 
         AND created_at >= $1
         AND user_id IN (
           SELECT user_id 
           FROM transactions 
           WHERE type = 'refill' 
           AND created_at >= $1
           GROUP BY user_id 
           HAVING COUNT(*) >= 2
         )`,
        [sevenDaysAgo]
      );
      
      const twoGen7d = await client.query(
        `SELECT COUNT(DISTINCT g.user_id) as count 
         FROM generated_files g
         WHERE g.created_at >= $1
         AND g.user_id IN (
           SELECT user_id 
           FROM generated_files 
           WHERE created_at >= $1
           GROUP BY user_id 
           HAVING COUNT(*) = 2
         )`,
        [sevenDaysAgo]
      );
      
      const threeGen7d = await client.query(
        `SELECT COUNT(DISTINCT g.user_id) as count 
         FROM generated_files g
         WHERE g.created_at >= $1
         AND g.user_id IN (
           SELECT user_id 
           FROM generated_files 
           WHERE created_at >= $1
           GROUP BY user_id 
           HAVING COUNT(*) = 3
         )`,
        [sevenDaysAgo]
      );
      
      const fourPlusGen7d = await client.query(
        `SELECT COUNT(DISTINCT g.user_id) as count 
         FROM generated_files g
         WHERE g.created_at >= $1
         AND g.user_id IN (
           SELECT user_id 
           FROM generated_files 
           WHERE created_at >= $1
           GROUP BY user_id 
           HAVING COUNT(*) >= 4
         )`,
        [sevenDaysAgo]
      );

      // За сегодня
      const repeatPaymentsToday = await client.query(
        `SELECT COUNT(DISTINCT user_id) as count 
         FROM transactions 
         WHERE type = 'refill' 
         AND created_at >= $1
         AND user_id IN (
           SELECT user_id 
           FROM transactions 
           WHERE type = 'refill' 
           AND created_at >= $1
           GROUP BY user_id 
           HAVING COUNT(*) >= 2
         )`,
        [startOfToday]
      );
      
      const twoGenToday = await client.query(
        `SELECT COUNT(DISTINCT g.user_id) as count 
         FROM generated_files g
         WHERE g.created_at >= $1
         AND g.user_id IN (
           SELECT user_id 
           FROM generated_files 
           WHERE created_at >= $1
           GROUP BY user_id 
           HAVING COUNT(*) = 2
         )`,
        [startOfToday]
      );
      
      const threeGenToday = await client.query(
        `SELECT COUNT(DISTINCT g.user_id) as count 
         FROM generated_files g
         WHERE g.created_at >= $1
         AND g.user_id IN (
           SELECT user_id 
           FROM generated_files 
           WHERE created_at >= $1
           GROUP BY user_id 
           HAVING COUNT(*) = 3
         )`,
        [startOfToday]
      );
      
      const fourPlusGenToday = await client.query(
        `SELECT COUNT(DISTINCT g.user_id) as count 
         FROM generated_files g
         WHERE g.created_at >= $1
         AND g.user_id IN (
           SELECT user_id 
           FROM generated_files 
           WHERE created_at >= $1
           GROUP BY user_id 
           HAVING COUNT(*) >= 4
         )`,
        [startOfToday]
      );

      return {
        all: {
          repeatPayments: parseInt(repeatPaymentsAll.rows[0].count),
          twoGenerations: parseInt(twoGenAll.rows[0].count),
          threeGenerations: parseInt(threeGenAll.rows[0].count),
          fourPlusGenerations: parseInt(fourPlusGenAll.rows[0].count)
        },
        last7Days: {
          repeatPayments: parseInt(repeatPayments7d.rows[0].count),
          twoGenerations: parseInt(twoGen7d.rows[0].count),
          threeGenerations: parseInt(threeGen7d.rows[0].count),
          fourPlusGenerations: parseInt(fourPlusGen7d.rows[0].count)
        },
        today: {
          repeatPayments: parseInt(repeatPaymentsToday.rows[0].count),
          twoGenerations: parseInt(twoGenToday.rows[0].count),
          threeGenerations: parseInt(threeGenToday.rows[0].count),
          fourPlusGenerations: parseInt(fourPlusGenToday.rows[0].count)
        }
      };
    } finally {
      client.release();
    }
  }

  static async renameReferralSource(oldName: string, newName: string): Promise<void> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'UPDATE referral_sources SET source_name = $1 WHERE source_name = $2',
        [newName, oldName]
      );

      if (result.rowCount === 0) {
        throw new Error(`Источник "${oldName}" не найден`);
      }

      console.log(`✅ Источник переименован: ${oldName} -> ${newName}`);
    } catch (error: any) {
      if (error.code === '23505') {
        throw new Error(`Источник с именем "${newName}" уже существует`);
      }
      throw error;
    } finally {
      client.release();
    }
  }

  static async getAllUsersIds(): Promise<number[]> {
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT id FROM users');
      return result.rows.map((row) => row.id);
    } finally {
      client.release();
    }
  }

  // ===== МЕТОДЫ ДЛЯ РАССЫЛОК =====

  static async createMailingData(data: CreateMailingData): Promise<MailingData> {
  const client = await pool.connect();
  try {
    // Telegram entities - это массив объектов вида {offset, length, type, ...}
    // Нужно сохранить как JSON
    let entitiesForDb = null;
    
    if (data.entities && Array.isArray(data.entities)) {
      // Проверяем, что это валидные entities
      const isValid = data.entities.every(entity => 
        entity && typeof entity === 'object' && 'offset' in entity && 'length' in entity
      );
      
      if (isValid) {
        entitiesForDb = JSON.stringify(data.entities);
        console.log('✅ Сохраняем entities:', entitiesForDb);
      }
    }
    
    console.log('📊 Сохранение данных рассылки:');
    console.log('- Сообщение:', data.message?.substring(0, 100));
    console.log('- Текст кнопки:', data.button_text);
    console.log('- Callback кнопки:', data.button_callback);
    
    const result = await client.query(
      `INSERT INTO mailing_data 
       (admin_id, message, entities, photo_file_id, video_file_id, button_text, button_callback, bonus_amount, total_users)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        data.admin_id,
        data.message,
        entitiesForDb,
        data.photo_file_id,
        data.video_file_id,
        data.button_text || null,
        data.button_callback || null,
        data.bonus_amount || 0,  // ДОБАВЛЕНО: бонус, по умолчанию 0
        data.total_users
      ]
    );

    console.log('✅ Данные рассылки сохранены в БД:', {
      id: result.rows[0].id,
      hasButtonText: !!result.rows[0].button_text,
      hasButtonCallback: !!result.rows[0].button_callback
    });

    return result.rows[0];
  } finally {
    client.release();
  }
}

 static async getMailingData(id: number): Promise<MailingData | null> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM mailing_data WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    
    console.log('📖 Чтение данных рассылки из БД:', {
      id: row.id,
      button_text: row.button_text,
      button_callback: row.button_callback,
      hasButton: !!row.button_text && !!row.button_callback
    });
    
    // Извлекаем entities
    let entities = null;
    if (row.entities) {
      try {
        // Если это строка JSON
        if (typeof row.entities === 'string') {
          entities = JSON.parse(row.entities);
        }
        // Если pg драйвер уже распарсил
        else if (typeof row.entities === 'object') {
          entities = row.entities;
        }
      } catch (error) {
        console.error('❌ Ошибка чтения entities:', error);
        entities = null;
      }
    }
    
    return {
      ...row,
      entities,
      button_text: row.button_text || undefined,
      button_callback: row.button_callback || undefined,
      bonus_amount: row.bonus_amount || 0  // ДОБАВЛЕНО: бонус
    };
  } finally {
    client.release();
  }
}

  static async updateMailingStats(
    mailingId: number, 
    stats: UpdateMailingStats
  ): Promise<void> {
    const client = await pool.connect();
    try {
      const updates = [];
      const values = [];
      let paramIndex = 1;

      if (stats.sent_count !== undefined) {
        updates.push(`sent_count = $${paramIndex}`);
        values.push(stats.sent_count);
        paramIndex++;
      }

      if (stats.failed_count !== undefined) {
        updates.push(`failed_count = $${paramIndex}`);
        values.push(stats.failed_count);
        paramIndex++;
      }

      if (stats.blocked_count !== undefined) {
        updates.push(`blocked_count = $${paramIndex}`);
        values.push(stats.blocked_count);
        paramIndex++;
      }

      if (stats.status !== undefined) {
        updates.push(`status = $${paramIndex}`);
        values.push(stats.status);
        paramIndex++;
        
        if (stats.status === 'completed' || stats.status === 'failed') {
          updates.push(`completed_at = $${paramIndex}`);
          values.push(new Date());
          paramIndex++;
        }
      }

      if (updates.length === 0) {
        return;
      }

      values.push(mailingId);
      
      await client.query(
        `UPDATE mailing_data 
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}`,
        values
      );
    } finally {
      client.release();
    }
  }

  static async createMailingTask(data: CreateMailingTask): Promise<MailingTask> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `INSERT INTO mailing_tasks 
        (mailing_id, user_id, status, error_message, attempts)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *`,
        [
          data.mailing_id,
          data.user_id,
          data.status,
          data.error_message,
          data.attempts || 1
        ]
      );

      return result.rows[0];
    } finally {
      client.release();
    }
  }

  static async stopAllMailings(): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('DELETE FROM mailings WHERE status = $1', ['processing']);
    } finally {
      client.release();
    }
  }

  static async getUsersBatch(skip: number = 0, limit: number = 100): Promise<number[]> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT id FROM users ORDER BY id OFFSET $1 LIMIT $2',
        [skip, limit]
      );
      return result.rows.map(row => row.id);
    } finally {
      client.release();
    }
  }

  static async getTotalUsersCount(): Promise<number> {
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT COUNT(*) as count FROM users');
      return parseInt(result.rows[0].count);
    } finally {
      client.release();
    }
  }

  static async isRefferalCreated(userId: number): Promise<boolean> {
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT id FROM users WHERE id = $1 AND user_refferal_key IS NOT NULL', [userId]);
      return result.rows.length > 0;
    } finally {
      client.release();
    }
  }

  static async getRefferalLink(userId: number): Promise<string> {
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT user_refferal_key FROM users WHERE id = $1', [userId]);
      return result.rows[0].user_refferal_key;
    } finally {
      client.release();
    }
  }

  static async createRefferal(userId: number, userRefferalKey: string): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('UPDATE users SET user_refferal_key = $1 WHERE id = $2', [userRefferalKey, userId]);
    } finally {
      client.release();
    }
  }

  static async getUserRefferalData(userId: number): Promise<UserRefferalData> {
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT source_key, refferal_key_used FROM users WHERE id = $1', [userId]);
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  static async getUserIdByRefferalKey(refferalKey: string): Promise<number> {
    const client = await pool.connect();
    try { 
      const result = await client.query('SELECT id FROM users WHERE user_refferal_key = $1', [refferalKey]);
      return result.rows[0].id;
    } finally {
      client.release();
    }
  }

  static async setRefferalKeyUsed(userId: number): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('UPDATE users SET refferal_key_used = true WHERE id = $1', [userId]);
    } finally {
      client.release();
    }
  }

  static async getUserPostcardsText(userId: number): Promise<any[]> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT * FROM generated_files
         WHERE user_id = $1 AND file_type = 'postcard_text'
         ORDER BY created_at ASC`,
        [userId]
      );
      return result.rows;
    } finally {
      client.release();
    }
  }

  static async getUserPostcardsPhoto(userId: number): Promise<any[]> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT * FROM generated_files
         WHERE user_id = $1 AND file_type = 'postcard_photo'
         ORDER BY created_at ASC`,
        [userId]
      );
      return result.rows;
    } finally {
      client.release();
    }
  }

  static async close() {
    await pool.end();
    console.log('🔌 Соединение с PostgreSQL закрыто');
  }
}