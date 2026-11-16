import type { GeminiTransport } from './client';

// 실제 Gemini 호출 (@google/genai). SDK 는 처음 쓸 때만 내려받는다(키가 없는 사용자는 받지 않음).
// 어린이 대상이므로 safetySettings 는 가장 엄격한 단계(BLOCK_LOW_AND_ABOVE)로 고정한다.

export const geminiTransport: GeminiTransport = async (args) => {
  const { GoogleGenAI, HarmBlockThreshold, HarmCategory } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey: args.apiKey });
  const strict = HarmBlockThreshold.BLOCK_LOW_AND_ABOVE;
  const response = await ai.models.generateContent({
    model: args.modelId,
    contents: args.contents,
    config: {
      systemInstruction: args.system,
      maxOutputTokens: args.maxOutputTokens,
      temperature: 0.7,
      ...(args.schema ? { responseMimeType: 'application/json', responseSchema: args.schema as Record<string, unknown> } : {}),
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: strict },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: strict },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: strict },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: strict },
      ],
    },
  });
  const text = response.text;
  if (!text) throw new Error('empty response');
  return text;
};
