"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPayment = createPayment;
exports.checkPaymentStatus = checkPaymentStatus;
const yoo_checkout_1 = require("@a2seven/yoo-checkout");
const config_1 = require("../config");
const checkout = new yoo_checkout_1.YooCheckout({
    shopId: config_1.config.shopId,
    secretKey: config_1.config.paymentApiKey
});
function generateIdempotenceKey() {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}
async function createPayment(amount, description, userId) {
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
            confirmationUrl: payment.confirmation.confirmation_url
        };
    }
    catch (error) {
        console.error('Ошибка создания платежа:', error);
        throw error;
    }
}
async function checkPaymentStatus(paymentId) {
    try {
        const payment = await checkout.getPayment(paymentId);
        console.log(`Статус платежа ${paymentId}: ${payment.status}`);
        return payment.status; // 'pending', 'succeeded', 'canceled'
    }
    catch (error) {
        console.error('Ошибка проверки платежа:', error);
        throw error;
    }
}
