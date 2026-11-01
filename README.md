# AUREN

**Create without limits.**

AUREN is a premium, local-first Windows word processor for long-form writing, reports, essays, letters, and everyday documents. It combines a considered writing surface with real page layout, a private library, DOCX and PDF interchange, version history, and an optional bring-your-own-key AI assistant.

AUREN has no account, no cloud, no telemetry, and no automatic uploads. The application is fully usable offline.

> **Version 1.0.0** · Windows 10/11 x64 · Electron 44.10.0 · Chromium 152 · Node 24.22.1

---

## Contents

- [What is included](#what-is-included)
- [Install](#install)
- [First launch](#first-launch)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [Writing and layout](#writing-and-layout)
- [Library, versions, and recovery](#library-versions-and-recovery)
- [Import and export](#import-and-export)
- [Page setup and PDF export](#page-setup-and-pdf-export)
- [Optional AI assistant](#optional-ai-assistant)
- [Privacy and data](#privacy-and-data)
- [Encryption at rest](#encryption-at-rest)
- [Settings reference](#settings-reference)
- [Build from source](#build-from-source)
- [Tests](#tests)
- [Verification performed](#verification-performed)
- [Known limitations](#known-limitations)
- [Troubleshooting](#troubleshooting)
- [Deliverables](#deliverables)
- [License](#license)

---

## What is included

### A writing surface, not a web page

- Rich text with headings, paragraphs, bold, italic, underline, strikethrough, inline code, superscript, subscript, font family, font size, text color, highlight, and paragraph background.
- Alignment, line spacing, paragraph spacing, first-line indents, and left/right indents.
- Bullet lists, numbered lists, task lists, blockquotes, callouts, and horizontal rules.
- Links, images (drag, paste, or insert; resizable), tables (resizable, with header rows), page breaks, footnotes, captions, shapes, text boxes, equations, and a generated table of contents.
- Find and replace with match highlighting and keyboard navigation.
- Local spellcheck with bundled English and French Hunspell dictionaries, plus optional writing hints.
- Real page geometry: A4, A3, US Letter, US Legal, and custom sizes; portrait or landscape; four independent margins; one, two, or three columns.
- Headers and footers with `{{page}}`, `{{total}}` (or `{{pages}}`), and `{{title}}` tokens. Page numbering is optional.
- Pagination on a measured page surface, with page guides and a page deck. PDF export is the authoritative print layout.

### A private library

- Create, rename, duplicate, delete, restore, favorite, search, sort, and filter documents.
- Folders, color labels, workspaces, document previews, word counts, reading time, and library statistics.
- Autosave, crash-recovery drafts, and version history: manual labeled versions plus an automatic “Before restore” snapshot whenever you restore an earlier version.
- Built-in templates: project report, research paper, personal essay, cover letter, résumé, business proposal, meeting notes, case study, press release, daily journal, weekly planner, and book manuscript.
- Import and export DOCX, DOC, ODT, RTF, TXT, Markdown, HTML, PDF, and the lossless AUREN format.
- Backups as plain ZIP archives.

### A calm interface

- Three themes: **Midnight** (default), **Paper**, and **OLED**.
- English and French interface.
- Frameless custom title bar, collapsible sidebar, resizable right panel, command palette, focus mode, zen mode, outline, inspector, timeline, and AI panel.
- High-DPI-aware layout with an interface scale from 90% to 115%.
- Native Windows menus for text and document actions, plus a full keyboard workflow.

---

## Install

### Installer (recommended)

1. Run `release\Auren-Setup.exe`.
2. Choose an install location, or keep the per-user default.
3. Optionally create desktop and Start-menu shortcuts.
4. Launch **AUREN** from the shortcut or Start menu.

The installer is self-contained. It bundles the Electron/Chromium runtime, Node runtime, spellcheck dictionaries, fonts, and all application code. **Node.js, Rust, Python, Visual Studio, and WebView2 are not required.**

The build is **not code-signed**. Windows SmartScreen may show “Windows protected your PC.” Choose **More info → Run anyway** if you trust the source of the file. A code-signing certificate was not available for this build.

Uninstalling removes the application. It deliberately **does not delete your documents**; see [Privacy and data](#privacy-and-data).

### Portable

Run `release\Auren.exe` directly. It is a single-file portable launcher that extracts the application to a temporary folder at launch. No installation or administrator rights are required. The first launch can take a few seconds while the runtime extracts.

The portable build uses the same data folder as the installed build, so documents are shared between both.

### System requirements

- Windows 10 or Windows 11, 64-bit.
- A 64-bit x86 processor.
- Approximately 300 MB of free disk space for the installed application, plus space for your library.
- No internet connection is required for normal use.

---

## First launch

AUREN opens with a three-step onboarding flow:

1. **Welcome** — continue, import a document, or open a sample document.
2. **Atmosphere** — choose Midnight, Paper, or OLED.
3. **Ready** — enter the library, or open the sample document.

The sample document is a real, editable document that demonstrates headings, lists, quotes, and formatting. It is stored in your local library like any other document.

From the home screen you can create a blank document, import a file, open recent work, start from a template, or open a workspace. Press **Ctrl+K** at any time to reach every command.

---

## Keyboard shortcuts

| Action | Shortcut |
| --- | --- |
| Command palette | `Ctrl+K` |
| Save | `Ctrl+S` |
| Save a named version | `Ctrl+Shift+S` |
| New document | `Ctrl+N` |
| Import | `Ctrl+O` or `Ctrl+Shift+O` |
| Find and replace | `Ctrl+F` |
| Focus mode | `F8` |
| Zen mode | `F11` |
| Toggle sidebar | `Ctrl+\` |
| Toggle inspector | `Ctrl+Shift+I` |
| Settings | `Ctrl+,` |
| Close dialog, palette, or find bar | `Esc` |
| Bold / italic / underline | `Ctrl+B` / `Ctrl+I` / `Ctrl+U` |
| Heading levels | `Ctrl+Alt+1` … `Ctrl+Alt+6` |
| Undo / redo | `Ctrl+Z` / `Ctrl+Shift+Z` |

Standard text-editing shortcuts (`Ctrl+C`, `Ctrl+V`, `Ctrl+X`, `Ctrl+A`, arrow keys, `Home`, `End`, `Page Up`, `Page Down`) work as expected inside the editor.

---

## Writing and layout

### The editor

AUREN uses a TipTap/ProseMirror editing surface with a custom page model. The page is not a fixed text box: blocks flow across measured page boundaries, and the page deck gives a visual sense of the printed result. Complex floating objects and some Word-specific layout features are simplified; the PDF export is the definitive paginated output.

### Formatting

Use the toolbar, the command palette, or standard keyboard shortcuts. The toolbar groups are:

- **History** — undo, redo.
- **Style** — paragraph style, font family, font size, headings.
- **Format** — bold, italic, underline, strikethrough, code, superscript, subscript, color, highlight, background.
- **Align** — left, center, right, justify, line spacing, indents.
- **Lists** — bullets, numbers, tasks, blockquote, callout.
- **Insert** — link, image, table, page break, footnote, equation, table of contents, caption, text box, shape.

The bubble menu appears on text selection for quick inline formatting.

### Images

Drag an image into the editor, paste it from the clipboard, or use **Insert → Image**. Images are stored inline in the document and can be resized. AUREN accepts common web image formats; DOCX export embeds PNG, JPEG, GIF, and BMP images. Unsupported web formats produce an export warning rather than a silent failure.

### Tables

Insert a table, then add or remove rows and columns, toggle header rows, resize columns, and select cells or the whole table. Tables are exported as real Word tables in DOCX and as real tables in ODT. RTF export flattens tables to tab-separated text.

### Footnotes, captions, equations, and text boxes

- Footnotes are inserted as inline references and can be reopened for editing. DOCX export writes real Word footnotes; DOCX import places imported notes in a readable footnotes section at the end of the document.
- Captions are styled paragraphs with a figure/table kind.
- Equations are editable LaTeX-style expressions rendered with KaTeX. They export as editable equation text, not native Word math objects.
- Text boxes are styled block containers. DOCX export represents them as styled tables for compatibility; ODT and RTF flatten them.
- Shapes are decorative vector-like blocks rendered to PNG. DOCX export embeds the rendered shape; unsupported shapes produce a warning.

### Table of contents

Insert a generated table of contents from the current headings. It is a live AUREN block while editing. DOCX export preserves it as a static, readable contents block; ODT export writes static entries without page numbers; RTF export writes static text.

### Focus and zen

- **Focus mode** (`F8`) dims the surrounding interface and hides the side panel.
- **Zen mode** (`F11`) removes the sidebar, header, toolbar, and status bar, leaving the page and a small exit control.

Both modes are reversible without losing the document state.

---

## Library, versions, and recovery

### Documents

The library supports grid and list views, search, sorting by updated/created/title/opened time, favorites, trash with restore, folders, color labels, and workspaces. Each document has a title, excerpt, word count, character count, reading time, timestamps, page settings, and optional import source.

### Autosave and recovery

Autosave is enabled by default and writes after a short idle delay (1.2 seconds by default; configurable from 0.5 to 3 seconds). A recovery draft is also written while you type. If AUREN closes unexpectedly, the next launch offers recovery candidates.

A draft is not a substitute for a saved version. Use **Ctrl+S** to save and **Ctrl+Shift+S** to create a named version.

### Version history

Versions are stored per document. You create versions manually with a label (**Ctrl+Shift+S**). The timeline panel shows activity and versions, and you can restore a previous version. Before a restore, AUREN records an automatic “Before restore” version, so the restore itself is reversible.

### Backups

**Settings → Storage → Create backup** writes a ZIP archive containing documents, versions, drafts, templates, the SQLite index, and a small manifest. Store it anywhere. Backups are plain files; if library encryption is enabled, the document payloads inside the backup remain encrypted.

To restore a backup manually, close AUREN, extract the ZIP into a folder, and point **Settings → Storage → Change location** at that folder (or replace the contents of the current library folder while AUREN is closed). This manual restore path is documented but was not exercised as an automated test.

---

## Import and export

### Supported formats

| Format | Import | Export | Fidelity notes |
| --- | --- | --- | --- |
| **DOCX** | Yes | Yes | Primary interchange format. Headings, paragraphs, inline formatting, lists, links, tables, images, page size/orientation/margins, columns, headers, footers, page numbers, page breaks, and footnotes are mapped through a custom OOXML importer/exporter. Complex floating objects, fields, themes, and some section properties are simplified. |
| **DOC** | Yes | No | Legacy binary Word files are extracted as text with paragraph structure. Formatting, images, and tables are not preserved. Re-save as DOCX for full fidelity. |
| **ODT** | Yes | Yes | Headings, formatting, lists, tables, images, page geometry, headers/footers, and page-number fields. TOC exports as static entries without page numbers; text boxes flatten; equations export as text. |
| **RTF** | Yes | Yes | Text, basic character formatting, paragraphs, lists, and table rows flattened to text import. Export does not embed images, flattens tables to tab-separated rows, simplifies text boxes, and writes equations/TOC as text. |
| **TXT** | Yes | Yes | Plain text with paragraph structure. No formatting. |
| **Markdown** | Yes | Yes | CommonMark-style text, headings, lists, links, emphasis, blockquotes, code, and GFM tables. Markdown export is generated from the document HTML. |
| **HTML** | Yes | Yes | Sanitized import with inline formatting; external stylesheet rules are not imported. Export is a standalone HTML page with inline page CSS. Remote images are not downloaded for privacy. |
| **PDF** | Yes | Yes | PDF import extracts text only and preserves page breaks; layout, images, columns, and typography are not reconstructed. PDF export uses a hidden Chromium print window and is the authoritative paginated output. |
| **AUREN** | Yes | Yes | Lossless AUREN JSON document with content, HTML, page settings, title, and timestamps. Intended for AUREN-to-AUREN transfer. |

### DOCX import

The DOCX importer reads the OOXML package directly, including relationships, styles, numbering, tables, drawings, headers, footers, footnotes, and section properties. It reports fidelity warnings in the import preview. Remote images are not fetched; embedded images are preserved.

### DOCX export

The DOCX exporter builds a Word document from the editor content, including real Word tables, embedded images, headers, footers, page-number fields, columns, page size, margins, orientation, and footnotes. Word may reflow the document differently from AUREN because of font substitution, line-breaking, and Word’s own layout engine. In validation, a stress document rendered as 7 pages in Word and 11 pages in AUREN’s PDF; both outputs were valid, but they are not page-identical.

### PDF export

PDF export offers:

- All pages or a custom page range.
- Standard or high quality.
- Background on/off.
- Header and footer on/off.
- Page numbers on/off.
- Optional margin overrides.

The print pipeline inlines bundled fonts, renders at the selected page size, then validates the PDF with `pdf-lib`. A custom page range is trimmed only when the range mode is `custom`. Export warnings are shown in the UI rather than hidden.

---

## Page setup and PDF export

Open **Page setup** from the editor toolbar or the command palette.

- **Size:** A4 (210 × 297 mm), A3 (297 × 420 mm), US Letter (8.5 × 11 in), US Legal (8.5 × 14 in), or Custom.
- **Orientation:** portrait or landscape.
- **Margins:** top, right, bottom, left, in millimetres.
- **Columns:** 1, 2, or 3.
- **Page numbers:** on/off.
- **Header:** optional; supports `{{page}}` and `{{title}}`.
- **Footer:** optional; supports `{{page}}`, `{{total}}` (or `{{pages}}`), and `{{title}}`.

The page deck in the editor uses the same geometry and shows page boundaries. For exact print output, always use **Export → PDF** and inspect the result.

---

## Optional AI assistant

The AI assistant is **disabled by default**. AUREN is fully functional without it, and no AI code runs unless you enable it and ask a question.

### Setup

1. Open **Settings → AI**.
2. Enable the assistant.
3. Choose a provider:
   - **OpenAI** — default model `gpt-4o-mini`.
   - **Anthropic** — default model `claude-3-5-sonnet-latest`.
   - **Google Gemini** — default model `gemini-2.0-flash`.
   - **Custom (OpenAI-compatible)** — for a local or self-hosted endpoint, for example `http://localhost:11434/v1`.
4. Set the model identifier and, for custom endpoints, the base URL.
5. Save your API key. Keys are stored through Electron `safeStorage`, which uses Windows DPAPI; they are not written into `settings.json`.
6. Optionally test the connection.

### Document context and consent

The AI panel has a document-context checkbox. When it is off, only your prompt and conversation history are sent. When it is on, AUREN includes the current document text, truncated to 120,000 characters. If you have a text selection, the selection is used as context instead.

Before the first request that includes document text, AUREN shows a consent dialog with a preview of what will be sent. You can allow the request once or remember the choice. Consent is stored locally in settings.

### Network behaviour

AI requests go directly from the AUREN main process to the provider you configured. There is no AUREN proxy server. Provider privacy terms apply to text you explicitly send. The assistant is the only optional network feature; links you open in a browser are also external.

### Testing status

AI error paths, disabled-by-default behaviour, key storage, and the consent UI were tested. **Live generation against OpenAI, Anthropic, and Gemini was not tested with real provider keys in this environment.** Treat the first live connection as a configuration step and use the built-in connection test.

---

## Privacy and data

### Principles

- No AUREN account.
- No AUREN cloud.
- No telemetry, analytics, crash uploads, or usage pings.
- No automatic document upload.
- No remote image fetching during import.
- Local spellcheck with bundled dictionaries.
- Optional AI only when enabled and explicitly requested.
- Manual updates only; AUREN does not contact an update server.

### Where data lives

By default, on Windows:

| Data | Path |
| --- | --- |
| Library root | `%APPDATA%\Auren\library` |
| Documents | `%APPDATA%\Auren\library\docs\<id>.json` |
| Versions | `%APPDATA%\Auren\library\versions\<document-id>\*.json` |
| Recovery drafts | `%APPDATA%\Auren\library\drafts\<document-id>.json` |
| Templates | `%APPDATA%\Auren\library\templates\*.json` |
| Search index | `%APPDATA%\Auren\library\library.db` |
| Settings | `%APPDATA%\Auren\settings.json` |
| Encrypted secrets | `%APPDATA%\Auren\secrets.bin` |
| Window state | `%APPDATA%\Auren\window-state.json` |
| Logs | `%APPDATA%\Auren\logs` |

`%APPDATA%` is usually `C:\Users\<you>\AppData\Roaming`.

You can move the library from **Settings → Storage → Change location**. AUREN copies the library to the new location and leaves the old copy in place as a safety backup. The previous copy is not deleted automatically.

### Uninstall behaviour

The installer is configured with `deleteAppDataOnUninstall: false`. Uninstalling removes the application but leaves `%APPDATA%\Auren` intact. Delete that folder manually if you want to remove all documents, settings, versions, drafts, and keys.

### Exports and backups are outside the app’s protection

Exported files (DOCX, PDF, ODT, RTF, HTML, Markdown, TXT, AUREN) are ordinary files in the location you choose. They are not encrypted by AUREN. Backups are ZIP archives; if library encryption is enabled, their document payloads remain encrypted, but the archive itself is not password-protected.

---

## Encryption at rest

**Settings → Storage → Encrypt library at rest** enables optional content encryption.

- Document files, drafts, versions, and templates are sealed with **AES-256-GCM**.
- Each file uses a random initialization vector and an authentication tag.
- The 256-bit library key is random and is stored in `secrets.bin` protected by Windows DPAPI (`safeStorage`).
- The key is not a user passphrase. It is tied to the Windows account/profile that created it.
- The local SQLite search index keeps document titles and excerpts unencrypted so search and sorting remain fast. The full document content is encrypted.
- Turning encryption off decrypts the content files back to plain JSON.
- If the Windows profile, DPAPI keys, or `secrets.bin` are lost, encrypted documents **cannot be recovered**. Keep a backup of the library and, if possible, an unencrypted export of critical work.
- Encryption protects data at rest on disk. It does not protect a document while AUREN is open, and it does not encrypt files you export.

Encryption is optional and off by default.

---

## Settings reference

- **Appearance** — Midnight / Paper / OLED, interface scale (90–115%), reduced motion, theme previews.
- **Editor** — default font, default size, toolbar density, page guides, autosave and delay, word count, reading time.
- **Writing** — local spellcheck, English/French dictionaries, writing hints.
- **Documents** — default page size, default export format, library defaults.
- **Storage** — library path, change location, ZIP backup, library size, encryption at rest.
- **Privacy** — privacy summary, external-service status, welcome-screen reset.
- **AI** — provider, model, base URL, API key, connection test, system prompt, consent memory.
- **Shortcuts** — reference table.
- **Updates** — manual update policy; no update server.
- **About** — version, runtime versions, data path, licence and credits.

Settings are stored atomically in `%APPDATA%\Auren\settings.json`. Secrets are stored separately in `secrets.bin`.

---

## Build from source

### Prerequisites

- Windows 10/11 x64.
- **Node.js 24.x** (the build uses Node 24 APIs, including `node:sqlite`).
- npm.
- Internet access for the first `npm install` (to download Electron and build dependencies).

No Rust, Python, Visual Studio, or native module toolchain is required. The application uses Electron’s bundled Node runtime and pure-JavaScript/native-prebuilt dependencies.

### Commands

```powershell
cd D:\Opencode\auren
npm install
npm run dev          # Vite dev server + Electron
npm run typecheck    # TypeScript, no emit
npm run build        # renderer + main process
npm run dist:dir     # unpacked app in release\win-unpacked
npm run dist         # NSIS installer + portable executable
```

`npm run dist` produces:

- `release\Auren-Setup.exe` — NSIS installer.
- `release\Auren.exe` — portable launcher.

The build configuration lives in the `build` field of `package.json`. Runtime dependencies are deliberately limited to `dictionary-en`, `dictionary-fr`, `nspell`, `pdf-parse`, and `word-extractor`; renderer libraries are bundled by Vite and are development dependencies, which keeps the packaged `node_modules` small.

### Project layout

```
electron/            main process, preload, IPC, library, settings, AI, spellcheck
electron/formats/    DOCX, ODT, RTF, Markdown, HTML, legacy import, PDF printing
shared/              shared TypeScript types and preload API contract
src/                 React renderer, editor extensions, views, panels, styles
scripts/             build, test, visual QA, packaging checks
tests/run.mjs        npm test orchestration
build/               icon assets
release/             built installer, portable app, icon
qa-shots/            visual QA screenshots and rendered PDF pages
```

---

## Tests

The main test command builds the app, typechecks it, and runs the three primary suites:

```powershell
npm test
```

This runs, in order:

1. `npm run typecheck`
2. `npm run build`
3. `scripts/e2e.mjs` — backend and UI integration: rich document creation, DOCX/PDF/ODT/RTF/Markdown/HTML/TXT/AUREN export, import previews and re-import, library management, versions, drafts, workspaces, templates, statistics, spellcheck, AI error handling, settings, shortcuts.
4. `scripts/editor-ui.mjs` — rich editor interaction: spellcheck context menu, image, page break, footnote, TOC, text box, shape, caption, table, find/replace, focus/zen, page setup and columns, save, pagination, narrow layout, settings scale, themes, encryption.
5. `scripts/encryption-test.mjs` — AES-256-GCM round trip, plaintext absence on disk, disabled-encryption readability.

Additional checks:

```powershell
# Packaged win-unpacked build (run npm run dist:dir first)
node scripts/packaged-smoke.mjs

# Installed build
$env:AUREN_EXE = "C:\Path\To\Auren.exe"
node scripts/packaged-smoke.mjs

# Portable build: launch with CDP, then run the CDP check
release\Auren.exe --remote-debugging-port=9222
node scripts/portable-check.mjs
```

Tests use isolated temporary `AUREN_USER_DATA` and `AUREN_DATA_DIR` folders and do not touch your real library.

Visual QA screenshots live in `qa-shots/`. PDF rendering checks can be reproduced with `pypdfium2`; the project itself does not require Python at runtime.

---

## Verification performed

The delivered build was verified on Windows 11 x64 with the following results:

- **TypeScript:** `npx tsc --noEmit` passes.
- **End-to-end suite:** passes. The stress document exported to DOCX, PDF (11 A4 pages), ODT, RTF, Markdown, HTML, TXT, and AUREN; every export was previewed and re-imported. PDF page ranges, headers, footers, page numbers, library management, versions, drafts, workspaces, templates, statistics, spellcheck, AI error paths, settings, and shortcuts were exercised.
- **Editor UI suite:** passes. Spellcheck context menu, image insertion, page break, footnote, TOC, text box, shape, caption, table, find/replace, focus/zen, page setup and columns, save, pagination, 1000 px narrow layout, settings UI scale, all three themes, and encryption UI were exercised.
- **Encryption suite:** passes. Documents, drafts, versions, and templates round-trip through AES-256-GCM; ciphertext is present on disk when enabled; files remain readable when encryption is disabled again.
- **Packaged smoke test:** passes for both `release\win-unpacked\Auren.exe` and the silently installed copy. Startup, app info, local spellcheck, UI save, DOCX and PDF export/import, themes, settings persistence, and encryption were exercised.
- **Portable smoke test:** passes. The portable `release\Auren.exe` launches, serves the home screen, saves a document, spellchecks, and persists themes.
- **NSIS installer:** silent install to a temporary directory exited 0; the installed app passed the packaged smoke test; the uninstaller exited 0 and removed the install directory.
- **Microsoft Word validation:** the exported DOCX opened in Microsoft Word, reported 7 pages, 3,678 words, 19,694 characters, 2 tables, 2 images, 1 section, and 1 footnote; the header text was present; Word successfully exported it to PDF. AUREN’s own PDF of the same stress document was 11 pages. The difference is Word’s reflow, not a malformed file.
- **PDF visual check:** AUREN’s exported PDF was rendered and inspected. Page size is A4, margins are present, headers do not overlap the body, and page numbers/headers are visible.

---

## Known limitations

These are deliberate scope boundaries or honest fidelity limits, not hidden failures.

1. **Windows x64 only.** No macOS or Linux build is included.
2. **No code signing.** SmartScreen may warn on first launch.
3. **DOCX page counts can differ from AUREN.** Word substitutes fonts and applies its own layout. Complex floating objects, fields, themes, and some section properties are simplified during import/export.
4. **Equations are not native Word math.** They export as editable equation text. Text boxes become styled tables in DOCX and flatten in ODT/RTF. Shapes export as embedded images where possible; unsupported decorative shapes produce a warning.
5. **ODT/RTF are lower-fidelity than DOCX.** ODT exports a static TOC without page numbers and flattens text boxes. RTF import flattens table rows to text. RTF export does not embed images, flattens tables to tab-separated text, and writes equations/TOC as text.
6. **PDF and DOC imports are text-first.** PDF import extracts text and page breaks only. Legacy `.doc` import uses text extraction; formatting, images, and tables are not preserved.
7. **Editor pagination is a measured approximation.** It is designed for a faithful writing experience, but PDF export is the authoritative layout. Very complex floats, nested tables, or unusual fonts may paginate differently in Word or a browser.
8. **Spellcheck is English and French only.** The dictionaries are bundled; there is no downloadable dictionary store.
9. **Encryption is not passphrase-based.** It uses a random key protected by Windows DPAPI. A lost Windows profile or `secrets.bin` means encrypted documents cannot be recovered. Titles and excerpts remain in the local SQLite index.
10. **No collaboration, comments, or tracked changes.** AUREN is a single-user local editor.
11. **No automatic updates.** Updates are manual by design; AUREN does not contact an update server.
12. **AI live generation was not tested with real provider keys.** Error paths, consent, key storage, and disabled-by-default behaviour were tested. Use the connection test with your own key.
13. **Large-document stress testing is limited.** The automated stress document is roughly 3,700 words as counted by Word and 11 A4 pages in AUREN’s PDF. Multi-hundred-page manuscripts were not benchmarked.
14. **Backup restore is a documented manual procedure.** Backup creation is tested; automated restore is not.
15. **No native print dialog.** Use PDF export for printing.
16. **Remote images are intentionally not downloaded.** Importing HTML or DOCX with remote image references leaves them as references and reports a warning.

---

## Troubleshooting

### Windows SmartScreen blocks the installer

The build is unsigned. Choose **More info → Run anyway** after verifying the file source. Do not disable SmartScreen globally.

### The portable app takes several seconds to start

The portable launcher extracts the Electron runtime to a temporary folder on each launch. This is expected. The installed build starts faster.

### AUREN opens with a blank or recovery screen

If the previous session ended unexpectedly, AUREN may offer recovery drafts. Review the candidates, restore the one you want, and save it. If the library is damaged, close AUREN and inspect `%APPDATA%\Auren\library`; the JSON files are readable and the SQLite index can be rebuilt from them.

### My documents disappeared after uninstalling

Uninstalling does not delete `%APPDATA%\Auren`. Reinstall AUREN and your library should reappear. If you deleted that folder, restore from a ZIP backup or an exported file.

### “Windows secure storage is unavailable”

Electron `safeStorage` (DPAPI) is unavailable on this Windows profile. AI keys and the library encryption key cannot be stored safely. AUREN disables those features rather than storing secrets in plaintext.

### PDF export has different page breaks than the editor

The editor’s page deck is a measured approximation. PDF export is the authoritative layout. Adjust margins, font, or page size and re-export if exact pagination matters.

### Word shows a different page count

Word reflows text with its own font metrics and layout engine. This is normal for DOCX interchange. Use PDF when page-identical output is required.

### AI connection fails

Check the provider, model identifier, base URL, and API key. For custom endpoints, the base URL must be reachable from this computer. AUREN reports provider HTTP errors in the AI panel. No request is sent until you enable AI and ask a question.

---

## Deliverables

- `release\Auren-Setup.exe` — NSIS installer, approximately 127 MB.
- `release\Auren.exe` — portable executable, approximately 111 MB.
- `release\Auren.ico` — application icon.
- `README.md` — this document.
- Full source tree in the project directory.
- `qa-shots\` — visual QA screenshots and rendered PDF pages.
- `scripts\` and `tests\` — reproducible test and packaging checks.

The installer and portable executable are self-contained. No separate Node, Rust, Python, Visual Studio, or WebView2 installation is required.

### SHA-256 checksums

| Artifact | SHA-256 |
| --- | --- |
| `Auren-Setup.exe` | `B4C534A7EF068E9FEFE98B145184E8A9E9450C3924C4822C6B2033F69B055510` |
| `Auren.exe` | `8FE3130BD949CD3FFCB26A292A7C3806880EA8EE978E615B8C5BF1BD45B69F1C` |
| `Auren.ico` | `849244BFB7590C9E226043C910A8E065AE028A0ADD6FA7745A1C34F6B607EF3C` |

---

## License

AUREN is proprietary software. No license is granted for redistribution, resale, or derivative use; see [`LICENSE`](LICENSE). Third-party libraries retain their own licenses; see the dependency manifests and the notices included with Electron.
