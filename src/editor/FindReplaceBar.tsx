import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { ArrowDown, ArrowUp, Replace, ReplaceAll, Search, X } from 'lucide-react';
import { useT } from '../lib/utils';
import { searchPluginKey } from './extensions';
import { IconButton } from '../components/ui';

export function FindReplaceBar({ editor, open, onClose }: { editor: Editor; open: boolean; onClose: () => void }) {
  const t = useT();
  const [query, setQuery] = useState('');
  const [replacement, setReplacement] = useState('');
  const [showReplace, setShowReplace] = useState(false);
  const [version, setVersion] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  const plugin = searchPluginKey.getState(editor.state);
  const total = plugin?.matches.length || 0;
  const current = total ? (plugin?.index || 0) + 1 : 0;

  useEffect(() => {
    if (!open) return;
    const selection = editor.state.selection;
    if (!selection.empty) {
      const text = editor.state.doc.textBetween(selection.from, selection.to, ' ');
      if (text && text.length < 120) setQuery(text);
    }
    window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 40);
  }, [open, editor]);

  useEffect(() => {
    if (!open) return;
    const update = () => setVersion((value) => value + 1);
    editor.on('transaction', update);
    return () => { editor.off('transaction', update); };
  }, [open, editor]);

  useEffect(() => {
    if (!open) return;
    const current = searchPluginKey.getState(editor.state)?.query || '';
    if (current !== query) editor.commands.setSearch(query);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, query, editor]);

  useEffect(() => {
    if (open) return;
    setQuery('');
    setReplacement('');
    setShowReplace(false);
    editor.commands.clearSearch();
  }, [open, editor]);

  useEffect(() => {
    if (!total) return;
    const timer = window.setTimeout(() => {
      document.querySelector('.auren-search-match.is-current')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 30);
    return () => window.clearTimeout(timer);
  }, [total, current, version]);

  if (!open) return null;

  return (
    <div className="find-bar" data-version={version} onMouseDown={(event) => event.stopPropagation()}>
      <div className="find-bar-row">
        <Search size={14} className="find-icon" />
        <input
          ref={inputRef}
          className="find-input"
          value={query}
          placeholder={t('editor.findPlaceholder')}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              if (event.shiftKey) editor.commands.findPrevious();
              else editor.commands.findNext();
            }
          }}
        />
        <span className={`find-count ${total ? '' : 'is-empty'}`}>
          {query ? (total ? t('editor.matchCount', { current, total }) : t('editor.noResults')) : ''}
        </span>
        <button className="find-arrow" onClick={() => editor.commands.findPrevious()} disabled={!total} title="Previous match"><ArrowUp size={14} /></button>
        <button className="find-arrow" onClick={() => editor.commands.findNext()} disabled={!total} title="Next match"><ArrowDown size={14} /></button>
        <button className={`find-toggle ${showReplace ? 'is-active' : ''}`} onClick={() => setShowReplace((value) => !value)} title={t('editor.replace')}>
          <Replace size={14} />
        </button>
        <IconButton label={t('common.close')} onClick={onClose}><X size={14} /></IconButton>
      </div>
      {showReplace && (
        <div className="find-bar-row is-replace">
          <Replace size={14} className="find-icon" />
          <input
            className="find-input"
            value={replacement}
            placeholder={t('editor.replacePlaceholder')}
            onChange={(event) => setReplacement(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                editor.commands.replaceCurrentMatch(replacement);
              }
            }}
          />
          <button className="btn btn-ghost btn-sm" onClick={() => editor.commands.replaceCurrentMatch(replacement)} disabled={!total}>{t('editor.replace')}</button>
          <button className="btn btn-ghost btn-sm" onClick={() => editor.commands.replaceAllMatches(replacement)} disabled={!total}>
            <ReplaceAll size={12} /> {t('editor.replaceAll')}
          </button>
        </div>
      )}
    </div>
  );
}
