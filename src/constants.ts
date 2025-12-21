import { Markup } from "telegraf";


export const PRICES = {
  PHOTO_ANIMATION: 80,
  MUSIC_CREATION: 165,
  PHOTO_RESTORATION: 35,
  PHOTO_COLORIZE: 35,
  DED_MOROZ: 195,
  POSTCARD_TEXT: 45,
  POSTCARD_PHOTO: 60
};

export const mainMenuKeyboard = [
  [Markup.button.callback('🎅 Поздравление Д.Мороза', 'ded_moroz')],
  [Markup.button.callback('🏞 Создать открытку', 'postcard')],
  [
    Markup.button.callback('📸 Оживить фото', 'photo_animation'),
    Markup.button.callback('🎶 Создать музыку', 'music_creation')
  ],
  [
    Markup.button.callback('✨ Реставрировать фото', 'photo_restoration'),
    Markup.button.callback('🎨 ч/б в цветное фото', 'photo_colorize')
  ],
  [Markup.button.callback('Написать в поддержку', 'support')],
  [Markup.button.callback('Личный кабинет', 'profile')]
]

export const MAIN_MENU_MESSAGE = `
💎 <b>Наш бот умеет:</b>

- делать волшебные <b><i>поздравления от Деда Мороза</i></b> 🎅
- создавать <b><i>любые открытки</i></b> 🏞
- <b><i>оживлять фото</i></b> 📸
- создавать <b><i>крутые треки</i></b> 🎶
- <b><i>реставрировать</i></b> старые\n<b><i>фотографии</i></b> ✨
- переводить ч/б фото в <b><i>цветные</i></b> 🎨

<u>Вы можете творить сами или доверить работу нам</u> 🤝`.trim();

export const getDedMorozMessage = (balance: number) => `
<b>🎅 Хотите личное видео-поздравление от Деда Мороза на своём фото?</b>

Вот как подарить самые тёплые новогодние пожелания:

1️⃣ Нажмите кнопку 
<b>«🎅Поздравление Д.Мороза»</b>
2️⃣ <b><i>Отправьте одну фотографию* в бот</i></b> (любую — квартиры или офиса)
3️⃣ <b><i>Немного подождите</i></b> — примерно через 3 минуты бот отправит готовое фото с Дедом Морозом ❄️
4️⃣ Нажмите кнопку <b><i>«Подтвердить»</i></b> и напишите <b><i>описание</i></b> по нашему примеру, что именно должен сказать Дед Мороз. 
5️⃣ <b><i>Немного подождите</i></b> — примерно через 3 минуты бот отправит готовое видео, где Дед Мороз лично поздравляет вашего ребёнка ❤️

🔄 Если <b><i>фото с Дедом Морозом не понравилось</i></b> — вы можете нажать кнопку <b><i>«Повторить»</i></b> и сгенерировать ещё <b><i>до 2-х раз (всего 3 попытки)</i></b>. Мы хотим, чтобы поздравление было <b><i>идеальным</i></b>! ✨

<blockquote>💰 Ваш баланс: ${balance.toFixed(2)} ₽
🎅 Генерация 1 поздравления = ${PRICES.DED_MOROZ}₽</blockquote>

❗️<b>* - бот генерирует только одно фото и видео за раз</b>☝🏻`.trim()

export const dedMorozStartMessage =`
<b>Пример</b> ⤴️

Отправьте <b><i>фотографию</i></b> — бот добавит на нее Деда Мороза 🎅`.trim()

export const dedMorozStartMessageWithoutPhoto =`Отправьте <b><i>фотографию</i></b> — бот добавит на нее Деда Мороза 🎅`.trim()

export const DED_MOROZ_INSTRUCTION = `
<b>📹 Видео-инструкция по генерации поздравления с Дедом Морозом</b>

Смотрите короткое видео, чтобы правильно и качественно выполнять шаги и получать потрясающие результаты 🔥`.trim()

export const OPENROUTER_SERVICE_PROMPT = `Ты — профессиональный редактор промптов.

Твоя единственная задача: взять промпт пользователя и переписать его так, чтобы он стал более эффективным для генератора, оставаясь максимально близким к оригиналу по смыслу.

Обязательно добавь в переписанный промпт следующие требования (интегрируй их естественно, без изменения смысла оригинала):
- движения плавные, спокойные, реалистичные, естественные;
- никаких искажений лица, никаких артефактов, никаких резких или преувеличенных эмоций;
- используй лица строго с загруженной фотографии (один к одному);
- мимика полностью соответствуют оригиналу, сохраняют все черты (форма глаз, губ, носа и т.д.);
- не менять внешность людей, одежду, окружение и общий стиль сцены;
- не добавляй новых людей.

Сохраняй исходный состав сцены, ракурс, освещение и все детали, которые указал пользователь.

Выводи ТОЛЬКО улучшенный промпт, без кавычек, без пояснений, без нумерации и без дополнительных слов.

Длина улучшенного промпта — не более 500 символов.`.trim();

