"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const telegraf_1 = require("telegraf");
const config_1 = require("./config");
const database_1 = require("./database");
const handlers_1 = require("./handlers");
const webhookServer_1 = require("./services/webhookServer"); // Из services!
const bot = new telegraf_1.Telegraf(config_1.config.botToken);
const userStates = new Map();
database_1.Database.initialize().catch(console.error);
(0, handlers_1.registerAllHandlers)(bot, userStates);
(0, webhookServer_1.startWebhookServer)(3000);
bot.launch()
    .then(() => console.log('✅ Бот запущен'))
    .catch((err) => console.error('❌ Ошибка:', err));
process.once('SIGINT', async () => {
    await database_1.Database.close();
    bot.stop('SIGINT');
});
process.once('SIGTERM', async () => {
    await database_1.Database.close();
    bot.stop('SIGTERM');
});
