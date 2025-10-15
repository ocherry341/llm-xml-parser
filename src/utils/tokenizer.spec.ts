import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import Tokenizer, { type Callbacks } from './tokenizer.js';

describe('Tokenizer', () => {
  it('parses llm fixture stream with text and tags', () => {
    const fixturePath = path.resolve('test/fixtures/llm-output.txt');
    const xml = fs.readFileSync(fixturePath, 'utf8');

    const decodedText: string[] = [];
    const openTags: string[] = [];
    const closeTags: string[] = [];
    const openTagEnds: number[] = [];
    const endCount = { value: 0 };

    const callbacks: Callbacks = {
      onattribdata: vi.fn(),
      onattribentity: vi.fn(),
      onattribend: vi.fn(),
      onattribname: vi.fn(),
      oncdata: vi.fn(),
      onclosetag(start, end) {
        closeTags.push(xml.slice(start, end));
      },
      oncomment: vi.fn(),
      ondeclaration: vi.fn(),
      onend() {
        endCount.value++;
      },
      onopentagend(endIndex) {
        openTagEnds.push(endIndex);
      },
      onopentagname(start, end) {
        openTags.push(xml.slice(start, end));
      },
      onprocessinginstruction: vi.fn(),
      onselfclosingtag: vi.fn(),
      ontext(start, end) {
        decodedText.push(xml.slice(start, end));
      },
      ontextentity: vi.fn(),
    };

    const tokenizer = new Tokenizer({ decodeEntities: false }, callbacks);
    tokenizer.write(xml);
    tokenizer.end();

    const compactText = decodedText.join('').replace(/\s+/g, ' ').trim();
    expect(compactText).toContain('The user is asking for the current weather in New York.');

    expect(openTags).toEqual([
      'tool',
      'tool_name',
      'tool_input',
      'suggestions',
      'option',
      'option',
    ]);

    expect(closeTags).toEqual([
      'tool_name',
      'tool_input',
      'tool',
      'option',
      'option',
      'suggestions',
    ]);

    expect(openTagEnds.length).toBe(6);
    expect(endCount.value).toBe(1);
  });
});
