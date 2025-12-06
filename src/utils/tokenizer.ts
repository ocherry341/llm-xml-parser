import { EntityDecoder, DecodingMode, xmlDecodeTree } from 'entities/decode';

const enum CharCodes {
  Tab = 0x9, // "\t"
  NewLine = 0xa, // "\n"
  FormFeed = 0xc, // "\f"
  CarriageReturn = 0xd, // "\r"
  Space = 0x20, // " "
  ExclamationMark = 0x21, // "!"
  Number = 0x23, // "#"
  Amp = 0x26, // "&"
  SingleQuote = 0x27, // "'"
  DoubleQuote = 0x22, // '"'
  Dash = 0x2d, // "-"
  Slash = 0x2f, // "/"
  Zero = 0x30, // "0"
  Nine = 0x39, // "9"
  Semi = 0x3b, // ";"
  Lt = 0x3c, // "<"
  Eq = 0x3d, // "="
  Gt = 0x3e, // ">"
  Questionmark = 0x3f, // "?"
  UpperA = 0x41, // "A"
  LowerA = 0x61, // "a"
  UpperF = 0x46, // "F"
  LowerF = 0x66, // "f"
  UpperZ = 0x5a, // "Z"
  LowerZ = 0x7a, // "z"
  LowerX = 0x78, // "x"
  OpeningSquareBracket = 0x5b, // "["
}

/** All the states the tokenizer can be in. */
const enum State {
  Text = 1,
  BeforeTagName, // After <
  InTagName,
  InSelfClosingTag,
  BeforeClosingTagName,
  InClosingTagName,
  AfterClosingTagName,

  // Attributes
  BeforeAttributeName,
  InAttributeName,
  AfterAttributeName,
  BeforeAttributeValue,
  InAttributeValueDq, // "
  InAttributeValueSq, // '
  InAttributeValueNq,

  // Declarations
  BeforeDeclaration, // !
  InDeclaration,

  // Processing instructions
  InProcessingInstruction, // ?

  // Comments & CDATA
  BeforeComment,
  CDATASequence,
  InCommentLike,

  InEntity,

  // Outside of XML
  OutsideXml,
}

function isWhitespace(c: number): boolean {
  return (
    c === CharCodes.Space ||
    c === CharCodes.NewLine ||
    c === CharCodes.Tab ||
    c === CharCodes.FormFeed ||
    c === CharCodes.CarriageReturn
  );
}

function isEndOfTagSection(c: number): boolean {
  return c === CharCodes.Slash || c === CharCodes.Gt || isWhitespace(c);
}

export enum QuoteType {
  NoValue = 0,
  Unquoted = 1,
  Single = 2,
  Double = 3,
}

export interface AttributeEvent {
  tagName: string;
  name: string;
  value: string | null;
  quote: QuoteType;
}

export interface Callbacks {
  onText(text: string): void;
  onCdata(content: string): void;
  onComment(content: string): void;
  onDeclaration(content: string): void;
  onProcessingInstruction(content: string): void;
  onOpenTag(tagName: string): void;
  onOpenTagEnd(tagName: string): void;
  onAttribute(attribute: AttributeEvent): void;
  onCloseTag(tagName: string): void;
  onSelfClosingTag(tagName: string): void;
  onEnd(): void;
}

interface InternalCallbacks {
  onattribdata(start: number, endIndex: number): void;
  onattribentity(codepoint: number): void;
  onattribend(quote: QuoteType, endIndex: number): void;
  onattribname(start: number, endIndex: number): void;
  oncdata(start: number, endIndex: number, endOffset: number): void;
  onclosetag(start: number, endIndex: number): void;
  oncomment(start: number, endIndex: number, endOffset: number): void;
  ondeclaration(start: number, endIndex: number): void;
  onend(): void;
  onopentagend(endIndex: number): void;
  onopentagname(start: number, endIndex: number): void;
  onprocessinginstruction(start: number, endIndex: number): void;
  onselfclosingtag(endIndex: number): void;
  ontext(start: number, endIndex: number): void;
  ontextentity(codepoint: number, endIndex: number): void;
}

