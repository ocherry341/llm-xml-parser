import { Parser } from 'htmlparser2';
import { append } from './utils/append.js';

interface XMLChunkOutput {
  state: 'chunk';
  path: (string | number)[];
  chunk: string;
}

interface XMLDataOutput {
  state: 'partial' | 'complete';
  data: any;
  lastTag: string;
  tagStack: string[];
}

type XMLOutput = XMLChunkOutput | XMLDataOutput;

export interface XMLStreamOptions {
  messageKey?: string;
  mode?: 'chunk' | 'partial' | 'complete';
  /**
   * Determines if a tag is an array
   * @param tagName current tag name
   * @param tagStack current tag stack
   * @returns true if the tag is an array, false otherwise
   */
  isArray?: (tagName: string, tagStack: string[]) => boolean;
}

export class XMLStream extends TransformStream<string, XMLOutput> {
  public data: any = {};

  constructor(options: XMLStreamOptions = {}) {
    const { mode = 'chunk', isArray = () => false, messageKey = 'messages' } = options;
    const ROOT_TAG = 'INTERNAL_ROOT';

    const arrayIndexes = new Map<string, number>([[messageKey, 0]]);
    const tagStack: string[] = [];
    let prevTagStack: string[] = [];
    let count = 0;

    let buffer: string[] = [];
    const MAX_BUFFER_SIZE = 10;
    let shouldBuffering = false;

    let tagStart = 0;
    let tagEnd = 0;
    let shouldSeparate = false;

    let closedTag = '';

    const parser = new Parser(
      {
        onopentag: (name) => {
          if (name === ROOT_TAG) {
            return;
          }

          if (tagStack.length === 0) {
            closedTag = messageKey;
          }

          prevTagStack = tagStack.length === 0 ? [] : tagStack.join('/').split('/');
          tagStack.push(name);
          tagEnd = parser.endIndex; // index of the '>'
          tagStart = parser.endIndex - name.length - 1; // index of the '<'
          shouldSeparate = true;

          const _isArray = isArray(name, tagStack);
          if (_isArray) {
            const key = tagStack.join('/');
            arrayIndexes.set(key, (arrayIndexes.get(key) ?? -1) + 1);
          }
        },
        onclosetag(name) {
          if (name === ROOT_TAG) {
            return;
          }

          if (tagStack[tagStack.length - 1] === name) {
            prevTagStack = tagStack.length === 0 ? [] : tagStack.join('/').split('/');
            tagStack.pop();
            tagEnd = parser.endIndex; // index of the '>'
            tagStart = parser.endIndex - name.length - 2; // index of the '<'
            shouldSeparate = true;
            closedTag = name;
          }

          if (tagStack.length === 0) {
            arrayIndexes.set(messageKey, arrayIndexes.get(messageKey)! + 1);
          }
        },
      },
      {
        xmlMode: true,
        decodeEntities: false,
        recognizeCDATA: false,
        recognizeSelfClosing: false,
      }
    );

    super({
      start: () => {
        const tag = `<${ROOT_TAG}>`;
        count += tag.length;
        parser.write(tag);
      },

      flush: (controller: TransformStreamDefaultController<XMLOutput>) => {
        const tag = `</${ROOT_TAG}>`;
        count += tag.length;
        parser.write(tag);

        if (closedTag && mode !== 'chunk') {
          this.emitData(
            controller,
            'complete',
            closedTag,
            closedTag === messageKey ? tagStack : [...tagStack, closedTag]
          );
          closedTag = '';
        }

        parser.end();
      },

      transform: (inputChunk: string, controller: TransformStreamDefaultController<XMLOutput>) => {
        if (closedTag && mode !== 'chunk') {
          this.emitData(
            controller,
            'complete',
            closedTag,
            closedTag === messageKey ? tagStack : [...tagStack, closedTag]
          );
          closedTag = '';
        }

        const splitted = this.splitChunk(inputChunk, shouldBuffering);
        for (const { part, partShouldBuffering } of splitted) {
          // buffering tokens if the chunk contains incomplete tags
          shouldBuffering = partShouldBuffering;
          if (buffer.length >= MAX_BUFFER_SIZE) {
            shouldBuffering = false;
          }
          if (shouldBuffering) {
            buffer.push(part);
            continue;
          }

          let chunkToWrite = '';
          if (buffer.length > 0) {
            chunkToWrite += buffer.join('');
            buffer = [];
          }
          chunkToWrite += part;

          // write to parser
          count += chunkToWrite.length;
          shouldSeparate = false;
          parser.write(chunkToWrite);

          // separate xml tag from current chunk
          if (shouldSeparate) {
            const prev = chunkToWrite.slice(0, chunkToWrite.length - count + tagStart);
            if (prev) {
              const path = this.getPath(prevTagStack, arrayIndexes, messageKey);
              if (mode === 'chunk') {
                this.emitChunk(controller, path, prev);
              } else {
                append(this.data, path, prev);
                const lastTag = prevTagStack[prevTagStack.length - 1] || messageKey;
                if (mode === 'partial') {
                  this.emitData(controller, 'partial', lastTag, prevTagStack);
                }
              }
            }
            chunkToWrite = chunkToWrite.slice(
              chunkToWrite.length + tagEnd - count + 1,
              chunkToWrite.length
            );
          }

          if (chunkToWrite) {
            const path = this.getPath(tagStack, arrayIndexes, messageKey);
            if (mode === 'chunk') {
              this.emitChunk(controller, path, chunkToWrite);
            } else {
              append(this.data, path, chunkToWrite);
              const lastTag = tagStack[tagStack.length - 1] || messageKey;
              if (mode === 'partial') {
                this.emitData(controller, 'partial', lastTag, tagStack);
              }
            }
          }
        }
      },
    });
  }

