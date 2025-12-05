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

      // За последние 7 дней
      const usersCount7d = await client.query('SELECT COUNT(*) as count FROM users WHERE created_at >= $1', [sevenDaysAgo]);
      const paymentsCount7d = await client.query(`SELECT COUNT(*) as count FROM transactions WHERE type = 'refill' AND created_at >= $1`, [sevenDaysAgo]);
      const paymentsSum7d = await client.query(`SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = 'refill' AND created_at >= $1`, [sevenDaysAgo]);
      const photoGen7d = await client.query(`SELECT COUNT(*) as count FROM generated_files WHERE file_type = 'photo' AND created_at >= $1`, [sevenDaysAgo]);
      const musicGen7d = await client.query(`SELECT COUNT(*) as count FROM generated_files WHERE file_type = 'music' AND created_at >= $1`, [sevenDaysAgo]);

      // За сегодня
      const usersCountToday = await client.query('SELECT COUNT(*) as count FROM users WHERE created_at >= $1', [startOfToday]);
      const paymentsCountToday = await client.query(`SELECT COUNT(*) as count FROM transactions WHERE type = 'refill' AND created_at >= $1`, [startOfToday]);
      const paymentsSumToday = await client.query(`SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = 'refill' AND created_at >= $1`, [startOfToday]);
      const photoGenToday = await client.query(`SELECT COUNT(*) as count FROM generated_files WHERE file_type = 'photo' AND created_at >= $1`, [startOfToday]);
      const musicGenToday = await client.query(`SELECT COUNT(*) as count FROM generated_files WHERE file_type = 'music' AND created_at >= $1`, [startOfToday]);

      return {
        all: {
          usersCount: parseInt(usersCountAll.rows[0].count),
          successfulPayments: parseInt(paymentsCountAll.rows[0].count),
          totalPaymentsAmount: parseFloat(paymentsSumAll.rows[0].total),
          photoGenerations: parseInt(photoGenAll.rows[0].count),
          musicGenerations: parseInt(musicGenAll.rows[0].count)
        },
        last7Days: {
          usersCount: parseInt(usersCount7d.rows[0].count),
          successfulPayments: parseInt(paymentsCount7d.rows[0].count),
          totalPaymentsAmount: parseFloat(paymentsSum7d.rows[0].total),
          photoGenerations: parseInt(photoGen7d.rows[0].count),
          musicGenerations: parseInt(musicGen7d.rows[0].count)
        },
        today: {
          usersCount: parseInt(usersCountToday.rows[0].count),
          successfulPayments: parseInt(paymentsCountToday.rows[0].count),
          totalPaymentsAmount: parseFloat(paymentsSumToday.rows[0].total),
          photoGenerations: parseInt(photoGenToday.rows[0].count),
          musicGenerations: parseInt(musicGenToday.rows[0].count)
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

      return {
        all: {
          usersCount: parseInt(usersCountAll.rows[0].count),
          successfulPayments: parseInt(paymentsCountAll.rows[0].count),
          totalPaymentsAmount: parseFloat(paymentsSumAll.rows[0].total),
          photoGenerations: parseInt(photoGenAll.rows[0].count),
          musicGenerations: parseInt(musicGenAll.rows[0].count)
        },
        last7Days: {
          usersCount: parseInt(usersCount7d.rows[0].count),
          successfulPayments: parseInt(paymentsCount7d.rows[0].count),
          totalPaymentsAmount: parseFloat(paymentsSum7d.rows[0].total),
          photoGenerations: parseInt(photoGen7d.rows[0].count),
          musicGenerations: parseInt(musicGen7d.rows[0].count)
        },
        today: {
          usersCount: parseInt(usersCountToday.rows[0].count),
          successfulPayments: parseInt(paymentsCountToday.rows[0].count),
          totalPaymentsAmount: parseFloat(paymentsSumToday.rows[0].total),
          photoGenerations: parseInt(photoGenToday.rows[0].count),
          musicGenerations: parseInt(musicGenToday.rows[0].count)
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

  static async close() {
    await pool.end();
    console.log('🔌 Соединение с PostgreSQL закрыто');
  }
}