import express from 'express';
import { Database, UserRefferalData } from './database';
import { bot } from './bot';
import { Markup } from 'telegraf';
import { mainMenuKeyboard } from './constants';
import crypto from 'crypto';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


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
      
      let bonus: number = 30;
      if (amount > 200) bonus = 90;
      if (amount > 500) bonus = 480;
      if (amount > 1000) bonus = 1440;

      const finalAmount = amount + bonus;
      await Database.addBalance(
        userId,
        finalAmount,
        `Пополнение баланса через ЮKassa (${paymentId})`,
        'refill'
      );
      try {
        const refferalData: UserRefferalData = await Database.getUserRefferalData(userId);
        console.log(refferalData);
        const userRefferalKey = refferalData?.source_key;
        const refferalKeyUsed = refferalData?.refferal_key_used;
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

              await Database.setRefferalKeyUsed(userId);

              await bot.telegram.sendMessage(reffererUserId, `🎉 На ваш счёт <b>начислено 100₽</b> за приглашённого пользователя`, {
                parse_mode: 'HTML',
              });
              console.log(`✅ Реферальная программа: +100₽ для пользователя ${reffererUserId}`);
            }
          } 
        }
      } catch(error) {
        console.log('❌ Ошибка получения реферальных данных:', error);
      }
      
      console.log(`✅ Баланс пополнен: +${(amount + bonus)}₽ для пользователя ${userId}`);

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

app.post('/webhook/robokassa', async (req, res) => {
  try {
    const {
      OutSum,
      InvId,
      SignatureValue,
      Shp_user_id
    } = req.body;

    console.log('📩 Robokassa webhook:', req.body);

    // 1. Проверка подписи (PASS2)
    const crcString =
      `${OutSum}:${InvId}:${process.env.ROBOKASSA_PASS_2}:Shp_user_id=${Shp_user_id}`;
    const expectedCrc = crypto
      .createHash('md5')
      .update(crcString)
      .digest('hex')
      .toLowerCase();

    if (expectedCrc !== SignatureValue.toLowerCase()) {
      console.error('❌ Неверная подпись Robokassa');
      return res.status(400).send('bad signature');
    }

    const userId = Number(Shp_user_id);
    const amount = Number(OutSum);

    const isProcessed = await Database.isPaymentProcessed(InvId);
    if (isProcessed) {
      return res.send(`OK${InvId}`);
    }

    let bonus: number = 30;
      if (amount > 200) bonus = 90;
      if (amount > 500) bonus = 480;
      if (amount > 1000) bonus = 1440;

      const finalAmount = amount + bonus;
      await Database.addBalance(
        userId,
        finalAmount,
        `Пополнение баланса через Robokassa (${InvId})`,
        'refill'
      );
      try {
        const refferalData: UserRefferalData = await Database.getUserRefferalData(userId);
        console.log(refferalData);
        const userRefferalKey = refferalData?.source_key;
        const refferalKeyUsed = refferalData?.refferal_key_used;
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

              await Database.setRefferalKeyUsed(userId);

              await bot.telegram.sendMessage(reffererUserId, `🎉 На ваш счёт <b>начислено 100₽</b> за приглашённого пользователя`, {
                parse_mode: 'HTML',
              });
              console.log(`✅ Реферальная программа: +100₽ для пользователя ${reffererUserId}`);
            }
          } 
        }
      } catch(error) {
        console.log('❌ Ошибка получения реферальных данных:', error);
      }
      
      console.log(`✅ Баланс пополнен: +${(amount + bonus)}₽ для пользователя ${userId}`);

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

      return res.send(`OK${InvId}`)
    } catch (error) {
      console.error('❌ Ошибка обработки webhook:', error);
      res.status(500).send('Internal Server Error');
    }
});


app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

export default app;
