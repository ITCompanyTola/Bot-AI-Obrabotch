import express from 'express';
import { Database } from '../database';
import { Telegraf } from 'telegraf';
import { config } from '../config';

const app = express();
app.use(express.json());

const bot = new Telegraf(config.botToken);

app.post('/webhook/yookassa', async (req, res) => {
  try {
    const notification = req.body;
    
    console.log('📨 Получено уведомление от ЮKassa:', JSON.stringify(notification, null, 2));
    
    if (notification.event === 'payment.succeeded') {
      const payment = notification.object;
      const userId = parseInt(payment.metadata?.user_id);
      const amount = parseFloat(payment.amount.value);
      const paymentId = payment.id;
      
      if (!userId || !amount) {
        console.error('❌ Не найден user_id или amount в платеже');
        return res.status(400).json({ error: 'Invalid payment data' });
      }
      
      const alreadyProcessed = await Database.isPaymentProcessed(paymentId);
      
      if (alreadyProcessed) {
        console.log(`⚠️ Платеж ${paymentId} уже был обработан ранее`);
        return res.status(200).json({ status: 'already_processed' });
      }
      
      await Database.addBalance(
        userId,
        amount,
        `Пополнение баланса (${paymentId})`,
        'refill'
      );
      
      const newBalance = await Database.getUserBalance(userId);
      console.log(`✅ Автоматически начислено ${amount}₽ пользователю ${userId}. Новый баланс: ${newBalance}₽`);
      
      try {
        await bot.telegram.sendMessage(
          userId,
          `✅ Платеж успешно получен!\n\n💰 Начислено: ${amount}₽\n💳 Ваш новый баланс: ${newBalance.toFixed(2)}₽\n\nТеперь вы можете создавать контент!`,
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: '📸 Оживить фото', callback_data: 'photo_animation' }],
                [{ text: '🎶 Создать музыку', callback_data: 'music_creation' }],
                [{ text: 'Главное меню', callback_data: 'main_menu' }]
              ]
            }
          }
        );
      } catch (telegramError) {
        console.error('❌ Ошибка отправки уведомления в Telegram:', telegramError);
      }
      
      return res.status(200).json({ status: 'ok' });
    }
    
    return res.status(200).json({ status: 'ok' });
    
  } catch (error) {
    console.error('❌ Ошибка обработки webhook:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'yookassa-webhook' });
});

export function startWebhookServer(port: number = 3000) {
  app.listen(port, '0.0.0.0', () => {
    console.log(`🌐 Webhook сервер запущен на порту ${port}`);
    console.log(`📍 Endpoint: http://your-domain:${port}/webhook/yookassa`);
  });
}