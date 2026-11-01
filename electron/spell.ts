import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import nspell from 'nspell';

type Speller = { correct(word: string): boolean; suggest(word: string): string[] };

export class SpellService {
  private dictionaries: Record<string, Speller> | null = null;
  private customWords = new Set<string>();

  private load(): Record<string, Speller> {
    if (this.dictionaries) return this.dictionaries;
    const result: Record<string, Speller> = {};
    for (const lang of ['en', 'fr']) {
      try {
        const dir = path.join(app.getAppPath(), 'node_modules', `dictionary-${lang}`);
        const aff = fs.readFileSync(path.join(dir, 'index.aff'));
        const dic = fs.readFileSync(path.join(dir, 'index.dic'));
        result[lang] = nspell(aff, dic) as unknown as Speller;
      } catch (error) {
        console.error(`Spell dictionary ${lang} unavailable`, error);
      }
    }
    this.dictionaries = result;
    return result;
  }

  addWord(word: string) {
    this.customWords.add(word.toLowerCase());
  }

  check(words: string[], languages: string[]): string[] {
    const active = (languages.length ? languages : ['en']).filter((l) => l === 'en' || l === 'fr');
    const dicts = this.load();
    const available = active.map((l) => dicts[l]).filter(Boolean);
    if (!available.length) return [];
    const unknown: string[] = [];
    for (const word of words) {
      if (!word || word.length < 2) continue;
      if (/\d/.test(word)) continue;
      if (/^[A-Z0-9]{2,}$/.test(word)) continue;
      if (this.customWords.has(word.toLowerCase())) continue;
      const candidates = [word, word.replace(/[’']s$/i, ''), word.replace(/[’']/g, "'")];
      const known = candidates.some((candidate) => available.some((dict) => dict.correct(candidate)));
      if (!known) unknown.push(word);
    }
    return unknown;
  }

  suggest(word: string, languages: string[]): string[] {
    const active = (languages.length ? languages : ['en']).filter((l) => l === 'en' || l === 'fr');
    const dicts = this.load();
    const suggestions = new Set<string>();
    for (const lang of active) {
      const dict = dicts[lang];
      if (!dict) continue;
      try {
        for (const s of dict.suggest(word).slice(0, 6)) suggestions.add(s);
      } catch { /* ignore */ }
    }
    return [...suggestions].slice(0, 8);
  }
}
