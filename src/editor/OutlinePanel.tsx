import { useEffect, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { ListTree } from 'lucide-react';
import { useT } from '../lib/utils';

interface OutlineItem { level: number; text: string; pos: number }

export function OutlinePanel({ editor }: { editor: Editor }) {
  const t = useT();
  const [items, setItems] = useState<OutlineItem[]>([]);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const update = () => {
      const next: OutlineItem[] = [];
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'heading') {
          const text = node.textContent.trim();
          if (text) next.push({ level: Number(node.attrs.level) || 1, text, pos });
        }
        return true;
      });
      setItems(next);
      const cursor = editor.state.selection.from;
      let nearest: number | null = null;
      next.forEach((item) => { if (item.pos < cursor) nearest = item.pos; });
      setActive(nearest);
    };
    update();
    editor.on('transaction', update);
    return () => { editor.off('transaction', update); };
  }, [editor]);

  return (
    <div className="panel-body outline-panel">
      {items.length === 0 ? (
        <div className="panel-empty">
          <ListTree size={22} />
          <p>{t('editor.outlineEmpty')}</p>
        </div>
      ) : (
        <div className="outline-list">
          {items.map((item, index) => (
            <button
              key={`${item.pos}-${index}`}
              type="button"
              className={`outline-item level-${Math.min(4, item.level)} ${active === item.pos ? 'is-active' : ''}`}
              onClick={() => editor.chain().focus().setTextSelection(Math.min(editor.state.doc.content.size, item.pos + 1)).scrollIntoView().run()}
            >
              <span className="outline-level">{item.level}</span>
              <span className="outline-text">{item.text}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