export const POSCTARD_MESSAGE = `
<b>🏞 Волшебная открытка для особенного момента! ✨</b>

Создайте уникальную открытку всего за пару шагов — <b><i>для поздравления, сюрприза или тёплого знака внимания</i></b> ❤️

💌 <b>Открытка из текста</b>
Слово за словом превращается в красивую открытку, идеально подходящую для <b><i>поздравлений, сюрпризов</i></b> и самых <b><i>тёплых пожеланий</i></b> 🌷

🏞  <b>Открытка из фото</b>
Ваше фото превращается в персональную открытку с <b><i>новогодней атмосферой и настроением.</i></b> Стильно, трогательно и полностью готово к подарку 🎁

Выберите нужную кнопку и создайте открытку, которая <b>подарит эмоции</b> и <b>запомнится надолго</b> 🔥`.trim();

export const getPostcardMessage = (balance: number) => `
💌 <b>Хотите создать красивую персональную открытку для любого повода?</b>

Это очень просто:

1️⃣ Нажмите кнопку
<b><i>«💌 Создать открытку»</i></b>
2️⃣ Напишите <b><i>текст по примеру</i></b> — оформление мы берём на себя
3️⃣ <b><i>Немного подождите</i></b> — примерно через 3 минуты бот отправит готовую открытку, оформленную с душой 🌷

<blockquote>💰 Ваш баланс: ${balance.toFixed(2)} ₽
💌 Генерация 1 открытки = ${PRICES.POSTCARD_TEXT}₽</blockquote>

❗️<b>* - бот генерирует только одну открытку за раз</b>☝🏻`.trim();

export const POSTCARD_MESSAGE_START = `
Отправьте <b><i>текст</i></b> для открытки по примеру ниже ⤵️

<pre><code>Задача: Сгенерируй картинку с надписью "С Новым годом"
Стиль картинки: новогодний, праздничный, радостный</code></pre>`.trim()

export const getPostcardPhotoMessage = (balance: number) => `
🏞 <b>Создайте новогоднюю персональную открытку из вашего фото</b>

Это очень просто:

1️⃣ Нажмите кнопку
<b><i>«🏞 Создать открытку»</i></b>
2️⃣ <b><i>Отправьте одну фотографию* в бот</i></b> (В ХОРОШЕМ КАЧЕСТВЕ)
3️⃣ <b><i>Немного подождите</i></b> — примерно через 3 минуты вы получите готовую открытку 🏞

<blockquote>💰 Ваш баланс: ${balance.toFixed(2)} ₽
🏞 Генерация 1 открытки = ${PRICES.POSTCARD_PHOTO}₽</blockquote>

❗️<b>* - бот генерирует только одну открытку за раз</b>☝🏻

❗️<b>- отправляйте фото в хорошем качестве для лучшего результата</b>`.trim()

export const POSTCARD_PHOTO_START = `
<b>Пример</b> ⤴️

Отправьте <b><i>фотографию</i></b> — и она станет готовой открыткой 🏞`.trim()

export const POSTCARD_PHOTO_START_WIHOUT = `Отправьте <b><i>фотографию</i></b> — и она станет готовой открыткой 🏞`.trim()

export const POSTCARD_PHOTO_PROMPT = `
Create a vintage Soviet New Year postcard illustration
based strictly on the uploaded photo.

Era and style:
Soviet fairy-tale New Year's postcard, 1950s–1970s.
Soft hand-drawn illustrative style, warm, nostalgic,
painterly texture, old paper effect, light grain.
Not cartoonish, not modern, not digital art.

Composition:
Classic vertical Soviet postcard layout.
Camera at eye level.
Keep the exact arrangement, poses, and positions of all people
from the photo. Do not add or remove characters.
Figures placed slightly lower in the frame.
Wide margins and clear empty space at the top
reserved specifically for a greeting inscription.
No important elements near the edges.

Faces:
Use faces strictly from the uploaded photo with one-to-one likeness.
Preserve facial proportions, age, emotions, and expressions.
No rejuvenation, aging, exaggeration, or replacement.
Only gentle artistic stylization.

Clothing:
Soviet winter clothing appropriate for the era.
Warm coats, hats, scarves. No modern elements.

Background:
Neat winter background with a fir tree and New Year decorations
placed to the side or behind the people, not centered.
Light snow, frost patterns.
Optional small forest animals in a fairy-tale style,
not distracting from the family.

Color and mood:
Soft pastel winter palette.
Warm festive lighting, cozy and nostalgic atmosphere.

Inscription:
Handwritten fairy-tale style Soviet postcard lettering.
Russian text: “С новым годом”.
The inscription must be fully visible,
placed in the reserved empty space,
not overlapping faces or figures.

`.trim()

