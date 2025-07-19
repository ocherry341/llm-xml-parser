export const STATE = {
  UNKNOWN: 0,
  TAG_OPEN: 1,
  TAG_CLOSE: 2,
};

// splits the input string with XML tags boundaries
export function splitChunk(str: string) {
  const result = [] as { token: string; state: number }[];

  let current = '';
  let state = STATE.UNKNOWN;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];

    if (char === '<') {
      if (current.trim()) {
        result.push({ token: current, state });
      }
      current = '<';
      state = STATE.TAG_OPEN;
    } else if (char === '>') {
      state = STATE.TAG_CLOSE;
      current += '>';
      result.push({ token: current, state });
      current = '';
    } else {
      current += char;
    }
  }

  if (current) {
    result.push({ token: current, state });
  }

  const filteredResult = result.filter((item) => item.token.trim().length > 0);
  return filteredResult;
}
