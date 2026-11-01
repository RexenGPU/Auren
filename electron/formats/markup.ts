import fs from 'node:fs';
import path from 'node:path';
import { marked } from 'marked';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import type { PageSettings } from '../../shared/types';
import { DEFAULT_PAGE_SETTINGS } from '../../shared/types';

export interface ConversionResult {
  html: string;
  warnings: string[];
  title?: string;
  pageSettings?: PageSettings;
}

const IMG_MIME: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.bmp': 'image/bmp', '.svg': 'image/svg+xml'
};

export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function sanitizeHtmlBasic(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object[\s\S]*?<\/object>/gi, '')
    .replace(/<embed[^>]*>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '');
}

export function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/td>/gi, '\t')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function plainTextToHtml(text: string): string {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!normalized) return '<p></p>';
  return normalized.split(/\n{2,}/).map((block) => {
    const lines = block.split('\n').map((line) => escapeHtml(line)).join('<br>');
    return `<p>${lines || '<br>'}</p>`;
  }).join('');
}

function fileToDataUrl(filePath: string): string | null {
  try {
    const ext = path.extname(filePath).toLowerCase();
    const mime = IMG_MIME[ext];
    if (!mime) return null;
    const data = fs.readFileSync(filePath).toString('base64');
    return `data:${mime};base64,${data}`;
  } catch {
    return null;
  }
}

export function embedLocalImages(html: string, baseDir: string, warnings: Set<string>): string {
  return html.replace(/<img\b[^>]*?\bsrc\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>/gi, (tag, _q, dq, sq, bare) => {
    const src = String(dq || sq || bare || '');
    if (!src || src.startsWith('data:') || src.startsWith('blob:')) return tag;
    if (/^https?:/i.test(src)) {
      warnings.add('Remote images were not downloaded for privacy reasons. Save them locally and insert them again.');
      return tag.replace(/\bsrc\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/i, 'src=""');
    }
    if (src.startsWith('file://')) {
      try {
        const filePath = decodeURIComponent(new URL(src).pathname.replace(/^\//, ''));
        const data = fileToDataUrl(filePath);
        if (data) return tag.replace(/\bsrc\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/i, `src="${data}"`);
      } catch { /* ignore */ }
      return tag;
    }
    const candidate = path.resolve(baseDir, decodeURIComponent(src));
    const data = fileToDataUrl(candidate);
    if (data) return tag.replace(/\bsrc\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/i, `src="${data}"`);
    warnings.add('A linked local image could not be found and was left as a reference.');
    return tag;
  });
}

export function importTxt(buffer: Buffer): ConversionResult {
  return { html: plainTextToHtml(buffer.toString('utf8')), warnings: [] };
}

export function importMarkdown(buffer: Buffer, filePath: string): ConversionResult {
  const warnings = new Set<string>();
  const md = buffer.toString('utf8');
  const html = marked.parse(md, { async: false, gfm: true, breaks: false }) as string;
  const embedded = embedLocalImages(html, path.dirname(filePath), warnings);
  if (/\|.*\|/.test(md)) warnings.add('Markdown tables were converted to editable tables.');
  return { html: embedded, warnings: [...warnings] };
}

export function exportMarkdown(html: string): string {
  const turndown = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    emDelimiter: '*',
    strongDelimiter: '**'
  });
  turndown.use(gfm);
  turndown.addRule('pageBreak', {
    filter: (node) => node.nodeName === 'DIV' && (node as HTMLElement).getAttribute?.('data-page-break') === 'true',
    replacement: () => '\n\n---\n\n'
  });
  turndown.addRule('footnote', {
    filter: (node) => node.nodeName === 'FOOTNOTE',
    replacement: (content) => `[^${content}]`
  });
  turndown.addRule('highlight', {
    filter: 'mark',
    replacement: (content) => `==${content}==`
  });
  turndown.keep(['table', 'thead', 'tbody', 'tr', 'th', 'td', 'sup', 'sub']);
  return turndown.turndown(sanitizeHtmlBasic(html)).trim() + '\n';
}

