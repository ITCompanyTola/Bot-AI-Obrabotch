import { Context } from 'telegraf';

export interface BotContext extends Context {}

export interface Broadcast {
  message: string;
  entities: any;
  photoFileId?: string;
  videoFileId?: string;
}

export type UserStep = 
  | 'waiting_photo' 
  | 'waiting_for_restoration_photo' 
  | 'waiting_for_colorize_photo'
  | 'waiting_description' 
  | 'waiting_payment' 
  | 'waiting_music_text' 
  | 'waiting_music_style' 
  | 'waiting_music_params' 
  | 'waiting_email'
  | 'waiting_broadcast_message'
  | 'waiting_broadcast_photo'
  | 'waiting_broadcast_video'
  | null;

export interface UserState {
  step: UserStep;
  photoFileId?: string;
  prompt?: string;
  paymentAmount?: number;
  paymentId?: string;
  musicText?: string;
  musicStyle?: string;
  refillSource?: 'photo' | 'profile' | 'music' | 'restoration' | 'colorize';
  pendingPaymentAmount?: number;
}