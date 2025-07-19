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

### Input with Text Stream

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

### Output with Tokens and XML Paths

```typescript
import { XMLTokenStream } from 'llm-xml-parser';

const stream = textStream.pipeThrough(new XMLTokenStream());

for await (const chunk of stream) {
  console.log(chunk);
}
```

This parser emits text chunks like llm output, but with additional xml path information.

```plain
{"state":"message_close","token":"","path":[0],"tagStack":[]}
{"state":"tag_open","token":"The","path":["thinking"],"tagStack":["thinking"]}
{"state":"tag_open","token":" user is","path":["thinking"],"tagStack":["thinking"]}
{"state":"tag_open","token":" asking","path":["thinking"],"tagStack":["thinking"]}
{"state":"tag_open","token":" for the current","path":["thinking"],"tagStack":["thinking"]}
{"state":"tag_open","token":" weather.","path":["thinking"],"tagStack":["thinking"]}
{"state":"tag_close","token":"","path":["thinking"],"tagStack":["thinking"]}
{"state":"message_open","token":"Here is a","path":[1],"tagStack":[]}
{"state":"message_open","token":" brief pause","path":[1],"tagStack":[]}
{"state":"message_open","token":" before","path":[1],"tagStack":[]}
{"state":"message_open","token":" the tool","path":[1],"tagStack":[]}
{"state":"message_open","token":" is called.","path":[1],"tagStack":[]}
{"state":"message_close","token":"","path":[1],"tagStack":[]}
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


### Output with Structured Streaming Data

```typescript
import { XMLStream } from 'llm-xml-parser';

const stream = textStream.pipeThrough(new XMLStream());

for await (const chunk of stream) {
  console.log(chunk);
}
```

This parser emits structured data. Each output will be appended with new content.

```
{"state":"message_close","data":{},"messages":[""],"tagStack":[],"last":0}
{"state":"tag_open","data":{"thinking":"The"},"messages":[""],"tagStack":["thinking"],"last":"thinking"}
{"state":"tag_open","data":{"thinking":"The user is"},"messages":[""],"tagStack":["thinking"],"last":"thinking"}
{"state":"tag_open","data":{"thinking":"The user is asking"},"messages":[""],"tagStack":["thinking"],"last":"thinking"}
{"state":"tag_open","data":{"thinking":"The user is asking for the current"},"messages":[""],"tagStack":["thinking"],"last":"thinking"}
{"state":"tag_open","data":{"thinking":"The user is asking for the current weather."},"messages":[""],"tagStack":["thinking"],"last":"thinking"}
{"state":"tag_close","data":{"thinking":"The user is asking for the current weather."},"messages":[""],"tagStack":["thinking"],"last":"thinking"}
```

This parser has two parts of output

- **data**: the structured data in the xml tags
- **messages**: the text content of the xml tags, with an index indicating the position of whole xml output.

For example, a llm output like this:

```xml
<!-- This is the messages part with index 0 -->
Let's call a tool to get the weather in Paris.

<!-- This is the data part -->
<tool_call>
  <name>getWeather</name>
  <arguments>
    <location>Paris</location>
  </arguments>
</tool_call>

<!-- This is the messages part with index 1 -->
The weather in Paris is sunny.
```

- **Options**

```typescript
// XMLStream output interface
export interface XMLOutput {
  /** The state of the current output */
  state: 'tag_open' | 'tag_close' | 'message_open' | 'message_close';
  /** The structured data accumulated so far */
  data: any;
  /** The messages accumulated so far */
  messages: string[];
  /** The stack of tags leading to this output */
  tagStack: string[];
  /** The last tag or message processed */
  last: string | number;
}
```


## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.
