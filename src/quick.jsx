import { useEffect, useRef, useState } from 'react';
import { api } from './api.js';

const TYPES = [
  { id: 'note', label: '灵感', hint: '想到什么就写什么，回车存进灵感库' },
  { id: 'todo', label: '待办', hint: '回车加进收件箱，之后可以补截止时间' },
  { id: 'money', label: '支出', hint: '写成「金额 备注」，比如 18 早餐' },
];

export default function Quick() {
  const [type, setType] = useState('note');
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current && inputRef.current.focus();
    if (window.linsssside.onQuickReset) {
      window.linsssside.onQuickReset(() => {
        setText('');
        setType('note');
        setError('');
        setFlash('');
        inputRef.current && inputRef.current.focus();
      });
    }
    const onKey = (e) => {
      if (e.key === 'Escape') window.linsssside.hideQuick();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const submit = async () => {
    const value = text.trim();
    if (!value || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await api.quickAdd(type, value);
      setText('');
      setFlash(res.kind === 'money' ? `已记一笔 ¥${res.amount}` : '已记录，Esc 关闭');
      setTimeout(() => window.linsssside.hideQuick(), 420);
    } catch (err) {
      setError(err.message || '没存上');
    } finally {
      setBusy(false);
    }
  };

  const active = TYPES.find((t) => t.id === type);

  return (
    <div className="quick">
      <div className="quick-top">
        <div className="quick-tabs">
          {TYPES.map((t) => (
            <button
              key={t.id}
              className={`quick-tab${type === t.id ? ' active' : ''}`}
              onClick={() => {
                setType(t.id);
                inputRef.current && inputRef.current.focus();
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <span className="quick-brand">Linsssside</span>
      </div>

      <input
        ref={inputRef}
        className="quick-input"
        value={text}
        placeholder={type === 'money' ? '18 早餐' : '写一句话…'}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            submit();
          }
          if (e.key === 'Tab') {
            e.preventDefault();
            const i = TYPES.findIndex((t) => t.id === type);
            setType(TYPES[(i + 1) % TYPES.length].id);
          }
        }}
      />

      <div className="quick-foot">
        <span className={`quick-hint${error ? ' error' : ''}`}>{error || flash || active.hint}</span>
        <span className="quick-keys">
          <kbd>Enter</kbd> 存 · <kbd>Tab</kbd> 换类型 · <kbd>Esc</kbd> 关
        </span>
      </div>
    </div>
  );
}