/**
 * Sequences used to match longer strings.
 *
 * We don't have `Script`, `Style`, or `Title` here. Instead, we re-use the *End
 * sequences with an increased offset.
 */
const Sequences = {
  Cdata: new Uint8Array([0x43, 0x44, 0x41, 0x54, 0x41, 0x5b]), // CDATA[
  CdataEnd: new Uint8Array([0x5d, 0x5d, 0x3e]), // ]]>
  CommentEnd: new Uint8Array([0x2d, 0x2d, 0x3e]), // `-->`
};

export default class Tokenizer {
  /** The current state the tokenizer is in. */
  private state = State.Text;
  /** The read buffer containing unconsumed data. */
  private buffer = '';
  /** The beginning of the section that is currently being read. */
  private sectionStart = 0;
  /** The index within the buffer that we are currently looking at. */
  private index = 0;
  /** The start of the last entity. */
  private entityStart = 0;
  /** Some behavior, eg. when decoding entities, is done while we are in another state. This keeps track of the other state type. */
  private baseState = State.Text;
  /** Indicates whether the tokenizer has been paused. */
  public running = true;
  /** The offset of the first character stored in the buffer. */
  private offset = 0;

  private readonly decodeEntities: boolean;
  private readonly externalCbs: Callbacks;
  private readonly cbs: InternalCallbacks;
  private readonly entityDecoder: EntityDecoder;

  private textBuffer = '';
  private currentTagName: string | null = null;
  private currentAttributeName: string | null = null;
  private currentAttributeValue = '';

  constructor({ decodeEntities = true }: { decodeEntities?: boolean }, cbs: Callbacks) {
    this.decodeEntities = decodeEntities;
    this.externalCbs = cbs;
    this.cbs = this.createInternalCallbacks();
    this.entityDecoder = new EntityDecoder(xmlDecodeTree, (cp, consumed) =>
      this.emitCodePoint(cp, consumed)
    );
  }

  private createInternalCallbacks(): InternalCallbacks {
    return {
      onattribdata: (start, end) => this.appendAttributeRange(start, end),
      onattribentity: (codepoint) => this.appendAttributeEntity(codepoint),
      onattribend: (quote) => this.finalizeAttribute(quote),
      onattribname: (start, end) => this.startAttribute(this.sliceSection(start, end)),
      oncdata: (start, end, endOffset) =>
        this.externalCbs.onCdata(this.sliceWithEndOffset(start, end, endOffset)),
      onclosetag: (start, end) => this.externalCbs.onCloseTag(this.sliceSection(start, end)),
      oncomment: (start, end, endOffset) =>
        this.externalCbs.onComment(this.sliceWithEndOffset(start, end, endOffset)),
      ondeclaration: (start, end) => this.externalCbs.onDeclaration(this.sliceSection(start, end)),
      onend: () => {
        this.flushTextBuffer();
        this.externalCbs.onEnd();
      },
      onopentagend: () => {
        const tagName = this.currentTagName ?? '';
        this.externalCbs.onOpenTagEnd(tagName);
        this.resetAttributeState();
        this.currentTagName = null;
      },
      onopentagname: (start, end) => {
        const tagName = this.sliceSection(start, end);
        this.currentTagName = tagName;
        this.externalCbs.onOpenTag(tagName);
        this.resetAttributeState();
      },
      onprocessinginstruction: (start, end) =>
        this.externalCbs.onProcessingInstruction(this.sliceSection(start, end)),
      onselfclosingtag: () => {
        const tagName = this.currentTagName ?? '';
        this.externalCbs.onSelfClosingTag(tagName);
        this.resetAttributeState();
        this.currentTagName = null;
      },
      ontext: (start, end) => this.appendTextRange(start, end),
      ontextentity: (codepoint) => this.appendTextEntity(codepoint),
    };
  }

