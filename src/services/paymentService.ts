import {YooCheckout} from '@a2seven/yoo-checkout';
import {config} from '../config';
import {logToFile} from '../bot';

const checkout = new YooCheckout({
    shopId: config.shopId,
    secretKey: config.paymentApiKey
});

function generateIdempotenceKey(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

export async function createPayment(amount: number, description: string, userId: number, email: string) {
    try {
        logToFile(`💳 createPayment started: amount=${amount}, userId=${userId}`);
        logToFile(`💳 shopId=${config.shopId}, hasSecretKey=${!!config.paymentApiKey}`);

        const idempotenceKey = generateIdempotenceKey();
        logToFile(`💳 idempotenceKey=${idempotenceKey}`);

        const payment = await checkout.createPayment({
            receipt: {
                customer: {
                  email: email,
                },
                items: [
                    {
                        description: "Автоматизированное создание мультимедийных рекламных материалов",
                        quantity: '1.000',
                        amount: {
                            value: amount.toFixed(2),
                            currency: 'RUB'
                        },
                        vat_code: 1,
                        payment_mode: "full_prepayment",
                        payment_subject: "service"
                    },
                ],
            },
            amount: {
                value: amount.toFixed(2),
                currency: 'RUB'
            },
            confirmation: {
                type: 'redirect' as const,
                return_url: `https://t.me/Obrabotych_bot`
            },
            capture: true,
            description: description,
            metadata: {
                user_id: userId.toString()
            }
        }, idempotenceKey);

        logToFile(`💳 Платеж создан: ${payment.id}`);

        return {
            paymentId: payment.id,
            confirmationUrl: (payment.confirmation as any).confirmation_url
        };
    } catch (error: any) {
        logToFile(`❌ createPayment ERROR: ${JSON.stringify(error)}`);
        logToFile(`❌ error.message: ${error?.message}`);
        logToFile(`❌ error.stack: ${error?.stack}`);
        logToFile(`❌ error full: ${JSON.stringify(error, Object.getOwnPropertyNames(error))}`);
        throw error;
    }
}

export async function checkPaymentStatus(paymentId: string): Promise<string> {
    try {
        const payment = await checkout.getPayment(paymentId);
        logToFile(`📊 Статус платежа ${paymentId}: ${payment.status}`);
        return payment.status;
    } catch (error: any) {
        logToFile(`❌ checkPaymentStatus ERROR: ${JSON.stringify(error)}`);
        throw error;
    }
}
