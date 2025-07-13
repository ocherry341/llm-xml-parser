import { Parser } from 'htmlparser2';

interface XMLOutput {
  path: (string | number)[];
  text: string;
}

export interface XMLStreamOptions {
  mode?: 'token' | 'partial' | 'complete';
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
    const { mode = 'token', isArray = () => false } = options;
    const ROOT_TAG = 'INTERNAL_ROOT';

    const arrayIndexes = new Map<string, number>();
    const tagStack: string[] = [];
    let prevTagStack: string[] = [];
    let count = 0;

    let buffer: string[] = [];
    const MAX_BUFFER_SIZE = 10;
    let shouldBuffering = false;

    let tagStart = 0;
    let tagEnd = 0;
    let shouldSeparate = false;

    const parser = new Parser(
      {
        onopentag: (name) => {
          prevTagStack = tagStack.join('/').split('/');
          tagStack.push(name);
          tagEnd = parser.endIndex; // index of the '>'
          tagStart = parser.endIndex - name.length - 1; // index of the '<'
          shouldSeparate = true;

          const _isArray = isArray(name, tagStack.slice(1));
          if (_isArray) {
            const key = tagStack.join('/');
            arrayIndexes.set(key, (arrayIndexes.get(key) ?? -1) + 1);
          }
        },
        onclosetag(name) {
          if (tagStack[tagStack.length - 1] === name) {
            prevTagStack = tagStack.join('/').split('/');
            tagStack.pop();
          }
          tagEnd = parser.endIndex; // index of the '>'
          tagStart = parser.endIndex - name.length - 2; // index of the '<'
          shouldSeparate = true;
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

      transform: (chunk: string, controller: TransformStreamDefaultController<XMLOutput>) => {
        // buffering tokens if the chunk contains incomplete tags
        if (chunk.includes('<')) {
          shouldBuffering = true;
        }
        if (chunk.includes('>') || buffer.length >= MAX_BUFFER_SIZE) {
          shouldBuffering = false;
        }
        if (shouldBuffering) {
          buffer.push(chunk);
          return;
        }

        let chunkToWrite = '';
        if (buffer.length > 0) {
          chunkToWrite += buffer.join('');
          buffer = [];
        }
        chunkToWrite += chunk;

        // write to parser
        count += chunkToWrite.length;
        shouldSeparate = false;
        parser.write(chunkToWrite);

        // separate xml tag from current chunk
        if (shouldSeparate) {
          const prev = chunkToWrite.slice(0, chunkToWrite.length - count + tagStart);
          const path = this.getPath(prevTagStack, arrayIndexes);
          if (prev) {
            this.emit({
              mode,
              controller,
              path: path,
              chunk: prev,
            });
          }
          chunkToWrite = chunkToWrite.slice(
            chunkToWrite.length + tagEnd - count + 1,
            chunkToWrite.length
          );
        }

        if (chunkToWrite) {
          const path = this.getPath(tagStack, arrayIndexes);
          this.emit({
            mode,
            controller,
            path: path,
            chunk: chunkToWrite,
          });
        }
      },

      flush: () => {
        const tag = `</${ROOT_TAG}>`;
        parser.write(tag);
        count += tag.length;
        parser.end();
      },
    });
  }

  private emit({
    mode,
    controller,
    path,
    chunk,
  }: {
    mode: 'token' | 'partial' | 'complete';
    controller: TransformStreamDefaultController<XMLOutput>;
    path: (string | number)[];
    chunk: string;
  }) {
    if (mode === 'token') {
      controller.enqueue({
        path: path,
        text: chunk,
      });
      return;
    }

    throw new Error(`mode "${mode}" is not implemented yet`);
  }

  // TODO make chunks into object
  // private append(paths: string[], chunk: string) {}

  private getPath(tagStack: string[], arrayIndexes: Map<string, number>) {
    const result: (string | number)[] = [];
    for (const tag of tagStack) {
      result.push(tag);
      const key = result.join('/');
      if (arrayIndexes.has(key)) {
        result.push(arrayIndexes.get(key)!);
      }
    }
    return result.slice(1);
  }
}
