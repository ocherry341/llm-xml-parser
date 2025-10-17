import Tokenizer, { type Callbacks } from './utils/tokenizer.js';
import { splitChunk, STATE } from './utils/split-chunk.js';

export interface XMLTokenOutput {
  path: (string | number)[];
  token: string;
  state: 'tag_open' | 'tag_close' | 'message_open' | 'message_close' | 'data_close';
  tagStack: string[];
}

export interface XMLTokenStreamOptions {
  /**
   * Determines if a tag is an array
   * @param tagName current tag name
   * @param tagStack current tag stack
   * @returns true if the tag is an array, false otherwise
   */
  isArray?: undefined | ((tagName: string, tagStack: string[]) => boolean);
}

export class XMLTokenStream extends TransformStream<string, XMLTokenOutput> {
  private readonly tokenizer: Tokenizer;
  private readonly isArray: (tagName: string, tagStack: string[]) => boolean;

  private arrayIndexes = new Map<string, number>();
  private messageIndex = 0;

  private tagStack: string[] = [];
  private prevTagStack: string[] = [];

  private closedTag = '';
  private closeMessage = false;
  private hasMessage = false;

  private currentController: TransformStreamDefaultController<XMLTokenOutput> | null = null;

  private bufferingTag = false;
  private tagBuffer: string[] = [];

  constructor(options: XMLTokenStreamOptions = {}) {
    const { isArray = () => false } = options;

    super({
      transform: (
        inputChunk: string,
        controller: TransformStreamDefaultController<XMLTokenOutput>
      ) => {
        this.currentController = controller;
        this.processChunk(inputChunk);
      },
      flush: (controller: TransformStreamDefaultController<XMLTokenOutput>) => {
        this.currentController = controller;
        this.finish();
      },
    });

    this.isArray = isArray;
    this.tokenizer = new Tokenizer({ decodeEntities: false }, this.createCallbacks());
  }

  private processChunk(inputChunk: string) {
    if (!this.currentController) {
      return;
    }

    const splitted = splitChunk(inputChunk);
    for (const { token, state } of splitted) {
      if (state === STATE.TAG_OPEN) {
        this.bufferingTag = true;
      }
      if (state === STATE.TAG_CLOSE) {
        this.bufferingTag = false;
      }
      if (this.bufferingTag) {
        this.tagBuffer.push(token);
        continue;
      }

      let chunkToWrite = '';
      if (this.tagBuffer.length > 0) {
        chunkToWrite += this.tagBuffer.join('');
        this.tagBuffer = [];
      }
      chunkToWrite += token;

      if (!chunkToWrite) {
        continue;
      }

      if (chunkToWrite.startsWith('<')) {
        this.tokenizer.write(chunkToWrite);
        this.emitClose();
      } else {
        this.emitOpen(chunkToWrite);
      }
    }
  }

  private finish() {
    if (!this.currentController) {
      return;
    }

    if (this.tagBuffer.length > 0) {
      const buffered = this.tagBuffer.join('');
      this.tagBuffer = [];
      if (buffered.startsWith('<')) {
        this.tokenizer.write(buffered);
        this.emitClose();
      } else {
        this.emitOpen(buffered);
      }
    }

    if (this.hasMessage) {
      this.closeMessage = true;
    }

    this.emitClose();
    this.tokenizer.end();
    this.emitClose();
  }

  private createCallbacks(): Callbacks {
    return {
      onText: () => {},
      onCdata: (content) => {
        if (!content) {
          return;
        }
        this.emitOpen(content);
      },
      onComment: () => {},
      onDeclaration: () => {},
      onProcessingInstruction: () => {},
      onOpenTag: (tagName) => {
        this.handleOpenTag(tagName);
      },
      onOpenTagEnd: () => {},
      onAttribute: () => {},
      onCloseTag: (tagName) => {
        this.handleCloseTag(tagName);
      },
      onSelfClosingTag: (tagName) => {
        this.handleSelfClosingTag(tagName);
      },
      onEnd: () => {},
    };
  }

  private handleOpenTag(tagName: string) {
    if (this.tagStack.length === 0 && this.hasMessage) {
      this.closeMessage = true;
    }

    this.prevTagStack = [...this.tagStack];
    this.tagStack.push(tagName);

    if (this.isArray(tagName, this.tagStack)) {
      const key = this.tagStack.join('/');
      this.arrayIndexes.set(key, (this.arrayIndexes.get(key) ?? -1) + 1);
    }
  }

  private handleCloseTag(tagName: string) {
    if (this.tagStack[this.tagStack.length - 1] !== tagName) {
      return;
    }

    this.prevTagStack = [...this.tagStack];
    this.tagStack.pop();
    this.closedTag = tagName;

    if (this.tagStack.length === 0 && this.hasMessage) {
      this.messageIndex++;
    }
  }

  private handleSelfClosingTag(tagName: string) {
    this.handleCloseTag(tagName);
  }

  private emitOpen(chunk: string) {
    if (!this.currentController || !chunk) {
      return;
    }

    const state = this.tagStack.length > 0 ? 'tag_open' : 'message_open';
    if (state === 'message_open') {
      this.hasMessage = true;
    }

    const path = this.tagStack.length > 0 ? this.getPath() : [this.messageIndex];

    this.currentController.enqueue({
      state,
      token: chunk,
      path,
      tagStack: [...this.tagStack],
    });
  }

  private emitClose() {
    if (!this.currentController) {
      return;
    }

    if (this.closedTag) {
      const closedTag = this.closedTag;
      const stackSnapshot = [...this.prevTagStack];
      const tagPath = [...this.getPath(), closedTag];

      this.currentController.enqueue({
        state: 'tag_close',
        token: '',
        path: tagPath,
        tagStack: stackSnapshot,
      });

      this.closedTag = '';

      if (this.tagStack.length === 0) {
        this.currentController.enqueue({
          state: 'data_close',
          token: '',
          path: [...this.getPath(), this.closedTag],
          tagStack: stackSnapshot,
        });
      }
    }

    if (this.closeMessage) {
      this.currentController.enqueue({
        state: 'message_close',
        token: '',
        path: [this.messageIndex],
        tagStack: [],
      });
      this.closeMessage = false;
      this.hasMessage = false;
    }
  }

  private getPath(prev = false) {
    const stack = prev ? this.prevTagStack : this.tagStack;

    const result: (string | number)[] = [];
    for (const tag of stack) {
      result.push(tag);
      const key = result.join('/');
      if (this.arrayIndexes.has(key)) {
        result.push(this.arrayIndexes.get(key)!);
      }
    }

    return result;
  }
}
