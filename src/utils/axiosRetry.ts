import axios from "axios";
import { response } from "express";

export async function axiosRetry(requestUrl: string, retryCount: number) {
  let lastError = null;
  for (let attempt = 1; attempt <= retryCount; attempt++) {
    try {
      console.log(`📊 Попытка получения данных ${attempt}: ${requestUrl}`);

      const response = await axios.get(requestUrl, {
        timeout: 15000,
        responseType: 'arraybuffer'
      });

      console.log(`✅ Данные получены`);
      return response;
    } catch (error) {
      lastError = error;
      
      console.log(`❌ Попытка ${attempt}/${retryCount} не удалась: ${error}`);

      if (attempt === retryCount) {
        return null;
      };

      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  return null;
}