import { Telegraf } from 'telegraf';
import { BotContext, UserState } from '../types';
import { processDMPhotoCreation, processPhotoRestoration } from '../services/nanoBananaService';
import { processPhotoColorize, processPostcardCreationWithBananaPro } from '../services/nanoBananaProService';
import { POSTCARD_PHOTO_PROMPT } from '../constants';


export function registerDocumentHandler(bot: Telegraf<BotContext>, userStates: Map<number, UserState>) {
  bot.on('document', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    console.log('Тип полученного документа: ', ctx.message.document.mime_type);

    const userState = userStates.get(userId);
    if (!userState) return;

    const callbackActions = {
      revive: 'photo_animation',
      restoration: 'photo_restoration',
      colorize: 'photo_colorize',
      dm_photo: 'ded_moroz_start',
      postcard: 'postcard'
    }
    let callbackData = callbackActions.revive;
    if (userState.step === 'waiting_for_restoration_photo') callbackData = callbackActions.restoration;
    if (userState.step === 'waiting_for_colorize_photo') callbackData = callbackActions.colorize;
    if (userState.step === 'waiting_DM_photo_generation') callbackData = callbackActions.dm_photo;
    if (userState.step === 'waiting_postcard_photo') callbackData = callbackActions.postcard;

    if (!ctx.message.document.mime_type?.startsWith('image/')) {
      await ctx.reply('Документ может быть только фотографией! Попробуйте снова.', {
        reply_markup: {
          inline_keyboard: [[{text: 'Назад', callback_data: callbackData}]]
        }
      })
      return;
    }

    const photoFileId = ctx.message.document.file_id;
    console.log(photoFileId);

    if (userState?.step === 'waiting_photo') {
      userStates.set(userId, {
        step: 'waiting_description',
        photoFileId: photoFileId,
      });
    
      const descriptionMessage = `
📝 <b>Опишите, как должна ожить фотография</b>

Укажите, что именно должно происходить с каждым человеком на фото: отдельно или все вместе.

<b>Например:</b>
- Улыбается на камеру без видимых зубов;
- Машет рукой в камеру;
- Нежно обнимает человека и целует его;
…и любые другие подобные действия ✨

❗️<b>Важно:</b>

- <b><i>Не пишите слишком длинный и сложный запрос</i></b>, это всего лишь оживление фотографии до 5 секунд, а не сложный видеоролик

- <b><i>Не присылайте 18+ контент</i></b> и описания соответствующих действий. Такие запросы не обрабатываются, и оплата за генерацию возвращена не будет.

- <b><i>Допустимо</i></b> присылать фото в купальнике или белье с нейтральным описанием вроде "Позирует на камеру"`.trim();

      await ctx.reply(descriptionMessage, { parse_mode: 'HTML' });
    }

    if (userState.step === 'waiting_for_restoration_photo') {
      const prompt = 'Restore this old photo: improve sharpness, remove defects, but preserve the original colors without recoloring.';

      processPhotoRestoration(ctx, userId, photoFileId, prompt);

      userStates.delete(userId);
    }

    if (userState.step === 'waiting_for_colorize_photo') {
      const prompt = 'Convert a black-and-white photo to color and improve the quality and clarity of the photo';

      processPhotoColorize(ctx, userId, photoFileId, prompt);

      userStates.delete(userId);
    }

    if (userState?.step === 'waiting_postcard_photo') {
      const postcardPrompt = POSTCARD_PHOTO_PROMPT;

      processPostcardCreationWithBananaPro(ctx, userId, photoFileId, postcardPrompt);

      userStates.delete(userId);
    }

    if (userState.step === 'waiting_DM_photo_generation') {
      const prompt = 'Russian Father Frost, long red coat down to the floor, thick white fur trim, gold braid, red belt, tall red hat with fur and gold trim, very long curly white beard down to his waist, red mittens with fur, majestic posture, photorealistic, premium class. Santa Claus should be approximately 165 cm tall and fit well into the loaded image';
      userStates.set(userId, {
        ...userState,
        photoFileId: photoFileId
      });
      const newUserState = userStates.get(userId);
      if (newUserState === undefined) return;
      processDMPhotoCreation(ctx, userId, newUserState, prompt);
    }
  });
}