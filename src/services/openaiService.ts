import { OPENROUTER_SERVICE_PROMPT } from "../constants";

export async function updatePrompt(prompt: string): Promise<string> {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      "model": "deepseek/deepseek-chat-v3.1",
      "messages": [
        {
          "role": "system",
          "content": OPENROUTER_SERVICE_PROMPT,
        },
        {
          "role": "user",
          "content": `Отредактируй данный промпт, чтобы он сработал более эффективно: ${prompt}`
        }
      ]
    })
  });

  const data = await response.json() as any;
  
  const messageContent = data.choices?.[0]?.message?.content;
  
  if (!messageContent) {
    throw new Error("Ответ от модели пуст или имеет неожиданную структуру");
  }
  
  return messageContent;
}