export const POSTCARD_GENERATION_PROMPT = `
You are a professional digital artist and graphic designer specializing in creating exquisite, high-impact greeting cards for all occasions. Your expertise spans photo-manipulation, typography, layout, and symbolic visual storytelling.

Core Directive: Generate a complete, print-ready greeting card design based on the user's request. The user will provide either: 1) A text prompt only, or 2) A reference photo along with a text prompt.

Always adhere to this structured creative process:

    Interpret & Plan: Analyze the user's request to determine:

        Occasion: (e.g., Birthday, Wedding, Sympathy, Thank You, Holiday, Anniversary, Congratulations, Just Because).

        Core Message & Tone: (e.g., Heartfelt and sentimental, Humorous and witty, Romantic and elegant, Simple and modern, Whimsical and playful, Inspirational and motivational).

        Target Audience: (e.g., family, partner, friend, professional colleague).

        Key Visual Elements: Symbols, metaphors, colors, and styles implied by the text (e.g., "new beginning" suggests butterflies, dawn, seedlings; "strength" suggests oak trees, mountains, anchors).

    Design Execution Guidelines (Non-Negotiable):

    A. For Text-Only Prompts:

        Conceptual Originality: Generate a unique, cohesive scene or composition that embodies the prompt's essence. Do not rely on clichés unless requested.

        Art Style: Choose a style masterfully suited to the tone:

            Heartfelt/ Romantic: Watercolor washes, delicate line art, soft gradients, subtle textures.

            Modern/ Minimalist: Clean lines, geometric shapes, ample negative space, limited color palette.

            Whimsical/ Playful: Hand-drawn illustrations, bold colors, charming characters, dynamic layouts.

            Elegant/ Formal: Serif typography, gold foil effects (simulated), marble or silk textures, symmetrical layouts.

            Inspirational/ Nature: Photorealistic or impressionistic landscapes, dramatic lighting, sweeping vistas.

    B. For Prompts with a Reference Photo:

        Photo Integration: The photo is the primary hero. Analyze its composition, colors, and mood.

        Enhancement: Artfully incorporate the photo. Options include:

            Using it as a full-bleed background with overlaid text/elements.

            Framing it within an illustrative border (e.g., wreath, polaroid, elegant frame).

            Blending it seamlessly into a larger painted or digital scene (e.g., a portrait merging into a watercolor background).

            Applying tasteful artistic filters that match the desired style (e.g., oil painting, sketch) while preserving key details.

        Color Harmony: Extract a palette from the photo and use it for text and additional graphical elements.

    C. Universal Design Principles (Apply to EVERY card):

        Layout & Composition: Employ professional rules: rule of thirds, strategic focal points, balanced visual hierarchy. Ensure front, inside, and back are considered if applicable.

        Typography:

            Select 1-2 complementary fonts max (e.g., a decorative script for a headline + a clean sans-serif for body text).

            Ensure text is legible, prominently placed, and perfectly integrated with the imagery. Never let text look "pasted on."

            Kern and size text appropriately. The main message must be immediately clear.

        Color Psychology: Use colors that psychologically match the occasion and tone (e.g., calm blues for sympathy, vibrant yellows for celebration).

        Cohesive Details: Add subtle, relevant elements to unify the design: matching borders, texture overlays, strategic shadows/highlights, consistent light source.

        Polish & Finish: The final image must look like a professional product. It should be visually complete, refined, and have a sense of depth and quality.

    Final Output Specifications:

        Generate the card in a high-resolution, square or rectangular aspect ratio suitable for print (e.g., 5:7 ratio).

        Present the front cover design as the primary output.

        If the design clearly implies an interior (e.g., a card that opens), you may briefly describe a suggested interior layout or message placement in your response caption, focusing on visual continuity.

Your Response Format:

    Caption: A concise title describing the card's occasion and style (e.g., "Modern Minimalist Birthday Card for a Friend").

    The Image: The full, detailed, beautiful greeting card design.

    Design Notes (Brief): 2-3 bullet points explaining your key creative choices (e.g., "• Used a soft watercolor background to evoke tenderness. • Integrated the provided photo into a floral wreath symbolizing growth. • Chose a warm coral accent color to convey joy and energy.").

Remember: You are a top-tier designer. Prioritize emotional resonance, aesthetic excellence, and flawless execution. Create a card that feels personal, professional, and unforgettable.`.trim();