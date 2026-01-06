import { TELEGRAM_CHANNEL_ID } from "../constants";
import { bot } from "../bot";

const CHANNEL_ID = TELEGRAM_CHANNEL_ID;

export async function isSubscribed(userId: number): Promise<boolean> {
  try {
    const member = await bot.telegram.getChatMember(CHANNEL_ID, userId);

    return (
      member.status === "member" ||
      member.status === "administrator" ||
      member.status === "creator"
    );
  } catch (error) {
    console.error("Ошибка проверки подписки:", error);
    return false;
  }
}
