import { Telegraf } from 'telegraf';
import { BotContext, UserState } from '../types';
import { registerMainMenuHandlers } from './mainMenu';
import { registerPhotoAnimationHandlers } from './photoAnimation';
import { registerMusicCreationHandlers } from './musicCreation';
import { registerProfileHandlers } from './profile';
import { registerPaymentHandlers } from './payment';
import { registerTextHandlers } from './textHandlers';
import { config } from '../config';

async function sendTGTrackWebhook(update: any) {
  // if (!config.tgtrackApiKey) return;
  //
  // try {
  //   await fetch(`https://bot-api.tgtrack.ru/v1/${config.tgtrackApiKey}/on_telegram_webhook`, {
  //     method: 'POST',
  //     headers: { 'Content-Type': 'application/json' },
  //     body: JSON.stringify(update)
  //   });
  // } catch (error) {
  //   console.error('TGTrack webhook error:', error);
  // }
}

export async function sendTGTrackUserStart(userId: number, firstName?: string, lastName?: string, username?: string, startValue?: string) {
  if (!config.tgtrackApiKey) return;
  
  try {
    const payload: any = {
      user_id: userId.toString(),
      first_name: firstName || ''
    };
    
    if (lastName) payload.last_name = lastName;
    if (username) payload.username = username;
    if (firstName && lastName) payload.full_name = `${firstName} ${lastName}`.trim();
    else if (firstName) payload.full_name = firstName;
    if (startValue) payload.start_value = startValue;
    
    await fetch(`https://bot-api.tgtrack.ru/v1/${config.tgtrackApiKey}/user_did_start_bot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    console.error('TGTrack user start error:', error);
  }
}

async function sendTGTrackBotStopped(userId: number) {
  if (!config.tgtrackApiKey) return;
  
  try {
    const payload = {
      user_id: userId.toString(),
      date: Math.floor(Date.now() / 1000)
    };
    
    await fetch(`https://bot-api.tgtrack.ru/v1/${config.tgtrackApiKey}/my_bot_was_stopped`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    console.error('TGTrack bot stopped error:', error);
  }
}

export function registerAllHandlers(bot: Telegraf<BotContext>, userStates: Map<number, UserState>) {
  bot.use(async (ctx, next) => {
    await sendTGTrackWebhook(ctx.update);
    return next();
  });

  bot.catch(async (err: any, ctx) => {
    console.error('Bot error:', err);
    
    if (err.response?.error_code === 403 && err.response?.description?.includes('blocked')) {
      const userId = ctx.from?.id;
      if (userId) {
        await sendTGTrackBotStopped(userId);
        console.log(`User ${userId} blocked the bot`);
      }
    }
  });

  registerMainMenuHandlers(bot, userStates);
  registerPhotoAnimationHandlers(bot, userStates);
  registerMusicCreationHandlers(bot, userStates);
  registerProfileHandlers(bot, userStates);
  registerPaymentHandlers(bot, userStates);
  registerTextHandlers(bot, userStates);
}
