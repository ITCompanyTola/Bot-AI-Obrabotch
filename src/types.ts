import { Context } from "telegraf";

export interface BotContext extends Context {}

export interface Broadcast {
  message: string;
  entities: any;
  photoFileId?: string;
  videoFileId?: string;
  button?: {
    text: string;
    callbackData: string;
  };
  bonusAmount?: number;
}

export type UserStep =
  | "waiting_photo"
  | "waiting_for_restoration_photo"
  | "waiting_for_colorize_photo"
  | "waiting_description"
  | "waiting_music_text"
  | "waiting_music_style"
  | "waiting_music_params"
  | "waiting_email"
  | "waiting_broadcast_message"
  | "waiting_broadcast_photo"
  | "waiting_broadcast_video"
  | "waiting_broadcast_button_text"
  | "waiting_broadcast_button_callback"
  | "waiting_broadcast_bonus"
  | "waiting_DM_photo_generation"
  | "waiting_DM_text"
  | "waiting_postcard_text"
  | "waiting_postcard_photo"
  | "waiting_postcard_christmas"
  | null;

export interface UserState {
  step: UserStep;
  photoFileId?: string;
  prompt?: string;
  generatedPrompt?: string;
  paymentAmount?: number;
  paymentId?: string;
  musicText?: string;
  musicStyle?: string;
  refillSource?:
    | "photo"
    | "profile"
    | "music"
    | "restoration"
    | "colorize"
    | "dm"
    | "postcardPhoto"
    | "postcardChristmas"
    | "postcardText";
  pendingPaymentAmount?: number;
  freeGenerations?: number;
  regenPromptAttempts?: number;
  dmPhotoFileId?: string;
  broadcastButtonText?: string;
  broadcastButtonCallback?: string;
}

export interface MailingData {
  id: number;
  admin_id: number;
  message: string;
  entities: any;
  photo_file_id?: string;
  video_file_id?: string;
  button_text?: string;
  button_callback?: string;
  bonus_amount?: number;
  total_users: number;
  sent_count: number;
  failed_count: number;
  blocked_count: number;
  status: "processing" | "completed" | "failed";
  created_at: Date;
  completed_at?: Date;
}

export interface CreateMailingData {
  admin_id: number;
  message: string;
  entities: any;
  photo_file_id?: string;
  video_file_id?: string;
  button_text?: string;
  button_callback?: string;
  bonus_amount?: number;
  total_users: number;
}

export interface MailingTask {
  id: number;
  mailing_id: number;
  user_id: number;
  status: "sent" | "failed" | "blocked";
  attempts: number;
  error_message?: string;
  sent_at?: Date;
  created_at: Date;
}

export interface CreateMailingTask {
  mailing_id: number;
  user_id: number;
  status: "sent" | "failed" | "blocked";
  error_message?: string;
  attempts?: number;
}

export interface UpdateMailingStats {
  total_users?: number;
  sent_count?: number;
  failed_count?: number;
  blocked_count?: number;
  status?: "processing" | "completed" | "failed";
}

export interface MailingJobData {
  mailingId: number;
  adminId: number;
  chunkSize: number;
  delayBetweenMessages: number;
}

export interface MailingProgress {
  sent: number;
  failed: number;
  blocked: number;
}
