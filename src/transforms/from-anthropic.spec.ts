import 'dotenv/config';
import { describe, expect, it } from 'vitest';
import Anthropic from '@anthropic-ai/sdk';
import { fromAnthropic } from './from-anthropic.js';

describe('from-anthropic', () => {
  it.skip('should transform Anthropic stream to text stream', async () => {
    const client = new Anthropic({
      apiKey: process.env['ANTHROPIC_API_KEY'],
    });

    const anthropicStream = await client.messages.create({
      stream: true,
      max_tokens: 1024,
      model: 'claude-sonnet-4-20250514',
      messages: [
        { role: 'user', content: 'Hello, what is the weather in New York?' },
      ],
    });

    const textStream = fromAnthropic(anthropicStream, {
      get: (item) =>
        item.type === 'content_block_delta' && item.delta.type === 'text_delta'
          ? item.delta.text
          : null,
    });

    for await (const text of textStream) {
      expect(typeof text).toBe('string');
      expect(text.length).toBeGreaterThan(0);
    }
  });
});
