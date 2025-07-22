import { describe, expect, it } from 'vitest';
import { VertexAI } from '@google-cloud/vertexai';
import { formVertexAI } from './from-vertexai.js';

describe('from-vertexai', () => {
  it.skip('should transform Vertex AI stream to text stream', async () => {
    const vertexAI = new VertexAI({});
    const generativeModel = vertexAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
    });

    const streamingResult = await generativeModel.generateContentStream({
      contents: [{ role: 'user', parts: [{ text: 'How are you doing today?' }] }],
    });

    const textStream = formVertexAI(streamingResult, {
      get: (item) => item.candidates?.[0]?.content?.parts[0].text,
    });

    for await (const text of textStream) {
      expect(typeof text).toBe('string');
      expect(text.length).toBeGreaterThan(0);
    }
  });
});
