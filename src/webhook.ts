import express from 'express';
import { Database } from './database';
import { bot } from './bot';
import { Markup } from 'telegraf';

const app = express();
app.use(express.json());

interface YooKassaWebhook {
  type: string;
  event: string;
  object: {
    id: string;
    status: string;
    paid: boolean;
    amount: {
      value: string;
      currency: string;
    };
    metadata: {
      user_id: string;
    };
    created_at: string;
  };
}

app.post('/webhook/yookassa', async (req, res) => {
  try {
    const notification: YooKassaWebhook = req.body;
    
    console.log('📩 Получен webhook от ЮKassa:', JSON.stringify(notification, null, 2));

    if (notification.event === 'payment.succeeded' && notification.object.paid) {
      const paymentId = notification.object.id;
      const amount = parseFloat(notification.object.amount.value);
      const userId = parseInt(notification.object.metadata.user_id);

      console.log(`💳 Успешная оплата: ${paymentId}, сумма: ${amount}₽, пользователь: ${userId}`);

      const isProcessed = await Database.isPaymentProcessed(paymentId);
      
      if (isProcessed) {
        console.log(`⚠️ Платёж ${paymentId} уже был обработан ранее`);
        res.status(200).send('OK');
        return;
      }

      await Database.addBalance(
        userId,
        amount,
        `Пополнение баланса через ЮKassa (${paymentId})`,
        'refill'
      );

      console.log(`✅ Баланс пополнен: +${amount}₽ для пользователя ${userId}`);

      // Получаем новый баланс
      const newBalance = await Database.getUserBalance(userId);

      // Отправляем уведомление пользователю
      try {
        await bot.telegram.sendMessage(
          userId,
          `✅ <b>Платёж успешно получен!</b>\n\n💰 Зачислено: ${amount}₽\n💳 Ваш баланс: ${newBalance.toFixed(2)}₽`,
          {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
              [Markup.button.callback('📸 Оживить фото', 'photo_animation')],
              [Markup.button.callback('🎶 Создать музыку', 'music_creation')],
              [Markup.button.callback('Главное меню', 'main_menu')]
            ])
          }
        );
      } catch (error) {
        console.error('Ошибка отправки уведомления пользователю:', error);
      }

    } else if (notification.event === 'payment.canceled') {
      console.log(`❌ Платёж ${notification.object.id} отменён`);
      
      const userId = parseInt(notification.object.metadata.user_id);
      
      try {
        await bot.telegram.sendMessage(
          userId,
          '❌ Платёж был отменён или не прошёл.\n\nПопробуйте снова или обратитесь в поддержку.',
          Markup.inlineKeyboard([
            [Markup.button.callback('💳 Попробовать снова', 'refill_balance')],
            [Markup.button.callback('Поддержка', 'support')]
          ])
        );
      } catch (error) {
        console.error('Ошибка отправки уведомления об отмене:', error);
      }
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('❌ Ошибка обработки webhook:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

export default app;