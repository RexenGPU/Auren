import type { ConversionResult } from './markup';
import { plainTextToHtml, htmlToPlainText } from './markup';

export async function importDoc(buffer: Buffer): Promise<ConversionResult> {
  const WordExtractor = require('word-extractor') as typeof import('word-extractor');
  const extractor = new WordExtractor();
  const doc = await extractor.extract(buffer);
  const body = doc.getBody() || '';
  const html = plainTextToHtml(body);
  return {
    html,
    warnings: [
      'Legacy .doc files are imported as text with paragraph structure. Formatting, images, and tables from the binary Word format are not preserved.',
      'Re-save the original as .docx for full AUREN import fidelity.'
    ]
  };
}

export async function importPdf(buffer: Buffer): Promise<ConversionResult> {
  const { PDFParse } = require('pdf-parse') as typeof import('pdf-parse');
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    const pages = result.pages?.map((p: { text: string }) => p.text) || [result.text || ''];
    const html = pages.map((text, index) => {
      const content = plainTextToHtml(text);
      return `${index > 0 ? '<div data-page-break="true"></div>' : ''}${content}`;
    }).join('');
    return {
      html: html || '<p></p>',
      warnings: [
        'PDF import extracts text only. Original PDF layout, images, columns, and typography are not reconstructed.',
        `Imported ${pages.length} PDF page${pages.length === 1 ? '' : 's'} with page breaks preserved.`
      ]
    };
  } finally {
    try { await parser.destroy(); } catch { /* ignore */ }
  }
}

export function textFromPdfForDiagnostics(buffer: Buffer): string {
  return htmlToPlainText(buffer.toString('latin1'));
}
