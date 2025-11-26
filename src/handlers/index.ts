import { Telegraf } from 'telegraf';
import { BotContext, UserState } from '../types';
import { registerMainMenuHandlers } from './mainMenu';
import { registerPhotoAnimationHandlers } from './photoAnimation';
import { registerMusicCreationHandlers } from './musicCreation';
import { registerProfileHandlers } from './profile';
import { registerPaymentHandlers } from './payment';
import { registerTextHandlers } from './textHandlers';

export function registerAllHandlers(bot: Telegraf<BotContext>, userStates: Map<number, UserState>) {
  registerMainMenuHandlers(bot, userStates);
  registerPhotoAnimationHandlers(bot, userStates);
  registerMusicCreationHandlers(bot, userStates);
  registerProfileHandlers(bot, userStates);
  registerPaymentHandlers(bot, userStates);
  registerTextHandlers(bot, userStates);
}