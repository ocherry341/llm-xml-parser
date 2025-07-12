import { Parser } from 'htmlparser2';

interface XMLOutput {
  paths: string[];
  text: string;
}

export class XMLStream extends TransformStream<string, XMLOutput> {
  constructor() {
    const ROOT_TAG = 'INTERNAL_ROOT';
    const tagStack: string[] = [];
    let prevPaths: string[] = [];
    let count = 0;

    let buffer: string[] = [];
    const MAX_BUFFER_SIZE = 10;
    let shouldBuffering = false;

    let tagStart = 0;
    let tagEnd = 0;
    let shouldSeparate = false;

    const parser = new Parser(
      {
        onopentag(name) {
          prevPaths = tagStack.join().split(',');
          tagStack.push(name);
          tagEnd = parser.endIndex; // index of the '>'
          tagStart = parser.endIndex - name.length - 1; // index of the '<'
          shouldSeparate = true;
        },
        onclosetag(name) {
          if (tagStack[tagStack.length - 1] === name) {
            prevPaths = tagStack.join().split(',');
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
          if (prev) {
            controller.enqueue({
              paths: prevPaths.slice(1),
              text: prev,
            });
          }
          chunkToWrite = chunkToWrite.slice(
            chunkToWrite.length + tagEnd - count + 1,
            chunkToWrite.length
          );
        }

        if (chunkToWrite) {
          controller.enqueue({
            paths: tagStack.slice(1),
            text: chunkToWrite,
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
}
