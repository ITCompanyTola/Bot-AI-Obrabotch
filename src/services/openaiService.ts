import { OPENROUTER_SERVICE_PROMPT } from "../constants";

export async function updatePrompt(prompt: string, imageUrl?: string): Promise<string> {
  console.log('updatePrompt', prompt, imageUrl);
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      "model": "openai/gpt-4o-mini",
      "max_tokens": 8000,
      "messages": [
        {
          "role": "system",
          "content": OPENROUTER_SERVICE_PROMPT,
        },
        {
          "role": "user",
          "content": [
            {
              "type": "text",
              "text": `Промпт пользователя: ${prompt}`
            },
            {
              "type": "image_url",
              "image_url": {
                "url": imageUrl,
              }
            }
          ]
        }
      ]
    })
  });

  const data = await response.json() as any;
  console.log(data);
  
  const messageContentResponse = data.choices?.[0]?.message?.content;
  
  if (!messageContentResponse) {
    throw new Error("Ответ от модели пуст или имеет неожиданную структуру");
  }
  
  return messageContentResponse;
}