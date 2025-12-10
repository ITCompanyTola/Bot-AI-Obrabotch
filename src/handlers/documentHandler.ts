import { Telegraf, Markup } from 'telegraf';
import { BotContext, UserState } from '../types';
import { Database } from '../database';
import { PRICES } from '../constants';
import { processVideoGeneration } from '../services/klingService';
import { logToFile } from '../bot';
import { processPhotoRestoration } from '../services/nanoBananaService';
import { processPhotoColorize } from '../services/nanoBananaProService';

export function registerDocumentHandler(bot: Telegraf<BotContext>, userStates: Map<number, UserState>) {
  bot.on('document', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const userState = userStates.get(userId);
    if (!userState) return;

    const callbackActions = {
      revive: 'photo_animation',
      restoration: 'photo_restoration',
      colorize: 'photo_colorize'
    }
    let callbackData = callbackActions.revive;
    if (userState.step === 'waiting_for_restoration_photo') callbackData = callbackActions.restoration;
    if (userState.step === 'waiting_for_colorize_photo') callbackData = callbackActions.colorize;

    if (!ctx.message.document.mime_type?.startsWith('image/')) {
      await ctx.reply('Документ может быть только фотографией! Попробуйте снова.', {
        reply_markup: {
          inline_keyboard: [[{text: 'Назад', callback_data: callbackData}]]
        }
      })
    }

    const photoFileId = ctx.message.document.file_id;
    console.log(photoFileId);

    if (userState?.step === 'waiting_photo') {
      userStates.set(userId, {
        step: 'waiting_description',
        photoFileId: photoFileId,
      });
    
      const descriptionMessage = `
🖼 <b>Опишите, как должна ожить фотография</b>

Укажите, что именно должно происходить с каждым человеком на фото: отдельно или все вместе.
Например:
Позирует на камеру
- Показывает язык
- Машет рукой
- Выходит из кадра
- Девушка обнимает мужчину
- Внук целует бабушку в щеку
…и любые другие подобные действия ✨

❗️<b>Важно:</b>

- <b><i>Не присылайте 18+ контент</i></b> и описания соответствующих действий. Такие запросы не обрабатываются, и оплата за генерацию возвращена не будет.

- <b><i>Допустимо</i></b> присылать фото в купальнике или белье с нейтральным описанием вроде "Позирует на камеру" — мы не звери 😅
    `.trim();

      await ctx.reply(descriptionMessage, { parse_mode: 'HTML' });
    }

    if (userState.step === 'waiting_for_restoration_photo') {
      const prompt = 'Restore the photo';

      processPhotoRestoration(ctx, userId, photoFileId, prompt);

      userStates.delete(userId);
    }

    if (userState.step === 'waiting_for_colorize_photo') {
      const prompt = 'Convert a black-and-white photo to color and improve the quality and clarity of the photo';

      processPhotoColorize(ctx, userId, photoFileId, prompt);
    }
  });
}