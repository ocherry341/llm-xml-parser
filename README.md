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

> ⚠️ **This project is currently in development.**

```bash
npm install llm-xml-parser
```

## Usage

`llm-xml-parser` accept a text stream with some XML tags and returns structured streaming output.

### Transform to Text Stream

Some built-in functions are provided to transform the input stream to text stream.

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

const textStream = fromSSE(res.body);
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

### Parse to Structured data

```typescript
import { XMLStream } from 'llm-xml-parser';

const stream = textStream.pipeThrough(new XMLStream());

for await (const { path, text } of stream) {
  console.log(`Path: ${path}, Text: ${text}`);
}
```



## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.