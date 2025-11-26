"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatBalanceBox = formatBalanceBox;
exports.formatBalanceBoxPhoto = formatBalanceBoxPhoto;
exports.formatBalanceBoxMusic = formatBalanceBoxMusic;
function formatBalanceBox(balance) {
    return `<blockquote>💰 Ваш баланс: ${balance.toFixed(2)} ₽
📸 Оживление 1 фото = 85₽ / $1
🎵 Создание 1 трека = 15₽ / $0.2</blockquote>`;
}
function formatBalanceBoxPhoto(balance) {
    return `<blockquote>💰 Ваш баланс: ${balance.toFixed(2)} ₽
📸 Оживление 1 фото = 85₽ / $1</blockquote>`;
}
function formatBalanceBoxMusic(balance) {
    return `<blockquote>💰 Ваш баланс: ${balance.toFixed(2)} ₽
🎵 Создание 1 трека = 15₽ / $0.2</blockquote>`;
}
