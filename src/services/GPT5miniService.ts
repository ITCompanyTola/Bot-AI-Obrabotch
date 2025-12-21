import { Database } from "../database";
import { MAIN_MENU_MESSAGE, mainMenuKeyboard, POSTCARD_GENERATION_PROMPT, PRICES } from "../constants";
import axios from "axios";
import { Markup } from "telegraf";
import { connect } from "http2";

export async function generatePostcard(ctx: any, userId: number, prompt: string, photoFileId?: string): Promise<void> {
  try {
    if (photoFileId) {
      const deducted = await Database.deductBalance(
      userId,
      PRICES.POSTCARD_PHOTO,
      'Создание открытки'
    );

    if (!deducted) {
      await ctx.telegram.sendMessage(
        userId,
        '❌ Недостаточно средств для генерации'
      );
      return;
    }
    } else {
      const deducted = await Database.deductBalance(
      userId,
      PRICES.POSTCARD_TEXT,
      'Создание открытки'
    );

    if (!deducted) {
      await ctx.telegram.sendMessage(
        userId,
        '❌ Недостаточно средств для генерации'
      );
      return;
    }
    }

    await ctx.telegram.sendMessage(userId, '⏳ Начинаю генерацию... Это займет около 3-х минут.');
    
    const imageUrl = photoFileId ? await ctx.telegram.getFileLink(photoFileId) : null;
    const messages: any[] = [];
    if (imageUrl) {
      messages.push({
        role: "user",
        content: [
          {
            type: "text",
            text: prompt,
          },
          {
            type: "image_url",
            image_url: {
              url: imageUrl,
            },
          },
        ],
      });
    } else {
      messages.push({
        role: "user",
        content: prompt,
      }, {
        role: "system",
        content: POSTCARD_GENERATION_PROMPT,
      });
    }


    console.log(messages);

    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions", 
      {
        model: "google/gemini-3-pro-image-preview",
        messages: messages,
        modalities: ['image', 'text'],
      },
      {
        headers: {
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );
    console.log(response);
    const message = response.data.choices[0].message;

    const imageUrlFromModel = message.images?.[0]?.image_url?.url;

    if (imageUrlFromModel.startsWith("data:image")) {
      const base64Data = imageUrlFromModel.split(",")[1];
      const buffer = Buffer.from(base64Data, "base64");

      const sentMessage = await ctx.telegram.sendPhoto(
        userId,
        { source: buffer },
        {
          caption: "✅ <b>Ваша открытка готова!</b>",
          parse_mode: "HTML",
        }
      );
      const fileId = sentMessage.photo[sentMessage.photo.length - 1].file_id;
      if (photoFileId) {
        await Database.saveGeneratedFile(userId, 'postcard_photo', fileId, prompt);
      } else {
        await Database.saveGeneratedFile(userId, 'postcard_text', fileId, prompt);
      }
    } else {
      // обычный https URL
      const sentMessage = await ctx.telegram.sendPhoto(
        userId,
        imageUrlFromModel,
        {
          caption: "✅ <b>Ваша открытка готова!</b>",
          parse_mode: "HTML",
        }
      );

      const fileId = sentMessage.photo[sentMessage.photo.length - 1].file_id;
      if (photoFileId) {
        await Database.saveGeneratedFile(userId, 'postcard_photo', fileId, prompt);
      } else {
        await Database.saveGeneratedFile(userId, 'postcard_text', fileId, prompt);
      }
    }

    const mainMenuMessage = MAIN_MENU_MESSAGE;
    
        await ctx.telegram.sendMessage(
          userId,
          mainMenuMessage,
          {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard(mainMenuKeyboard)
        });
  } catch (error) {
    console.error('❌ Ошибка генерации открытки:', error);
    if (photoFileId) {
      await Database.addBalance(
      userId,
      PRICES.POSTCARD_PHOTO,
      'Возврат средств за ошибку генерации',
      'bonus'
    );

    console.log(`💰 Возвращено ${PRICES.POSTCARD_PHOTO}₽ пользователю ${userId}`);
    } else {
      await Database.addBalance(
      userId,
      PRICES.POSTCARD_TEXT,
      'Возврат средств за ошибку генерации',
      'bonus'
    );

    console.log(`💰 Возвращено ${PRICES.POSTCARD_TEXT}₽ пользователю ${userId}`);
    }
    
    await ctx.telegram.sendMessage(
      userId,
      '❌ Произошла ошибка при генерации. Средства возвращены на баланс.'
    );
  }
}