  private sliceSection(start: number, end: number): string {
    if (end <= start) {
      return '';
    }
    const localStart = Math.max(0, start - this.offset);
    const localEnd = Math.max(localStart, end - this.offset);
    if (localStart >= this.buffer.length) {
      return '';
    }
    return this.buffer.slice(localStart, localEnd);
  }

  private sliceWithEndOffset(start: number, endIndex: number, endOffset: number): string {
    const adjustedEnd = endIndex - endOffset;
    if (adjustedEnd <= start) {
      return '';
    }
    return this.sliceSection(start, adjustedEnd);
  }

  private appendTextRange(start: number, end: number): void {
    const chunk = this.sliceSection(start, end);
    if (chunk) {
      this.textBuffer += chunk;
    }
  }

  private appendTextEntity(codepoint: number): void {
    this.textBuffer += String.fromCodePoint(codepoint);
  }

  private flushTextBuffer(): void {
    if (this.textBuffer.length > 0) {
      this.externalCbs.onText(this.textBuffer);
      this.textBuffer = '';
    }
  }

  private startAttribute(name: string): void {
    this.resetAttributeState();
    if (!name) {
      return;
    }
    this.currentAttributeName = name;
  }

  private appendAttributeRange(start: number, end: number): void {
    if (this.currentAttributeName === null) {
      return;
    }
    const chunk = this.sliceSection(start, end);
    if (chunk) {
      this.currentAttributeValue += chunk;
    }
  }

  private appendAttributeEntity(codepoint: number): void {
    if (this.currentAttributeName === null) {
      return;
    }
    this.currentAttributeValue += String.fromCodePoint(codepoint);
  }

  private finalizeAttribute(quote: QuoteType): void {
    if (this.currentAttributeName === null || this.currentTagName === null) {
      this.resetAttributeState();
      return;
    }

    const hasValue = quote !== QuoteType.NoValue || this.currentAttributeValue.length > 0;
    const value = hasValue ? this.currentAttributeValue : null;

    this.externalCbs.onAttribute({
      tagName: this.currentTagName,
      name: this.currentAttributeName,
      value,
      quote,
    });

    this.resetAttributeState();
  }

  private resetAttributeState(): void {
    this.currentAttributeName = null;
    this.currentAttributeValue = '';
  }

  public reset(): void {
    this.state = State.Text;
    this.buffer = '';
    this.sectionStart = 0;
    this.index = 0;
    this.baseState = State.Text;
    this.currentSequence = undefined!;
    this.sequenceIndex = 0;
    this.running = true;
    this.offset = 0;
    this.entityStart = 0;
    this.textBuffer = '';
    this.currentTagName = null;
    this.resetAttributeState();
  }

  public write(chunk: string): void {
    if (chunk.length === 0) {
      return;
    }
    this.buffer += chunk;
    this.parse();
  }

  public end(): void {
    if (this.running) this.finish();
  }

  public pause(): void {
    this.running = false;
  }

  public resume(): void {
    this.running = true;
    if (this.index < this.buffer.length + this.offset) {
      this.parse();
    }
  }

  private stateText(c: number): void {
    if (c === CharCodes.Lt || (!this.decodeEntities && this.fastForwardTo(CharCodes.Lt))) {
      if (this.index > this.sectionStart) {
        this.cbs.ontext(this.sectionStart, this.index);
        this.flushTextBuffer();
      }
      this.state = State.BeforeTagName;
      this.sectionStart = this.index;
    } else if (this.decodeEntities && c === CharCodes.Amp) {
      this.startEntity();
    }
  }

  private currentSequence: Uint8Array = undefined!;
  private sequenceIndex = 0;

