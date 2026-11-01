import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { BrowserWindow, app, nativeImage } from 'electron';
import { PDFDocument } from 'pdf-lib';
import type { ExportPdfOptions, PageSettings } from '../../shared/types';
import { pageDimensionsMm } from '../../shared/types';
import { sanitizeHtmlBasic } from './markup';

interface PrintInput {
  title: string;
  html: string;
  pageSettings: PageSettings;
  options: ExportPdfOptions;
}

function mmToInch(mm: number) { return mm / 25.4; }

function escapeTemplate(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function pageTokenHtml(text: string, title: string): string {
  return escapeTemplate(text)
    .replace(/\{\{page\}\}/g, '<span class="pageNumber"></span>')
    .replace(/\{\{(?:pages|total)\}\}/g, '<span class="totalPages"></span>')
    .replace(/\{\{title\}\}/g, escapeTemplate(title));
}

function loadFontBase64(relative: string): string {
  try {
    const full = path.join(app.getAppPath(), 'node_modules', '@fontsource-variable', relative);
    return fs.readFileSync(full).toString('base64');
  } catch {
    return '';
  }
}

function fontFace(name: string, normal: string, italic: string): string {
  const n = normal ? loadFontBase64(normal) : '';
  const i = italic ? loadFontBase64(italic) : '';
  let css = '';
  if (n) css += `@font-face{font-family:'${name}';font-style:normal;font-weight:100 900;font-display:block;src:url(data:font/woff2;base64,${n}) format('woff2');}`;
  if (i) css += `@font-face{font-family:'${name}';font-style:italic;font-weight:100 900;font-display:block;src:url(data:font/woff2;base64,${i}) format('woff2');}`;
  return css;
}

function buildDocumentCss(): string {
  return `
${fontFace('Newsreader', 'newsreader/files/newsreader-latin-wght-normal.woff2', 'newsreader/files/newsreader-latin-wght-italic.woff2')}
${fontFace('Inter', 'inter/files/inter-latin-wght-normal.woff2', 'inter/files/inter-latin-wght-italic.woff2')}
${fontFace('JetBrains Mono', 'jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2', 'jetbrains-mono/files/jetbrains-mono-latin-wght-italic.woff2')}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #ffffff; }
body { -webkit-print-color-adjust: exact; print-color-adjust: exact; color: #232329; }
.document {
  font-family: 'Newsreader', Georgia, serif;
  font-size: 12pt;
  line-height: 1.64;
  color: #232329;
  overflow-wrap: break-word;
}
.document > *:first-child { margin-top: 0 !important; }
p { margin: 0.15em 0 0.72em; orphans: 3; widows: 3; }
h1, h2, h3, h4, h5, h6 {
  font-family: 'Inter', 'Segoe UI', sans-serif;
  color: #18181f;
  line-height: 1.18;
  break-after: avoid-page;
  page-break-after: avoid;
}
h1 { font-size: 26pt; font-weight: 650; letter-spacing: -.02em; margin: 1.1em 0 .45em; }
h2 { font-size: 20pt; font-weight: 650; letter-spacing: -.015em; margin: 1.05em 0 .4em; }
h3 { font-size: 16pt; font-weight: 650; margin: .95em 0 .35em; }
h4 { font-size: 13.5pt; font-weight: 650; margin: .85em 0 .3em; }
h5 { font-size: 12pt; font-weight: 700; margin: .8em 0 .25em; }
h6 { font-size: 10.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: #5e5e70; margin: .8em 0 .25em; }
strong { font-weight: 700; }
a { color: #5452c8; text-decoration: underline; text-underline-offset: 2px; }
ul, ol { padding-left: 1.55em; margin: .3em 0 .8em; }
li { margin: .18em 0; }
li > p { margin-bottom: .25em; }
ul[data-type="taskList"] { list-style: none; padding-left: 1.2em; }
ul[data-type="taskList"] li { display: flex; gap: 8px; align-items: flex-start; }
ul[data-type="taskList"] li > label { flex: 0 0 auto; margin-top: 2px; }
ul[data-type="taskList"] input { width: 12px; height: 12px; }
blockquote { margin: 1.1em 0; padding: .15em 0 .15em 1.1em; border-left: 3px solid #8b7cf6; color: #525266; font-style: italic; }
hr { border: 0; border-top: 1px solid #d8d6e2; margin: 1.6em 0; }
mark { background-color: #fff2a8; color: inherit; padding: 0 1px; }
img { max-width: 100%; height: auto; }
table { border-collapse: collapse; width: 100%; margin: 1em 0; font-size: .95em; }
th, td { border: 1px solid #d8d6e2; padding: 6px 8px; vertical-align: top; }
th { background: #f5f4fa; font-weight: 600; font-family: 'Inter', sans-serif; }
thead { display: table-header-group; }
tr { break-inside: avoid; page-break-inside: avoid; }
pre { background: #f4f3f8; border: 1px solid #e4e2ed; border-radius: 4px; padding: 10px 12px; font-family: 'JetBrains Mono', Consolas, monospace; font-size: 9.5pt; white-space: pre-wrap; }
code { font-family: 'JetBrains Mono', Consolas, monospace; font-size: .9em; background: #f4f3f8; padding: 1px 3px; border-radius: 3px; }
[data-auren-textbox="true"] { border: 1px solid #d9d4ff; background: #f8f6ff; border-radius: 6px; padding: 12px 16px; margin: 1.1em 0; }
[data-page-break="true"] { break-after: page; page-break-after: always; height: 0; margin: 0; }
footnote { vertical-align: super; font-size: .68em; color: #5452c8; font-family: 'Inter', sans-serif; }
.auren-toc { border-top: 1px solid #d8d6e2; border-bottom: 1px solid #d8d6e2; padding: 12px 0; margin: 1em 0 1.5em; }
.auren-toc a { color: #232329; text-decoration: none; }
.auren-toc div { font-size: .94em; margin: 2px 0; }
.auren-math { font-family: 'Cambria Math', 'Times New Roman', serif; }
.column-2 { column-count: 2; column-gap: 10mm; }
.column-3 { column-count: 3; column-gap: 8mm; }
`;
}

async function optimizeImages(html: string, quality: 'standard' | 'high', printBackground: boolean): Promise<string> {
  if (!printBackground) {
    // Remove data image backgrounds only when backgrounds are explicitly disabled.
    html = html.replace(/background-image\s*:\s*url\([^)]*\)/gi, 'background-image:none');
  }
  if (quality === 'high') return html;
  const maxWidth = 1180;
  const patterns = [...html.matchAll(/data:image\/(png|jpeg|jpg);base64,([A-Za-z0-9+/=\s]+)/g)];
  const unique = [...new Set(patterns.map((m) => m[0]))];
  for (const dataUrl of unique.slice(0, 60)) {
    try {
      const img = nativeImage.createFromDataURL(dataUrl);
      if (img.isEmpty()) continue;
      const size = img.getSize();
      if (size.width <= maxWidth) continue;
      const height = Math.max(1, Math.round(size.height * (maxWidth / size.width)));
      const resized = img.resize({ width: maxWidth, height, quality: 'good' });
      const isJpeg = /^data:image\/jpe?g/.test(dataUrl);
      const encoded = isJpeg ? resized.toJPEG(82) : resized.toPNG();
      const replacement = `data:image/${isJpeg ? 'jpeg' : 'png'};base64,${encoded.toString('base64')}`;
      html = html.split(dataUrl).join(replacement);
    } catch {
      // keep original image
    }
  }
  return html;
}

