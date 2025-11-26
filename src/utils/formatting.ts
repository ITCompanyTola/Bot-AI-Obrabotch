export function formatBalanceBox(balance: number): string {
  return `<blockquote>💰 Ваш баланс: ${balance.toFixed(2)} ₽
📸 Оживление 1 фото = 85₽ / $1
🎵 Создание 1 трека = 15₽ / $0.2</blockquote>`;
}

export function formatBalanceBoxPhoto(balance: number): string {
  return `<blockquote>💰 Ваш баланс: ${balance.toFixed(2)} ₽
📸 Оживление 1 фото = 85₽ / $1</blockquote>`;
}

export function formatBalanceBoxMusic(balance: number): string {
  return `<blockquote>💰 Ваш баланс: ${balance.toFixed(2)} ₽
🎵 Создание 1 трека = 15₽ / $0.2</blockquote>`;
}