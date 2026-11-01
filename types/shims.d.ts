// Ambient declarations for small CommonJS packages that do not ship types.

declare module 'word-extractor' {
  interface ExtractedDocument {
    getBody(): string;
    getHeaders?(): string;
    getFooters?(): string;
    getFootnotes?(): string;
  }
  class WordExtractor {
    extract(data: Buffer | string): Promise<ExtractedDocument>;
  }
  export = WordExtractor;
}

declare module 'turndown-plugin-gfm' {
  export const gfm: (service: unknown) => void;
  export const tables: (service: unknown) => void;
  export const strikethrough: (service: unknown) => void;
  export const taskListItems: (service: unknown) => void;
}

declare module 'nspell' {
  interface NSpell {
    correct(word: string): boolean;
    suggest(word: string): string[];
    add(word: string): void;
    remove(word: string): void;
  }
  function nspell(aff: Buffer | string, dic?: Buffer | string): NSpell;
  export = nspell;
}
