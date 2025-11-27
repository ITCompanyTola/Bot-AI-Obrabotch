"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.config = {
    botToken: process.env.BOT_TOKEN || '',
    databaseUrl: process.env.DATABASE_URL || '',
    klingApiKey: process.env.KLING_API_KEY || '',
    sunoApiKey: process.env.SUNO_API_KEY || '',
    paymentApiKey: process.env.PAYMENT_API_KEY || '',
    shopId: process.env.SHOP_ID || '',
    callbackUrl: process.env.CALLBACK_URL || 'https://your-domain.com/api/callback',
    videoFileId: process.env.VIDEO_FILE_ID || '',
    photoFileId: process.env.PHOTO_FILE_ID || ''
};
