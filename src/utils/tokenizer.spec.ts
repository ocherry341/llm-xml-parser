import { describe, expect, it, vi } from 'vitest';
import Tokenizer, { QuoteType, type AttributeEvent, type Callbacks } from './tokenizer.js';
import xml from '../../test/fixtures/llm-output.txt?raw';

describe('Tokenizer', () => {
  it('parses llm fixture stream with text and tags', () => {

    const decodedText: string[] = [];
    const openTags: string[] = [];
    const closeTags: string[] = [];
    const openTagEnds: string[] = [];
    const endCount = { value: 0 };
    const attributes: AttributeEvent[] = [];

    const callbacks: Callbacks = {
      onText(text) {
        decodedText.push(text);
      },
      onCdata: vi.fn(),
      onComment: vi.fn(),
      onDeclaration: vi.fn(),
      onProcessingInstruction: vi.fn(),
      onOpenTag(tagName) {
        openTags.push(tagName);
      },
      onOpenTagEnd(tagName) {
        openTagEnds.push(tagName);
      },
      onAttribute(attr) {
        attributes.push(attr);
      },
      onCloseTag(tagName) {
        closeTags.push(tagName);
      },
      onSelfClosingTag: vi.fn(),
      onEnd() {
        endCount.value++;
      },
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

    expect(openTagEnds).toEqual(openTags);
    expect(attributes).toEqual([]);
    expect(endCount.value).toBe(1);
  });

  it('emits completed attributes with decoded values across chunks', () => {
    const openTags: string[] = [];
    const openTagEnds: string[] = [];
    const attributes: AttributeEvent[] = [];
    const selfClosing: string[] = [];
    const emittedText: string[] = [];
    let endCount = 0;

    const callbacks: Callbacks = {
      onText(text) {
        emittedText.push(text);
      },
      onCdata: vi.fn(),
      onComment: vi.fn(),
      onDeclaration: vi.fn(),
      onProcessingInstruction: vi.fn(),
      onOpenTag(tagName) {
        openTags.push(tagName);
      },
      onOpenTagEnd(tagName) {
        openTagEnds.push(tagName);
      },
      onAttribute(attr) {
        attributes.push(attr);
      },
      onCloseTag: vi.fn(),
      onSelfClosingTag(tagName) {
        selfClosing.push(tagName);
      },
      onEnd() {
        endCount += 1;
      },
    };

    const tokenizer = new Tokenizer({}, callbacks);

    tokenizer.write('<item id="123" foo="bar &');
    tokenizer.write("amp; baz\" flag data=42 attr='value' />");
    tokenizer.end();

    expect(openTags).toEqual(['item']);
    expect(openTagEnds).toEqual([]);
    expect(selfClosing).toEqual(['item']);
    expect(emittedText).toEqual([]);
    expect(endCount).toBe(1);
    expect(attributes).toEqual([
      { tagName: 'item', name: 'id', value: '123', quote: QuoteType.Double },
      { tagName: 'item', name: 'foo', value: 'bar & baz', quote: QuoteType.Double },
      { tagName: 'item', name: 'flag', value: null, quote: QuoteType.NoValue },
      { tagName: 'item', name: 'data', value: '42', quote: QuoteType.Unquoted },
      { tagName: 'item', name: 'attr', value: 'value', quote: QuoteType.Single },
    ]);
  });
});
