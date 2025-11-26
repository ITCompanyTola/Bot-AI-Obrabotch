import { YooCheckout } from '@a2seven/yoo-checkout';
import { config } from '../config';

const checkout = new YooCheckout({
  shopId: config.shopId,
  secretKey: config.paymentApiKey
});

function generateIdempotenceKey(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

export async function createPayment(amount: number, description: string, userId: number) {
  try {
    const idempotenceKey = generateIdempotenceKey();
    
    const payment = await checkout.createPayment({
      amount: {
        value: amount.toFixed(2),
        currency: 'RUB'
      },
      confirmation: {
        type: 'redirect',
        return_url: `https://t.me/your_bot_username`
      },
      capture: true,
      description: description,
      metadata: {
        user_id: userId.toString()
      }
    }, idempotenceKey);

    console.log('Платеж создан:', payment);

    return {
      paymentId: payment.id,
      confirmationUrl: (payment.confirmation as any).confirmation_url
    };
  } catch (error) {
    console.error('Ошибка создания платежа:', error);
    throw error;
  }
}

export async function checkPaymentStatus(paymentId: string): Promise<string> {
  try {
    const payment = await checkout.getPayment(paymentId);
    console.log(`Статус платежа ${paymentId}: ${payment.status}`);
    return payment.status; // 'pending', 'succeeded', 'canceled'
  } catch (error) {
    console.error('Ошибка проверки платежа:', error);
    throw error;
  }
}