  private stateCDATASequence(c: number): void {
    if (c === Sequences.Cdata[this.sequenceIndex]) {
      if (++this.sequenceIndex === Sequences.Cdata.length) {
        this.state = State.InCommentLike;
        this.currentSequence = Sequences.CdataEnd;
        this.sequenceIndex = 0;
        this.sectionStart = this.index + 1;
      }
    } else {
      this.sequenceIndex = 0;
      this.state = State.InDeclaration;
      this.stateInDeclaration(c); // Reconsume the character
    }
  }

  /**
   * When we wait for one specific character, we can speed things up
   * by skipping through the buffer until we find it.
   *
   * @returns Whether the character was found.
   */
  private fastForwardTo(c: number): boolean {
    while (++this.index < this.buffer.length + this.offset) {
      if (this.buffer.charCodeAt(this.index - this.offset) === c) {
        return true;
      }
    }

    /*
     * We increment the index at the end of the `parse` loop,
     * so set it to `buffer.length - 1` here.
     *
     * TODO: Refactor `parse` to increment index before calling states.
     */
    this.index = this.buffer.length + this.offset - 1;

    return false;
  }

  /**
   * Comments and CDATA end with `-->` and `]]>`.
   *
   * Their common qualities are:
   * - Their end sequences have a distinct character they start with.
   * - That character is then repeated, so we have to check multiple repeats.
   * - All characters but the start character of the sequence can be skipped.
   */
  private stateInCommentLike(c: number): void {
    if (c === this.currentSequence[this.sequenceIndex]) {
      if (++this.sequenceIndex === this.currentSequence.length) {
        if (this.currentSequence === Sequences.CdataEnd) {
          this.cbs.oncdata(this.sectionStart, this.index, 2);
        } else {
          this.cbs.oncomment(this.sectionStart, this.index, 2);
        }

        this.sequenceIndex = 0;
        this.sectionStart = this.index + 1;
        this.state = State.Text;
      }
    } else if (this.sequenceIndex === 0) {
      // Fast-forward to the first character of the sequence
      if (this.fastForwardTo(this.currentSequence[0])) {
        this.sequenceIndex = 1;
      }
    } else if (c !== this.currentSequence[this.sequenceIndex - 1]) {
      // Allow long sequences, eg. --->, ]]]>
      this.sequenceIndex = 0;
    }
  }

  /**
   * HTML only allows ASCII alpha characters (a-z and A-Z) at the beginning of a tag name.
   *
   * XML allows a lot more characters here (@see https://www.w3.org/TR/REC-xml/#NT-NameStartChar).
   * We allow anything that wouldn't end the tag.
   */
  private isTagStartChar(c: number) {
    return !isEndOfTagSection(c);
  }