function headerFooterTemplates(page: PageSettings, options: ExportPdfOptions, title: string) {
  const includeHeaderFooter = options.includeHeaderFooter;
  const showHeader = includeHeaderFooter && page.headerEnabled && page.header.trim();
  const showFooter = includeHeaderFooter && page.footerEnabled && page.footer.trim();
  const showPageNumber = options.includePageNumbers && page.pageNumbering;
  if (!showHeader && !showFooter && !showPageNumber) return { display: false, header: '', footer: '' };
  const base = "font-family:'Segoe UI',Arial,sans-serif;font-size:8px;color:#83838f;width:100%;padding:0 0.08in;";
  const header = showHeader
    ? `<div style="${base}display:flex;justify-content:space-between;align-items:center;"><span>${pageTokenHtml(page.header, title)}</span><span style="color:#a2a2ad;">AUREN</span></div>`
    : '<div></div>';
  const footerParts: string[] = [];
  if (showFooter) footerParts.push(`<span>${pageTokenHtml(page.footer, title)}</span>`);
  if (showPageNumber) footerParts.push('<span><span class="pageNumber"></span> / <span class="totalPages"></span></span>');
  const footer = `<div style="${base}display:flex;justify-content:${showFooter ? 'space-between' : 'center'};align-items:center;">${footerParts.join('')}</div>`;
  return { display: true, header, footer };
}

