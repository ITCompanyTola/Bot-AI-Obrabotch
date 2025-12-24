import { request, ProxyAgent } from 'undici';
import { OPENROUTER_SERVICE_PROMPT } from '../constants';

const TIMEOUT_MS = 45_000;

// Агент создаём один раз (важно!)

const proxyAgent = process.env.HTTPS_PROXY_FOR_OPENAI
  ? new ProxyAgent(process.env.HTTPS_PROXY_FOR_OPENAI)
  : undefined;

console.log(proxyAgent);
export async function updatePrompt(prompt: string, imageUrl?: string) {
  console.log('updatePrompt', prompt, imageUrl);

  try {
    console.log('Sending request to OpenRouter via undici...');

    const body = {
      model: 'openai/gpt-4o-mini',
      max_tokens: 8000,
      messages: [
        {
          role: 'system',
          content: OPENROUTER_SERVICE_PROMPT,
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Промпт пользователя: ${prompt}`,
            },
            ...(imageUrl
              ? [
                  {
                    type: 'image_url',
                    image_url: { url: imageUrl },
                  },
                ]
              : []),
          ],
        },
      ],
    };

    const check = await request('https://api.ipify.org', {
      dispatcher: proxyAgent,
    });

    console.log('Checked IP:', await check.body.text());

    const res = await request(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        dispatcher: proxyAgent,
        headers: {
          authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
        headersTimeout: TIMEOUT_MS,
        bodyTimeout: TIMEOUT_MS,
      }
    );

    if (res.statusCode < 200 || res.statusCode >= 300) {
      const errorText = await res.body.text();
      throw new Error(
        `OpenRouter error ${res.statusCode}: ${errorText}`
      );
    }

    const data: any = await res.body.json();

    const messageContentResponse =
      data?.choices?.[0]?.message?.content;

    if (!messageContentResponse) {
      throw new Error('Ответ от модели пуст');
    }

    console.log('Response received');

    return messageContentResponse;
  } catch (error: any) {
    console.error('Ошибка при запросе к OpenRouter (undici):');

    if (error?.name === 'HeadersTimeoutError') {
      throw new Error('Таймаут ожидания ответа от OpenRouter');
    }

    if (error?.name === 'BodyTimeoutError') {
      throw new Error('Таймаут получения тела ответа от OpenRouter');
    }

    throw error;
  }
}