  private stateBeforeTagName(c: number): void {
    if (c === CharCodes.ExclamationMark) {
      this.state = State.BeforeDeclaration;
      this.sectionStart = this.index + 1;
    } else if (c === CharCodes.Questionmark) {
      this.state = State.InProcessingInstruction;
      this.sectionStart = this.index + 1;
    } else if (this.isTagStartChar(c)) {
      this.sectionStart = this.index;
      this.state = State.InTagName;
    } else if (c === CharCodes.Slash) {
      this.state = State.BeforeClosingTagName;
    } else {
      this.state = State.Text;
      this.stateText(c);
    }
  }
  private stateInTagName(c: number): void {
    if (isEndOfTagSection(c)) {
      this.cbs.onopentagname(this.sectionStart, this.index);
      this.sectionStart = -1;
      this.state = State.BeforeAttributeName;
      this.stateBeforeAttributeName(c);
    }
  }
  private stateBeforeClosingTagName(c: number): void {
    if (isWhitespace(c)) {
      // Ignore
    } else if (c === CharCodes.Gt) {
      this.state = State.Text;
    } else {
      this.state = this.isTagStartChar(c) ? State.InClosingTagName : State.InCommentLike;
      this.sectionStart = this.index;
    }
  }
  private stateInClosingTagName(c: number): void {
    if (c === CharCodes.Gt || isWhitespace(c)) {
      this.cbs.onclosetag(this.sectionStart, this.index);
      this.sectionStart = -1;
      this.state = State.AfterClosingTagName;
      this.stateAfterClosingTagName(c);
    }
  }
  private stateAfterClosingTagName(c: number): void {
    // Skip everything until ">"
    if (c === CharCodes.Gt || this.fastForwardTo(CharCodes.Gt)) {
      this.state = State.Text;
      this.sectionStart = this.index + 1;
    }
  }
  private stateBeforeAttributeName(c: number): void {
    if (c === CharCodes.Gt) {
      this.cbs.onopentagend(this.index);
      this.state = State.Text;
      this.sectionStart = this.index + 1;
    } else if (c === CharCodes.Slash) {
      this.state = State.InSelfClosingTag;
    } else if (!isWhitespace(c)) {
      this.state = State.InAttributeName;
      this.sectionStart = this.index;
    }
  }
  private stateInSelfClosingTag(c: number): void {
    if (c === CharCodes.Gt) {
      this.cbs.onselfclosingtag(this.index);
      this.state = State.Text;
      this.sectionStart = this.index + 1;
      this.state = State.Text;
    } else if (!isWhitespace(c)) {
      this.state = State.BeforeAttributeName;
      this.stateBeforeAttributeName(c);
    }
  }
  private stateInAttributeName(c: number): void {
    if (c === CharCodes.Eq || isEndOfTagSection(c)) {
      this.cbs.onattribname(this.sectionStart, this.index);
      this.sectionStart = this.index;
      this.state = State.AfterAttributeName;
      this.stateAfterAttributeName(c);
    }
  }
  private stateAfterAttributeName(c: number): void {
    if (c === CharCodes.Eq) {
      this.state = State.BeforeAttributeValue;
    } else if (c === CharCodes.Slash || c === CharCodes.Gt) {
      this.cbs.onattribend(QuoteType.NoValue, this.sectionStart);
      this.sectionStart = -1;
      this.state = State.BeforeAttributeName;
      this.stateBeforeAttributeName(c);
    } else if (!isWhitespace(c)) {
      this.cbs.onattribend(QuoteType.NoValue, this.sectionStart);
      this.state = State.InAttributeName;
      this.sectionStart = this.index;
    }
  }
  private stateBeforeAttributeValue(c: number): void {
    if (c === CharCodes.DoubleQuote) {
      this.state = State.InAttributeValueDq;
      this.sectionStart = this.index + 1;
    } else if (c === CharCodes.SingleQuote) {
      this.state = State.InAttributeValueSq;
      this.sectionStart = this.index + 1;
    } else if (!isWhitespace(c)) {
      this.sectionStart = this.index;
      this.state = State.InAttributeValueNq;
      this.stateInAttributeValueNoQuotes(c); // Reconsume token
    }
  }
  private handleInAttributeValue(c: number, quote: number) {
    if (c === quote || (!this.decodeEntities && this.fastForwardTo(quote))) {
      this.cbs.onattribdata(this.sectionStart, this.index);
      this.sectionStart = -1;
      this.cbs.onattribend(
        quote === CharCodes.DoubleQuote ? QuoteType.Double : QuoteType.Single,
        this.index + 1
      );
      this.state = State.BeforeAttributeName;
    } else if (this.decodeEntities && c === CharCodes.Amp) {
      this.startEntity();
    }
  }
  private stateInAttributeValueDoubleQuotes(c: number): void {
    this.handleInAttributeValue(c, CharCodes.DoubleQuote);
  }
  private stateInAttributeValueSingleQuotes(c: number): void {
    this.handleInAttributeValue(c, CharCodes.SingleQuote);
  }
  private stateInAttributeValueNoQuotes(c: number): void {
    if (isWhitespace(c) || c === CharCodes.Gt) {
      this.cbs.onattribdata(this.sectionStart, this.index);
      this.sectionStart = -1;
      this.cbs.onattribend(QuoteType.Unquoted, this.index);
      this.state = State.BeforeAttributeName;
      this.stateBeforeAttributeName(c);
    } else if (this.decodeEntities && c === CharCodes.Amp) {
      this.startEntity();
    }
  }
  private stateBeforeDeclaration(c: number): void {
    if (c === CharCodes.OpeningSquareBracket) {
      this.state = State.CDATASequence;
      this.sequenceIndex = 0;
    } else {
      this.state = c === CharCodes.Dash ? State.BeforeComment : State.InDeclaration;
    }
  }
  private stateInDeclaration(c: number): void {
    if (c === CharCodes.Gt || this.fastForwardTo(CharCodes.Gt)) {
      this.cbs.ondeclaration(this.sectionStart, this.index);
      this.state = State.Text;
      this.sectionStart = this.index + 1;
    }
  }
  private stateInProcessingInstruction(c: number): void {
    if (c === CharCodes.Gt || this.fastForwardTo(CharCodes.Gt)) {
      this.cbs.onprocessinginstruction(this.sectionStart, this.index);
      this.state = State.Text;
      this.sectionStart = this.index + 1;
    }
  }
  private stateBeforeComment(c: number): void {
    if (c === CharCodes.Dash) {
      this.state = State.InCommentLike;
      this.currentSequence = Sequences.CommentEnd;
      // Allow short comments (eg. <!-->)
      this.sequenceIndex = 2;
      this.sectionStart = this.index + 1;
    } else {
      this.state = State.InDeclaration;
    }
  }
  private startEntity() {
    this.baseState = this.state;
    this.state = State.InEntity;
    this.entityStart = this.index;
    this.entityDecoder.startEntity(DecodingMode.Strict);
  }