export function importHtml(buffer: Buffer, filePath: string): ConversionResult {
  const warnings = new Set<string>();
  const raw = buffer.toString('utf8');
  const titleMatch = raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  let body = raw;
  const bodyMatch = raw.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) body = bodyMatch[1];
  body = body.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
  if (/<style[\s\S]*?<\/style>/i.test(raw)) warnings.add('Stylesheet rules from the HTML file were not imported; inline formatting was preserved.');
  body = embedLocalImages(body, path.dirname(filePath), warnings);
  return {
    html: sanitizeHtmlBasic(body) || '<p></p>',
    warnings: [...warnings],
    title: titleMatch ? htmlToPlainText(titleMatch[1]).trim() : undefined
  };
}

const EXPORT_CSS = `
:root { color-scheme: light; }
* { box-sizing: border-box; }
body { margin: 0; background: #f4f3ef; color: #22222a; font-family: Georgia, 'Times New Roman', serif; font-size: 12pt; line-height: 1.65; }
.page { width: var(--page-w); min-height: var(--page-h); margin: 32px auto; padding: var(--mt) var(--mr) var(--mb) var(--ml); background: #fff; box-shadow: 0 20px 60px rgba(20,20,35,.12); }
h1,h2,h3,h4,h5,h6 { font-family: 'Segoe UI', Inter, sans-serif; color: #17172a; line-height: 1.2; margin: 1.4em 0 .55em; }
h1 { font-size: 2.05em; } h2 { font-size: 1.55em; } h3 { font-size: 1.28em; } h4 { font-size: 1.1em; } h5 { font-size: 1em; } h6 { font-size: .92em; text-transform: uppercase; letter-spacing: .06em; }
p { margin: 0 0 .75em; }
a { color: #5b5bd6; text-decoration: underline; text-underline-offset: 2px; }
table { border-collapse: collapse; width: 100%; margin: 1em 0; }
th, td { border: 1px solid #d9d7e3; padding: 7px 9px; vertical-align: top; }
th { background: #f4f3fb; font-weight: 600; }
blockquote { margin: 1.2em 0; padding: .2em 0 .2em 1.1em; border-left: 3px solid #8b7cf6; color: #55556b; }
mark { background: #fff3b0; color: inherit; }
img { max-width: 100%; height: auto; }
hr { border: none; border-top: 1px solid #d9d7e3; margin: 1.8em 0; }
[data-page-break="true"] { break-after: page; }
[data-auren-textbox="true"] { border: 1px solid #ded9ff; background: #f7f5ff; padding: 14px 18px; margin: 1.1em 0; border-radius: 6px; }
footnote { vertical-align: super; font-size: .72em; color: #5b5bd6; }
@media print {
  body { background: #fff; }
  .page { margin: 0; box-shadow: none; width: auto; min-height: 0; padding: 0; }
  @page { size: var(--paper); margin: var(--mt) var(--mr) var(--mb) var(--ml); }
  [data-page-break="true"] { page-break-after: always; }
  h1,h2,h3,h4,h5,h6 { break-after: avoid; }
  tr, img { break-inside: avoid; }
}
`;

