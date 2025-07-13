import 'dotenv/config';
import OpenAI from 'openai';
import { describe, expect, it } from 'vitest';
import { fromOpenAI } from './from-openAI.js';

describe('from-openai', () => {
  it('should transform OpenAI stream to text stream', async () => {
    const client = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: process.env['OPENROUTER_KEY'],
    });

    const openaiStream = await client.chat.completions.create({
      model: 'google/gemini-2.0-flash-001',
      messages: [
        {
          role: 'user',
          content: 'What is the capital of France?',
        },
      ],
      stream: true,
    });

    const textStream = fromOpenAI(openaiStream, {
      get: (item) => item.choices[0]?.delta?.content,
    });

    for await (const text of textStream) {
      console.log(text);
      expect(typeof text).toBe('string');
      expect(text.length).toBeGreaterThan(0);
    }
  });
});