  private stateInEntity(): void {
    const length = this.entityDecoder.write(this.buffer, this.index - this.offset);

    // If `length` is positive, we are done with the entity.
    if (length >= 0) {
      this.state = this.baseState;

      if (length === 0) {
        this.index = this.entityStart;
      }
    } else {
      // Mark buffer as consumed.
      this.index = this.offset + this.buffer.length - 1;
    }
  }

  /**
   * Remove data that has already been consumed from the buffer.
   */
  private cleanup() {
    // If we are inside of text or attributes, emit what we already have.
    if (this.running && this.sectionStart !== this.index) {
      if (this.state === State.Text) {
        this.cbs.ontext(this.sectionStart, this.index);
        this.flushTextBuffer();
        this.sectionStart = this.index;
      } else if (
        this.state === State.InAttributeValueDq ||
        this.state === State.InAttributeValueSq ||
        this.state === State.InAttributeValueNq
      ) {
        this.cbs.onattribdata(this.sectionStart, this.index);
        this.sectionStart = this.index;
      }
    }
  }

  private trimBuffer(): void {
    let minIndex = this.index;

    if (this.sectionStart !== -1 && this.sectionStart < minIndex) {
      minIndex = this.sectionStart;
    }

    if (this.state === State.InEntity && this.entityStart < minIndex) {
      minIndex = this.entityStart;
    }

    const removeCount = minIndex - this.offset;
    if (removeCount > 0) {
      if (removeCount >= this.buffer.length) {
        this.buffer = '';
        this.offset += removeCount;
        return;
      }
      this.buffer = this.buffer.slice(removeCount);
      this.offset += removeCount;
    }
  }

  private shouldContinue() {
    return this.index < this.buffer.length + this.offset && this.running;
  }

