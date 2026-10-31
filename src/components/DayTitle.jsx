import { useEffect, useRef, useState } from 'react';

/**
 * 每天的名字：点一下就地变成输入框，回车保存，Esc 取消。
 * 不用开弹窗、不用跳页面。
 */
export default function DayTitle({ value, onSave, size = 'lg', placeholder = '给今天起个名字' }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');
  const inputRef = useRef(null);
  const savedRef = useRef(false);

  useEffect(() => {
    if (!editing) setDraft(value || '');
  }, [value, editing]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
      savedRef.current = false;
    }
  }, [editing]);

  const commit = () => {
    if (savedRef.current) return;
    savedRef.current = true;
    setEditing(false);
    const next = draft.trim();
    if (next !== (value || '')) onSave(next);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        className={`day-title-input ${size}`}
        value={draft}
        maxLength={24}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          }
          if (e.key === 'Escape') {
            savedRef.current = true;
            setDraft(value || '');
            setEditing(false);
          }
        }}
      />
    );
  }

  return (
    <button className={`day-title ${size}${value ? '' : ' empty'}`} onClick={() => setEditing(true)}>
      <span>{value || placeholder}</span>
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <path d="M4 20h4l10.5-10.5a2.1 2.1 0 00-3-3L5 17v3z" />
      </svg>
    </button>
  );
}
