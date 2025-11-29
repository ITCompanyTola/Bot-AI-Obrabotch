import { Pool } from 'pg';
import { config } from './config';

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
    lastName?: string
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

      result = await client.query(
        `INSERT INTO users (id, username, first_name, last_name, balance, total_generations)
         VALUES ($1, $2, $3, $4, 0.00, 0)
         RETURNING *`,
        [userId, username, firstName, lastName]
      );

      console.log(`✅ Создан новый пользователь: ${userId}`);
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

  static async saveGeneratedFile(
    userId: number,
    fileType: 'photo' | 'music',
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
         ORDER BY created_at DESC`,
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
         ORDER BY created_at DESC`,
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
      // Количество пользователей
      const usersCount = await client.query(
        'SELECT COUNT(*) as count FROM users'
      );

      // Количество успешных оплат
      const successfulPayments = await client.query(
        `SELECT COUNT(*) as count FROM transactions 
         WHERE type = 'refill'`
      );

      // Сумма успешных оплат
      const totalPaymentsAmount = await client.query(
        `SELECT COALESCE(SUM(amount), 0) as total FROM transactions 
         WHERE type = 'refill'`
      );

      // Количество генераций фото
      const photoGenerations = await client.query(
        `SELECT COUNT(*) as count FROM generated_files 
         WHERE file_type = 'photo'`
      );

      // Количество генераций музыки
      const musicGenerations = await client.query(
        `SELECT COUNT(*) as count FROM generated_files 
         WHERE file_type = 'music'`
      );

      return {
        usersCount: parseInt(usersCount.rows[0].count),
        successfulPayments: parseInt(successfulPayments.rows[0].count),
        totalPaymentsAmount: parseFloat(totalPaymentsAmount.rows[0].total),
        photoGenerations: parseInt(photoGenerations.rows[0].count),
        musicGenerations: parseInt(musicGenerations.rows[0].count)
      };
    } finally {
      client.release();
    }
  }

  static async close() {
    await pool.end();
    console.log('🔌 Соединение с PostgreSQL закрыто');
  }
}