  /**
   * Iterates through the buffer, calling the function corresponding to the current state.
   *
   * States that are more likely to be hit are higher up, as a performance improvement.
   */
  private parse() {
    while (this.shouldContinue()) {
      const c = this.buffer.charCodeAt(this.index - this.offset);
      switch (this.state) {
        case State.Text: {
          this.stateText(c);
          break;
        }
        case State.CDATASequence: {
          this.stateCDATASequence(c);
          break;
        }
        case State.InAttributeValueDq: {
          this.stateInAttributeValueDoubleQuotes(c);
          break;
        }
        case State.InAttributeName: {
          this.stateInAttributeName(c);
          break;
        }
        case State.InCommentLike: {
          this.stateInCommentLike(c);
          break;
        }
        case State.BeforeAttributeName: {
          this.stateBeforeAttributeName(c);
          break;
        }
        case State.InTagName: {
          this.stateInTagName(c);
          break;
        }
        case State.InClosingTagName: {
          this.stateInClosingTagName(c);
          break;
        }
        case State.BeforeTagName: {
          this.stateBeforeTagName(c);
          break;
        }
        case State.AfterAttributeName: {
          this.stateAfterAttributeName(c);
          break;
        }
        case State.InAttributeValueSq: {
          this.stateInAttributeValueSingleQuotes(c);
          break;
        }
        case State.BeforeAttributeValue: {
          this.stateBeforeAttributeValue(c);
          break;
        }
        case State.BeforeClosingTagName: {
          this.stateBeforeClosingTagName(c);
          break;
        }
        case State.AfterClosingTagName: {
          this.stateAfterClosingTagName(c);
          break;
        }
        case State.InAttributeValueNq: {
          this.stateInAttributeValueNoQuotes(c);
          break;
        }
        case State.InSelfClosingTag: {
          this.stateInSelfClosingTag(c);
          break;
        }
        case State.InDeclaration: {
          this.stateInDeclaration(c);
          break;
        }
        case State.BeforeDeclaration: {
          this.stateBeforeDeclaration(c);
          break;
        }
        case State.BeforeComment: {
          this.stateBeforeComment(c);
          break;
        }
        case State.InProcessingInstruction: {
          this.stateInProcessingInstruction(c);
          break;
        }
        case State.InEntity: {
          this.stateInEntity();
          break;
        }
      }
      this.index++;
    }
    this.cleanup();
    this.trimBuffer();
  }

  private finish() {
    if (this.state === State.InEntity) {
      this.entityDecoder.end();
      this.state = this.baseState;
    }

    this.handleTrailingData();
    this.trimBuffer();

    this.cbs.onend();
  }

  /** Handle any trailing data. */
  private handleTrailingData() {
    const endIndex = this.buffer.length + this.offset;

    // If there is no remaining data, we are done.
    if (this.sectionStart >= endIndex) {
      return;
    }

    if (this.state === State.InCommentLike) {
      if (this.currentSequence === Sequences.CdataEnd) {
        this.cbs.oncdata(this.sectionStart, endIndex, 0);
      } else {
        this.cbs.oncomment(this.sectionStart, endIndex, 0);
      }
    } else if (
      this.state === State.InTagName ||
      this.state === State.BeforeAttributeName ||
      this.state === State.BeforeAttributeValue ||
      this.state === State.AfterAttributeName ||
      this.state === State.InAttributeName ||
      this.state === State.InAttributeValueSq ||
      this.state === State.InAttributeValueDq ||
      this.state === State.InAttributeValueNq ||
      this.state === State.InClosingTagName
    ) {
      /*
       * If we are currently in an opening or closing tag, us not calling the
       * respective callback signals that the tag should be ignored.
       */
    } else {
      this.cbs.ontext(this.sectionStart, endIndex);
      this.flushTextBuffer();
    }
  }

  private emitCodePoint(cp: number, consumed: number): void {
    if (this.baseState !== State.Text) {
      if (this.sectionStart < this.entityStart) {
        this.cbs.onattribdata(this.sectionStart, this.entityStart);
      }
      this.sectionStart = this.entityStart + consumed;
      this.index = this.sectionStart - 1;

      this.cbs.onattribentity(cp);
    } else {
      if (this.sectionStart < this.entityStart) {
        this.cbs.ontext(this.sectionStart, this.entityStart);
      }
      this.sectionStart = this.entityStart + consumed;
      this.index = this.sectionStart - 1;

      this.cbs.ontextentity(cp, this.sectionStart);
    }
  }
}
