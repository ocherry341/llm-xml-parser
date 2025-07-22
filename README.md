# LLM XML Parser

A library for parsing structured, streaming XML data from Large Language Models (LLMs). This library provides efficient stream processing capabilities for real-time XML parsing and Server-Sent Events (SSE) handling.

## Features

- **Real-time XML Stream Parsing**: Parse XML data as it streams from LLMs without waiting for complete responses
- **Server-Sent Events (SSE) Support**: Convert SSE streams to text streams for easier processing
- **Structured Output**: Extract XML paths and text content with precise positioning
- **Streaming Performance**: Built on Web Streams API for optimal memory usage and performance
- **LLM Optimized**: Specifically designed for handling partial and incomplete XML from AI models

## Use Cases

- **AI Chatbots**: Parse structured responses from LLMs in real-time
- **Tool Calling**: Extract function calls and parameters from streaming XML
- **Content Generation**: Process structured content as it's being generated
- **Real-time Analytics**: Monitor and parse LLM outputs for analysis
- **Streaming APIs**: Handle Server-Sent Events from AI services

## Installation

> ⚠️ **This project is currently in early development. The API may be unstable and subject to change.**

```bash
npm install llm-xml-parser
```

## Usage

### Quick Start

```typescript
import { fromSSE, XMLStream } from 'llm-xml-parser';

const res = await fetch('https://example.com/sse-endpoint');

const textStream = fromSSE(res.body);

const stream = textStream.pipeThrough(new XMLStream());

for await (const chunk of stream) {
  console.log(chunk);
}
```

### Output Structured Streaming Data

```typescript
import { XMLStream } from 'llm-xml-parser';

const stream = textStream.pipeThrough(new XMLStream());

for await (const chunk of stream) {
  console.log(chunk);
}
```

This parser emits structured data. Each output will be appended with new content.

This parser has two parts of output

- **messages**: the parsed content of the entire llm output, including data in xml tags and other additional text out of xml tags.
- **data**: the structured data in the xml tags

For example, a llm output like this:

```xml
The user is asking for the current weather in Paris. I will call the weather tool to get the information.

<tool_call>
  <name>getWeather</name>
  <arguments>
    <location>Paris</location>
  </arguments>
</tool_call>

The weather in Paris is sunny.

<suggestion>
  <option> Check the weather forecast</option>
  <option> Try a different location</option>
</suggestion>

```

The messages field will assemble all llm output in order.

```json
{
  "messages": [
    {
      "type": "text",
      "content": "The user is asking for the current weather in Paris. I will call the weather tool to get the information."
    },
    {
      "type": "data",
      "content": {
        "tool_call": {
          "name": "getWeather",
          "arguments": {
            "location": "Paris"
          }
        }
      }
    },
    {
      "type": "text",
      "content": "The weather in Paris is sunny."
    },
    {
      "type": "data",
      "content": {
        "suggestion": {
          "option": ["Check the weather forecast", "Try a different location"]
        }
      }
    }
  ]
}
```

The data field will contain all output in xml tags.

```json
{
  "data": {
    "tool_call": {
      "name": "getWeather",
      "arguments": {
        "location": "Paris"
      }
    },
    "suggestion": {
      "option": ["Check the weather forecast", "Try a different location"]
    }
  }
}
```

The content of these two fields will be updated as the stream progresses.

- **Options**

```typescript
// XMLStream options
interface XMLStreamOptions {
  /** Determines if a tag is an array */
  isArray?: (tagName: string, tagStack: string[]) => boolean;
}

// XMLStream output interface
export interface XMLOutput {
  /** The state of the current output */
  state: 'tag_open' | 'tag_close' | 'message_open' | 'message_close' | 'data_close';
  /** The structured data accumulated so far */
  data: any;
  /** The messages accumulated so far */
  messages: string[];
  /** The stack of tags leading to this output */
  tagStack: string[];
  /** The last tag or text index processed */
  last: string | number;
}
```

### Transforming Input Streams

`llm-xml-parser` accepts a readable stream of plain text token. Some built-in functions are provided to transform the input stream to text stream.

#### Server-Sent Events (SSE)

```typescript
import { fromSSE } from 'llm-xml-parser';

const res = await fetch('https://example.com/sse-endpoint');

/*
Ensure the response is a valid SSE stream, e.g.

if (!res.ok || !res.body) {
  throw new Error('Failed to fetch SSE stream');
}
if (!res.headers.get('content-type')?.includes('text/event-stream')) {
  throw new Error('Response is not a valid SSE stream');
}
*/

const textStream = fromSSE(res.body, {
  // Optional: Customize how to extract text from SSE events
  get: (event) => event.data,
});
```

#### OpenAI Library

```typescript
import { fromOpenAI } from 'llm-xml-parser';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const openaiStream = await client.chat.completions.create({
  model: 'gpt-4o',
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
```

#### Anthropic Library

```typescript
import { fromAnthropic } from 'llm-xml-parser';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();
const anthropicStream = await client.completions.create({
  stream: true,
  max_tokens: 1024,
  model: 'claude-sonnet-4-20250514',
  messages: [{ role: 'user', content: 'Hello, what is the weather in New York?' }],
});

const textStream = fromAnthropic(anthropicStream, {
  get: (item) =>
    item.type === 'content_block_delta' && item.delta.type === 'text_delta'
      ? item.delta.text
      : null,
});
```

#### Vertex AI

```typescript
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
```

### Output Tokens and XML Paths

A lower-level parser is also available for more granular control over the XML parsing process. This parser emits tokens with their XML paths, similar to how LLMs output text.

```typescript
import { XMLTokenStream } from 'llm-xml-parser';

const stream = textStream.pipeThrough(new XMLTokenStream());

for await (const chunk of stream) {
  console.log(chunk);
}
```

This parser emits text chunks like llm output, but with additional xml path information.

```plain
{"state":"tag_open","token":"The","path":["thinking"],"tagStack":["thinking"]}
{"state":"tag_open","token":" user is","path":["thinking"],"tagStack":["thinking"]}
{"state":"tag_open","token":" asking","path":["thinking"],"tagStack":["thinking"]}
{"state":"tag_open","token":" for the current","path":["thinking"],"tagStack":["thinking"]}
{"state":"tag_open","token":" weather.","path":["thinking"],"tagStack":["thinking"]}
{"state":"tag_close","token":"","path":["thinking"],"tagStack":["thinking"]}
{"state":"message_open","token":"Here is a","path":[0],"tagStack":[]}
{"state":"message_open","token":" brief pause","path":[0],"tagStack":[]}
{"state":"message_open","token":" before","path":[0],"tagStack":[]}
{"state":"message_open","token":" the tool","path":[0],"tagStack":[]}
{"state":"message_open","token":" is called.","path":[0],"tagStack":[]}
{"state":"message_close","token":"","path":[0],"tagStack":[]}
```

- **Options**

```typescript
// XMLTokenStream options
interface XMLTokenStreamOptions {
  /** Determines if a tag is an array */
  isArray?: (tagName: string, tagStack: string[]) => boolean;
}

// XMLTokenOutput interface
interface XMLTokenOutput {
  /** The state of the current output */
  state: 'tag_open' | 'tag_close' | 'message_open' | 'message_close';
  /** The text content of the token */
  token: string;
  /** The object path of the token */
  path: (string | number)[];
  /** The stack of tags leading to this token */
  tagStack: string[];
}
```

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.
