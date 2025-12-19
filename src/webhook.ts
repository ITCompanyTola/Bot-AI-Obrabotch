import express from 'express';
import { Database, UserRefferalData } from './database';
import { bot } from './bot';
import { Markup } from 'telegraf';
import { mainMenuKeyboard } from './constants';

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
      try {
        const refferalData: UserRefferalData = await Database.getUserRefferalData(userId);
        const userRefferalKey = refferalData?.userRefferalKey;
        const refferalKeyUsed = refferalData?.refferalKeyUsed;
        console.log(`🔑 Реферальные данные пользователя: userRefferalKey=${userRefferalKey}, refferalKeyUsed=${refferalKeyUsed}`);
        if (userRefferalKey != undefined && refferalKeyUsed != undefined) {
         if (!refferalKeyUsed) {
            const reffererUserId = await Database.getUserIdByRefferalKey(userRefferalKey);
            console.log(`🔑 Реферер пользователя: ${reffererUserId}`);
            if (reffererUserId) {
              await Database.addBalance(
                reffererUserId,
                100,
                `Реферальная программа`,
                'bonus'
              );

              await bot.telegram.sendMessage(reffererUserId, `🎉 На ваш счёт <b>начислено 100₽</b> за приглашённого пользователя`, {
                parse_mode: 'HTML',
              });
            }
          } 
        }
      } catch(error) {
        console.log('❌ Ошибка получения реферальных данных:', error);
      }
      
      
      console.log(`✅ Баланс пополнен: +${amount}₽ для пользователя ${userId}`);

      const newBalance = await Database.getUserBalance(userId);

      try {
        await bot.telegram.sendMessage(
          userId,
          `✅ <b>Платёж успешно получен!</b>\n\n💰 Зачислено: ${amount}₽\n💳 Ваш баланс: ${newBalance.toFixed(2)}₽`,
          {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard(mainMenuKeyboard)
          }
        );
      } catch (error) {
        console.error('Ошибка отправки уведомления пользователю:', error);
      }

    } else if (notification.event === 'payment.canceled') {
      console.log(`❌ Платёж ${notification.object.id} отменён`);
      // НЕ ОТПРАВЛЯЕМ УВЕДОМЛЕНИЕ ПОЛЬЗОВАТЕЛЮ
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('❌ Ошибка обработки webhook:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

export default app;
