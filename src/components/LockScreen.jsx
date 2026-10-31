import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { api } from '../api.js';

export default function LockScreen({ onUnlock }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current && inputRef.current.focus();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await api.authUnlock(password);
      onUnlock();
    } catch (err) {
      setError(err.message || '打不开');
      setPassword('');
      inputRef.current && inputRef.current.focus();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="lock-screen">
      <div className="orb orb-a" />
      <div className="orb orb-b" />
      <form className={`lock-card${error ? ' shake' : ''}`} onSubmit={submit}>
        <div className="lock-mark">L</div>
        <h1>Linsssside</h1>
        <p className="lock-sub">你的生活只存在这台电脑里</p>
        <div className="lock-input">
          <Icon name="lock" size={16} />
          <input
            ref={inputRef}
            type="password"
            value={password}
            placeholder="输入密码解锁"
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <div className="lock-error">{error}</div>}
        <button className="primary-btn full" type="submit" disabled={busy || !password}>
          {busy ? '检查中…' : '解锁'}
        </button>
      </form>
    </div>
  );
}
