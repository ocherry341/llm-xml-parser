# LLM XML Stream Parser

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

```typescript
import { XMLStream } from 'llm-xml-parser';

const stream = someTokenStream.pipeThrough(new XMLStream());

for await (const { path, text } of stream) {
  console.log(`Path: ${path}, Text: ${text}`);
}
```

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.