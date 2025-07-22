import 'dotenv/config';
import OpenAI from 'openai';
import { beforeEach, describe, expect, it } from 'vitest';
import { fromOpenAI } from './from-openAI.js';

const prompt = `
You are a helpful assistant. Help the user answer any questions.

You have access to the following tools:
- get_weather: Get the current weather for a given location.

In order to use a tool, you can use <tool></tool> tags

Example
<tool>
  <tool_name>get_weather</tool_name>
  <tool_input>New York</tool_input>
</tool>

You should analyze user input and show your analysis process.

At the end of your response, you can use <suggestions></suggestions> tags to suggest the next action.

<suggestions>
  <option>What is the weather in Paris?</option>
  <option>What is the weather in New York?</option>
</suggestions>
`;

describe('from-openai', () => {
  let client: OpenAI;

  beforeEach(() => {
    const openrouterKey = process.env['OPENROUTER_API_KEY'];
    const openaiKey = process.env['OPENAI_API_KEY'];
    if (openaiKey) {
      client = new OpenAI({
        apiKey: openaiKey,
      });
    } else if (openrouterKey) {
      client = new OpenAI({
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: openrouterKey,
      });
    }
  });

  it('should transform OpenAI stream to text stream', async () => {
    const openaiStream = await client.chat.completions.create({
      model: 'google/gemini-2.5-flash',
      messages: [
        {
          role: 'system',
          content: prompt,
        },
        {
          role: 'user',
          content: 'Hello, what is the weather in New York?',
        },
      ],
      stream: true,
    });

    const textStream = fromOpenAI(openaiStream, {
      get: (item) => item.choices[0]?.delta?.content,
    });

    for await (const text of textStream) {
      expect(typeof text).toBe('string');
      expect(text.length).toBeGreaterThan(0);
    }
  });
});