export async function exportPdf(input: PrintInput): Promise<{ buffer: Buffer; warnings: string[]; pages: number }> {
  const warnings = new Set<string>();
  const page = input.pageSettings;
  const dims = pageDimensionsMm(page);
  const margins = input.options.margins || {
    top: page.marginTop, right: page.marginRight, bottom: page.marginBottom, left: page.marginLeft
  };
  const landscape = page.orientation === 'landscape';
  const contentWidth = dims.width - margins.left - margins.right;

  let html = sanitizeHtmlBasic(input.html);
  if (!html.trim()) html = '<p></p>';
  html = await optimizeImages(html, input.options.quality, input.options.includeBackground);
  const hf = headerFooterTemplates(page, input.options, input.title);

  const documentCss = buildDocumentCss();
  const wrapperClass = page.columns > 1 ? `document column-${Math.min(3, page.columns)}` : 'document';
  const printHtml = `<!doctype html>
<html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:;">
<title>${escapeTemplate(input.title)}</title>
<style>
${documentCss}
@page { size: ${landscape ? Math.max(dims.width, dims.height) : Math.min(dims.width, dims.height)}mm ${landscape ? Math.min(dims.width, dims.height) : Math.max(dims.width, dims.height)}mm; }
html, body { width: 100%; }
.document { width: ${contentWidth}mm; }
</style></head>
<body><main class="${wrapperClass}">${html}</main></body></html>`;

  const tmp = path.join(os.tmpdir(), `auren-print-${process.pid}-${Date.now()}.html`);
  fs.writeFileSync(tmp, printHtml, 'utf8');
  const window = new BrowserWindow({
    show: false,
    width: 1000,
    height: 1400,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  });
  try {
    await window.loadFile(tmp);
    try {
      await window.webContents.executeJavaScript('document.fonts.ready.then(() => Promise.all(Array.from(document.images).map(i => i.complete ? true : new Promise(r => { i.onload = r; i.onerror = r; })))).then(() => true)', true);
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
    const pageSize = {
      width: mmToInch(Math.min(dims.width, dims.height)),
      height: mmToInch(Math.max(dims.width, dims.height))
    };
    const pageRanges = input.options.range === 'custom' && input.options.toPage >= input.options.fromPage
      ? `${Math.max(1, input.options.fromPage)}-${Math.max(1, input.options.toPage)}`
      : '';
    const pdf = await window.webContents.printToPDF({
      printBackground: input.options.includeBackground,
      displayHeaderFooter: hf.display,
      headerTemplate: hf.header,
      footerTemplate: hf.footer,
      margins: {
        top: mmToInch(margins.top),
        bottom: mmToInch(margins.bottom),
        left: mmToInch(margins.left),
        right: mmToInch(margins.right)
      },
      pageSize,
      landscape,
      pageRanges,
      scale: 1,
      generateTaggedPDF: true,
      generateDocumentOutline: true,
      preferCSSPageSize: false
    });

    let output = pdf;
    let count = 0;
    try {
      const source = await PDFDocument.load(pdf);
      count = source.getPageCount();
      if (input.options.range === 'custom') {
        const from = Math.max(1, Math.min(count, input.options.fromPage));
        const to = Math.max(from, Math.min(count, input.options.toPage));
        if (!(from === 1 && to === count)) {
          const selected = await PDFDocument.create();
          const indices = Array.from({ length: to - from + 1 }, (_, i) => from - 1 + i);
          const pages = await selected.copyPages(source, indices);
          pages.forEach((p) => selected.addPage(p));
          selected.setTitle(input.title);
          selected.setCreator('AUREN — Create without limits.');
          selected.setProducer('AUREN 1.0');
          output = Buffer.from(await selected.save());
          count = selected.getPageCount();
        }
      }
    } catch {
      warnings.add('PDF page count could not be verified.');
    }
    if (count === 0) warnings.add('The PDF contains no pages.');
    if (input.options.quality === 'standard') warnings.add('Standard quality downsampled large images to reduce file size. Choose High for maximum fidelity.');
    return { buffer: Buffer.from(output), warnings: [...warnings], pages: count };
  } finally {
    window.destroy();
    try { fs.unlinkSync(tmp); } catch { /* ignore */ }
  }
}