  private emitChunk(
    controller: TransformStreamDefaultController<XMLOutput>,
    path: (string | number)[],
    chunk: string
  ) {
    controller.enqueue({
      state: 'chunk',
      path: path,
      chunk: chunk,
    });
  }

  private emitData(
    controller: TransformStreamDefaultController<XMLOutput>,
    state: 'partial' | 'complete',
    lastTag: string,
    tagStack: string[]
  ) {
    controller.enqueue({
      data: this.data,
      state,
      lastTag,
      tagStack: [...tagStack],
    });
  }

  private getPath(tagStack: string[], arrayIndexes: Map<string, number>, messageKey: string) {
    const result: (string | number)[] = [];
    for (const tag of tagStack) {
      result.push(tag);
      const key = result.join('/');
      if (arrayIndexes.has(key)) {
        result.push(arrayIndexes.get(key)!);
      }
    }

    if (result.length === 0) {
      return [messageKey, arrayIndexes.get(messageKey)!];
    } else {
      return result;
    }
  }

  private splitChunk(chunk: string, buffering: boolean) {
    const openBracketIndex = [] as number[];
    const closeBracketIndex = [] as number[];

    for (let i = 0; i < chunk.length; i++) {
      if (chunk[i] === '<') {
        openBracketIndex.push(i);
      }
      if (chunk[i] === '>') {
        closeBracketIndex.push(i);
      }
    }

    const lastOpenBracket = openBracketIndex[openBracketIndex.length - 1] ?? (buffering ? -1 : -2);
    const lastCloseBracket = closeBracketIndex[closeBracketIndex.length - 1] ?? -2;
    const firstCloseBracket = closeBracketIndex[0] ?? -1;

    const partShouldBuffering = lastOpenBracket > lastCloseBracket;

    // If the first closing bracket is before the last opening bracket, we need to split the chunk
    if (
      openBracketIndex.length > 0 &&
      closeBracketIndex.length > 0 &&
      firstCloseBracket < lastOpenBracket
    ) {
      // split by closeBracketIndexes
      const splited = [] as string[];
      for (let i = 0; i < closeBracketIndex.length; i++) {
        const start = i === 0 ? 0 : closeBracketIndex[i - 1] + 1;
        const end = closeBracketIndex[i] + 1;
        splited.push(chunk.slice(start, end));
      }
      splited.push(chunk.slice(closeBracketIndex[closeBracketIndex.length - 1] + 1));
      return splited.map((part, index) => ({
        part,
        partShouldBuffering: index === splited.length - 1 ? partShouldBuffering : false,
      }));
    }

    return [
      {
        part: chunk,
        partShouldBuffering,
      },
    ];
  }
}
