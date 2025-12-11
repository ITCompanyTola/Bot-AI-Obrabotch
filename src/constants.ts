import { Markup } from "telegraf";


export const PRICES = {
  PHOTO_ANIMATION: 80,
  MUSIC_CREATION: 165,
  PHOTO_RESTORATION: 35,
  PHOTO_COLORIZE: 35,
};

export const mainMenuKeyboard = [
  [Markup.button.callback('Написать в поддержку', 'support')],
  [
    Markup.button.callback('📸 Оживить фото', 'photo_animation'),
    Markup.button.callback('🎶 Создать музыку', 'music_creation')
  ],
  [
    Markup.button.callback('✨ Реставрировать фото', 'photo_restoration'),
    Markup.button.callback('🎨 ч/б в цветное фото', 'photo_colorize')
  ],
  [Markup.button.callback('Личный кабинет', 'profile')]
]
