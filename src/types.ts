import { Context } from 'telegraf';

export interface BotContext extends Context {}

export interface UserState {
  step: 'waiting_photo' | 'waiting_description' | 'waiting_payment' | 'waiting_music_text' | 'waiting_music_style' | 'waiting_music_params' | null;
  photoFileId?: string;
  prompt?: string;
  paymentAmount?: number;
  paymentId?: string;
  musicText?: string;
  musicStyle?: string;
  refillSource?: 'photo' | 'profile' | 'music';
}