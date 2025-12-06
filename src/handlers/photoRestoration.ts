import { Telegraf, Markup } from 'telegraf';
import { BotContext, UserState } from '../types';
import { Database } from '../database';
import { PRICES } from '../constants';

const PHOTO_FILE_ID = 'загрузить и вставить свое';

export function registerPhotoRestorationHandlers(bot: Telegraf<BotContext>, userState: Map<number, UserState>) {
  console.log('Регистрация ручек для восстановления фото');
}