export function exportStandaloneHtml(title: string, html: string, page: PageSettings): string {
  const dims = pageDimensions(page);
  const vars = `--page-w:${dims.width}mm;--page-h:${dims.height}mm;--mt:${page.marginTop}mm;--mr:${page.marginRight}mm;--mb:${page.marginBottom}mm;--ml:${page.marginLeft}mm;--paper:${dims.width}mm ${dims.height}mm;`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="AUREN 1.0">
<title>${escapeHtml(title)}</title>
<style>${EXPORT_CSS}</style>
</head>
<body style="${vars}">
<main class="page">
${sanitizeHtmlBasic(html)}
</main>
</body>
</html>`;
}

function pageDimensions(page: PageSettings) {
  return page.orientation === 'landscape'
    ? { width: Math.max(page.widthMm, page.heightMm), height: Math.min(page.widthMm, page.heightMm) }
    : { width: Math.min(page.widthMm, page.heightMm), height: Math.max(page.widthMm, page.heightMm) };
}

/* ------------------------------------------------------------------ RTF */

function decodeCp1252(byte: number): string {
  try {
    return new TextDecoder('windows-1252').decode(Uint8Array.from([byte]));
  } catch {
    return String.fromCharCode(byte);
  }
}

interface RtfState {
  bold: boolean; italic: boolean; underline: boolean; strike: boolean;
  font: string; size: number; color: string; highlight: string;
  align: string; indentLeft: number; indentRight: number; firstLine: number;
  spaceBefore: number; spaceAfter: number; lineHeight: number;
  superscript: boolean; subscript: boolean;
  styleIndex: number | null;
  skip: boolean;
}

function rtStyle(state: RtfState): string {
  const css: string[] = [];
  if (state.font) css.push(`font-family:${state.font.replace(/[;"{}]/g, '')}`);
  if (state.size) css.push(`font-size:${state.size / 2}pt`);
  if (state.color) css.push(`color:${state.color}`);
  if (state.highlight) css.push(`background-color:${state.highlight}`);
  return css.length ? ` style="${css.join(';')}"` : '';
}

function parseRtfTables(rtf: string): { colors: string[]; fonts: Map<number, string>; styles: Map<number, string> } {
  const colors: string[] = [];
  let colorBlock = rtf.match(/\{\\colortbl([\s\S]*?)\}/);
  if (colorBlock) {
    const entries = colorBlock[1].split(';');
    for (const entry of entries) {
      const r = Number(entry.match(/\\red(\d+)/)?.[1] || 0);
      const g = Number(entry.match(/\\green(\d+)/)?.[1] || 0);
      const b = Number(entry.match(/\\blue(\d+)/)?.[1] || 0);
      colors.push(`#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`);
    }
  }
  if (!colors.length) colors.push('#000000');
  const fonts = new Map<number, string>();
  const fontBlock = rtf.match(/\{\\fonttbl([\s\S]*?)\}/);
  if (fontBlock) {
    for (const m of fontBlock[1].matchAll(/\{\\f(\d+)[^;]*?([^;{}]+);/g)) {
      fonts.set(Number(m[1]), m[2].replace(/\\[a-z]+\d* ?/gi, '').trim() || 'Calibri');
    }
  }
  const styles = new Map<number, string>();
  const styleBlock = rtf.match(/\{\\stylesheet([\s\S]*?)\}/);
  if (styleBlock) {
    for (const m of styleBlock[1].matchAll(/\{\\s(\d+)([^{}]*)\}/g)) {
      const name = m[2].replace(/\\[a-z]+\d* ?/gi, ' ').replace(/[;{}]/g, ' ').replace(/\s+/g, ' ').trim();
      if (name) styles.set(Number(m[1]), name);
    }
  }
  return { colors, fonts, styles };
}

export function importRtf(buffer: Buffer): ConversionResult {
  const rtf = buffer.toString('latin1');
  const { colors, fonts, styles } = parseRtfTables(rtf);
  const warnings = new Set<string>();
  const base: RtfState = {
    bold: false, italic: false, underline: false, strike: false,
    font: fonts.get(0) || 'Calibri', size: 24, color: '', highlight: '',
    align: 'left', indentLeft: 0, indentRight: 0, firstLine: 0,
    spaceBefore: 0, spaceAfter: 0, lineHeight: 0,
    superscript: false, subscript: false, styleIndex: null, skip: false
  };
  let state: RtfState = { ...base };
  const stack: RtfState[] = [];
  const paragraphs: string[] = [];
  let bufferHtml = '';
  let maxSize = 24;
  let skipGroup = false;
  let groupSkipStack: boolean[] = [];
  let unicodeSkip = 0;
  let pendingHref = '';
  let skippingField = false;
  let i = 0;
  const skipDestinations = [
    'fonttbl', 'colortbl', 'stylesheet', 'info', 'pict', 'header', 'headerl', 'headerr', 'headerf',
    'footer', 'footerl', 'footerr', 'footerf', 'listtable', 'listoverridetable', 'rsidtbl',
    'generator', 'xmlnstbl', 'themedata', 'colorschememapping', 'datastore', 'latentstyles',
    'object', 'objdata', 'fldinst'
  ];

  const flush = () => {
    if (!bufferHtml.trim()) {
      bufferHtml = '';
      maxSize = 24;
      state.styleIndex = null;
      return;
    }
    const headingStyle = state.styleIndex != null ? (styles.get(state.styleIndex) || '').toLowerCase() : '';
    const hm = headingStyle.match(/heading\s*([1-6])/);
    const inferred = !hm && state.bold && maxSize >= 40 ? 2 : 0;
    const level = hm ? Number(hm[1]) : inferred;
    const css: string[] = [];
    if (state.align && state.align !== 'left') css.push(`text-align:${state.align}`);
    if (state.indentLeft) css.push(`margin-left:${state.indentLeft / 20}pt`);
    if (state.indentRight) css.push(`margin-right:${state.indentRight / 20}pt`);
    if (state.firstLine) css.push(`text-indent:${state.firstLine / 20}pt`);
    if (state.spaceBefore) css.push(`margin-top:${state.spaceBefore / 20}pt`);
    if (state.spaceAfter) css.push(`margin-bottom:${state.spaceAfter / 20}pt`);
    if (state.lineHeight) css.push(`line-height:${(state.lineHeight / 240).toFixed(2)}`);
    const style = css.length ? ` style="${css.join(';')}"` : '';
    const tag = level ? `h${Math.min(6, level)}` : 'p';
    paragraphs.push(`<${tag}${style}>${bufferHtml}</${tag}>`);
    bufferHtml = '';
    maxSize = 24;
    state.styleIndex = null;
  };

  const appendText = (text: string) => {
    if (!text || state.skip) return;
    const escaped = escapeHtml(text).replace(/  /g, ' &nbsp;');
    let wrapped = escaped;
    if (state.strike) wrapped = `<s>${wrapped}</s>`;
    if (state.underline) wrapped = `<u>${wrapped}</u>`;
    if (state.italic) wrapped = `<em>${wrapped}</em>`;
    if (state.bold) wrapped = `<strong>${wrapped}</strong>`;
    if (state.superscript) wrapped = `<sup>${wrapped}</sup>`;
    if (state.subscript) wrapped = `<sub>${wrapped}</sub>`;
    const css = rtStyle(state);
    if (css) wrapped = `<span${css}>${wrapped}</span>`;
    bufferHtml += wrapped;
  };

  while (i < rtf.length) {
    const ch = rtf[i];
    if (ch === '{') {
      stack.push({ ...state });
      groupSkipStack.push(skipGroup);
      i++;
      continue;
    }
    if (ch === '}') {
      const prev = stack.pop();
      if (prev) state = prev;
      skipGroup = groupSkipStack.pop() || false;
      i++;
      continue;
    }
    if (ch === '\\') {
      const next = rtf[i + 1];
      if (next === '\\' || next === '{' || next === '}') {
        appendText(next);
        i += 2;
        continue;
      }
      if (next === "'") {
        const hex = rtf.slice(i + 2, i + 4);
        const byte = parseInt(hex, 16);
        if (!Number.isNaN(byte)) appendText(decodeCp1252(byte));
        i += 4;
        continue;
      }
      if (next === '*') {
        skipGroup = true;
        i += 2;
        continue;
      }
      if (next === '~') { appendText('\u00a0'); i += 2; continue; }
      if (next === '_') { appendText('\u2011'); i += 2; continue; }
      if (next === '-') { i += 2; continue; }
      if (!/[a-zA-Z]/.test(next || '')) { i += 2; continue; }
      let j = i + 1;
      let word = '';
      while (j < rtf.length && /[a-zA-Z]/.test(rtf[j])) { word += rtf[j]; j++; }
      let param = '';
      if (rtf[j] === '-') { param += '-'; j++; }
      while (j < rtf.length && /\d/.test(rtf[j])) { param += rtf[j]; j++; }
      if (rtf[j] === ' ') j++;
      const n = param !== '' ? Number(param) : null;
      i = j;
      if (skipGroup) continue;
      if (skipDestinations.includes(word)) {
        skipGroup = true;
        continue;
      }
      switch (word) {
        case 'par': flush(); break;
        case 'pard': state.align = 'left'; state.indentLeft = 0; state.indentRight = 0; state.firstLine = 0; state.spaceBefore = 0; state.spaceAfter = 0; state.lineHeight = 0; break;
        case 'line': bufferHtml += '<br>'; break;
        case 'tab': appendText('\u2003'); break;
        case 'page': bufferHtml += '<div data-page-break="true"></div>'; flush(); break;
        case 'b': state.bold = n !== 0; break;
        case 'i': state.italic = n !== 0; break;
        case 'ul': case 'ulnone': state.underline = word === 'ul' && n !== 0; break;
        case 'strike': state.strike = n !== 0; break;
        case 'super': state.superscript = n !== 0; state.subscript = false; break;
        case 'sub': state.subscript = n !== 0; state.superscript = false; break;
        case 'nosupersub': state.superscript = false; state.subscript = false; break;
        case 'f': state.font = fonts.get(n || 0) || state.font; break;
        case 'fs': state.size = Math.max(8, n || 24); maxSize = Math.max(maxSize, state.size); break;
        case 'cf': state.color = n && n > 0 ? (colors[n] || '') : ''; break;
        case 'highlight': state.highlight = n && n > 0 ? (colors[n] || '') : ''; break;
        case 'cb': case 'chcbpat': state.highlight = n && n > 0 ? (colors[n] || '') : ''; break;
        case 'qc': state.align = 'center'; break;
        case 'qr': state.align = 'right'; break;
        case 'qj': state.align = 'justify'; break;
        case 'ql': state.align = 'left'; break;
        case 'li': state.indentLeft = n || 0; break;
        case 'ri': state.indentRight = n || 0; break;
        case 'fi': state.firstLine = n || 0; break;
        case 'sb': state.spaceBefore = n || 0; break;
        case 'sa': state.spaceAfter = n || 0; break;
        case 'sl': state.lineHeight = n && n > 0 ? n : 0; break;
        case 's': state.styleIndex = n; break;
        case 'u': {
          if (n != null) {
            appendText(String.fromCharCode(n < 0 ? n + 65536 : n));
            unicodeSkip = 1;
          }
          break;
        }
        case 'cell': appendText('  │  '); break;
        case 'row': flush(); break;
        case 'field':
          pendingHref = '';
          break;
        case 'fldrslt':
          skippingField = false;
          break;
        case 'emdash': appendText('—'); break;
        case 'endash': appendText('–'); break;
        case 'lquote': appendText('‘'); break;
        case 'rquote': appendText('’'); break;
        case 'ldblquote': appendText('“'); break;
        case 'rdblquote': appendText('”'); break;
        case 'bullet': appendText('•'); break;
        case 'pntext': case 'listtext': break;
        case 'bin': i += Math.max(0, n || 0); break;
        default: break;
      }
      continue;
    }
    if (ch === '\r' || ch === '\n') { i++; continue; }
    if (skipGroup) { i++; continue; }
    if (unicodeSkip > 0) { unicodeSkip--; i++; continue; }
    appendText(ch);
    i++;
  }
  flush();
  if (!paragraphs.length) paragraphs.push('<p></p>');
  if (colors.length > 1) warnings.add('Text colors were imported from the RTF color table.');
  warnings.add('Complex RTF tables, images, and layout may be simplified during import.');
  return { html: paragraphs.join(''), warnings: [...warnings] };
}

interface PMNode { type: string; attrs?: Record<string, any>; content?: PMNode[]; marks?: Array<{ type: string; attrs?: Record<string, any> }>; text?: string }

function rtfEscape(text: string): string {
  let out = '';
  for (const ch of text) {
    if (ch === '\\' || ch === '{' || ch === '}') out += `\\${ch}`;
    else if (ch === '\n') out += '\\line ';
    else if (ch === '\t') out += '\\tab ';
    else if (ch.charCodeAt(0) < 127) out += ch;
    else {
      const code = ch.codePointAt(0) || 63;
      out += `\\u${code > 32767 ? code - 65536 : code}?`;
    }
  }
  return out;
}

export function exportRtf(content: PMNode, title: string): { buffer: Buffer; warnings: string[] } {
  const warnings = new Set<string>();
  const parts: string[] = [];
  const footnotes: string[] = [];
  let footnoteIndex = 0;

  const runStyle = (marks: Array<{ type: string; attrs?: Record<string, any> }> = []): { prefix: string; suffix: string } => {
    let prefix = '';
    let suffix = '';
    for (const mark of marks) {
      if (mark.type === 'bold') { prefix += '\\b '; suffix = '\\b0 ' + suffix; }
      if (mark.type === 'italic') { prefix += '\\i '; suffix = '\\i0 ' + suffix; }
      if (mark.type === 'underline') { prefix += '\\ul '; suffix = '\\ulnone ' + suffix; }
      if (mark.type === 'strike') { prefix += '\\strike '; suffix = '\\strike0 ' + suffix; }
      if (mark.type === 'code') { prefix += '\\f2 '; suffix = '\\f0 ' + suffix; }
      if (mark.type === 'superscript') { prefix += '\\super '; suffix = '\\nosupersub ' + suffix; }
      if (mark.type === 'subscript') { prefix += '\\sub '; suffix = '\\nosupersub ' + suffix; }
      if (mark.type === 'textStyle') {
        const attrs = mark.attrs || {};
        if (attrs.fontSize) {
          const num = parseFloat(String(attrs.fontSize));
          if (Number.isFinite(num)) prefix += `\\fs${Math.round(num * 2)} `;
        }
      }
    }
    return { prefix, suffix };
  };

  const inline = (nodes: PMNode[], extra = ''): string => {
    let out = '';
    for (const node of nodes) {
      if (node.type === 'text') {
        const style = runStyle(node.marks);
        out += `${extra}${style.prefix}${rtfEscape(node.text || '')}${style.suffix}`;
      } else if (node.type === 'hardBreak') {
        out += '\\line ';
      } else if (node.type === 'footnote') {
        footnoteIndex++;
        const text = String(node.attrs?.text || '');
        footnotes.push(`${footnoteIndex}. ${rtfEscape(text)}`);
        out += `\\super [${footnoteIndex}]\\nosupersub `;
      } else if (node.type === 'equation') {
        out += `\\i ${rtfEscape(String(node.attrs?.latex || ''))}\\i0 `;
        warnings.add('Equations are exported to RTF as equation text.');
      } else if (node.type === 'image') {
        out += `[Image: ${rtfEscape(String(node.attrs?.alt || 'image'))}]`;
        warnings.add('Images are not embedded in RTF exports.');
      }
    }
    return out;
  };

  const block = (nodes: PMNode[], indent = 0, prefix = ''): void => {
    for (const node of nodes) {
      const indentCmd = indent ? `\\li${indent} ` : '';
      switch (node.type) {
        case 'paragraph':
          parts.push(`\\pard${indentCmd}${prefix}${inline(node.content || [])}\\par\n`);
          break;
        case 'heading': {
          const level = Math.max(1, Math.min(6, Number(node.attrs?.level) || 1));
          const sizes = [56, 44, 36, 30, 26, 24];
          parts.push(`\\pard${indentCmd}\\b\\fs${sizes[level - 1]} ${inline(node.content || [])}\\b0\\fs24\\par\n`);
          break;
        }
        case 'bulletList':
          for (const item of node.content || []) {
            const first = item.content?.[0];
            if (first?.type === 'paragraph') {
              const rest = item.content?.slice(1) || [];
              parts.push(`\\pard${indentCmd}•  ${inline(first.content || [])}\\par\n`);
              if (rest.length) block(rest, indent + 360);
            } else block(item.content || [], indent + 360);
          }
          break;
        case 'orderedList': {
          let index = 1;
          for (const item of node.content || []) {
            const first = item.content?.[0];
            if (first?.type === 'paragraph') {
              parts.push(`\\pard${indentCmd}${index}.  ${inline(first.content || [])}\\par\n`);
              const rest = item.content?.slice(1) || [];
              if (rest.length) block(rest, indent + 360);
            }
            index++;
          }
          break;
        }
        case 'taskList':
          for (const item of node.content || []) {
            const checked = Boolean(item.attrs?.checked);
            const first = item.content?.[0];
            if (first?.type === 'paragraph') {
              parts.push(`\\pard${indentCmd}${checked ? '☑' : '☐'}  ${inline(first.content || [])}\\par\n`);
            }
          }
          break;
        case 'blockquote':
          block(node.content || [], indent + 360);
          break;
        case 'codeBlock': {
          const text = (node.content || []).map((t) => t.text || '').join('');
          parts.push(`\\pard\\f2\\fs20 ${rtfEscape(text)}\\f0\\fs24\\par\n`);
          break;
        }
        case 'horizontalRule':
          parts.push('\\pard\\qc ────────────────────\\par\n');
          break;
        case 'pageBreak':
          parts.push('\\page\n');
          break;
        case 'table': {
          for (const row of node.content || []) {
            const cells = (row.content || []).map((cell) => (cell.content || []).map((child) => {
              if (child.type === 'paragraph') return inline(child.content || []);
              return '';
            }).join(' '));
            parts.push(`\\pard ${cells.join('  |  ')}\\par\n`);
          }
          warnings.add('Tables are exported to RTF as tab-separated text rows.');
          break;
        }
        case 'textbox': case 'callout':
          block(node.content || [], indent + 360);
          warnings.add('Text boxes are simplified in RTF exports.');
          break;
        case 'tableOfContents': {
          const headings: PMNode[] = [];
          const collect = (list: PMNode[]) => {
            for (const n of list) {
              if (n.type === 'heading') headings.push(n);
              if (n.content) collect(n.content);
            }
          };
          collect(content.content || []);
          for (const h of headings) {
            const level = Math.max(1, Math.min(6, Number(h.attrs?.level) || 1));
            parts.push(`\\pard\\li${(level - 1) * 360} ${inline(h.content || [])}\\par\n`);
          }
          warnings.add('The table of contents is exported to RTF as static text.');
          break;
        }
        case 'equation':
          parts.push(`\\pard\\qc\\i ${rtfEscape(String(node.attrs?.latex || ''))}\\i0\\par\n`);
          break;
        case 'image':
          parts.push(`\\pard [Image: ${rtfEscape(String(node.attrs?.alt || 'image'))}]\\par\n`);
          warnings.add('Images are not embedded in RTF exports.');
          break;
        default:
          if (node.content) block(node.content, indent);
      }
    }
  };

  block(content.content || []);
  if (footnotes.length) {
    parts.push('\\pard\\b Footnotes\\b0\\par\n');
    for (const note of footnotes) parts.push(`\\pard\\fs18 ${note}\\par\n`);
  }
  const header = `{\\rtf1\\ansi\\ansicpg1252\\deff0{\\fonttbl{\\f0\\froman ${rtfEscape('Georgia')};}{\\f1\\fswiss ${rtfEscape('Segoe UI')};}{\\f2\\fmodern Consolas;}}{\\info{\\title ${rtfEscape(title)}}}\\viewkind4\\uc1\\f0\\fs24 `;
  const body = header + parts.join('') + '}';
  return { buffer: Buffer.from(body, 'latin1'), warnings: [...warnings] };
}
