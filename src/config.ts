import dotenv from 'dotenv';

dotenv.config();

export const config = {
  botToken: process.env.BOT_TOKEN || '',
  databaseUrl: process.env.DATABASE_URL || '',
  klingApiKey: process.env.KLING_API_KEY || '',
  sunoApiKey: process.env.SUNO_API_KEY || '',
  paymentApiKey: process.env.PAYMENT_API_KEY || '',
  shopId: process.env.SHOP_ID || '',
  callbackUrl: process.env.CALLBACK_URL || 'https://your-domain.com/api/callback'
};