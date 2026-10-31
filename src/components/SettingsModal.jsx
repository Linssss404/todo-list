import { useEffect, useState } from 'react';
import Icon from './Icon.jsx';
import { api } from '../api.js';

export default function SettingsModal({ onClose, theme, onTheme, onToast }) {
  const [info, setInfo] = useState(null);
  const [authEnabled, setAuthEnabled] = useState(false);
  const [mode, setMode] = useState('idle'); // idle | enable | change | disable
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [exported, setExported] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.appInfo().then(setInfo);
    api.authStatus().then((s) => setAuthEnabled(!!s.enabled));
  }, []);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const run = async (fn, okText) => {
    setBusy(true);
    try {
      await fn();
      if (okText) onToast(okText);
      setMode('idle');
      setCurrent('');
      setNext('');
    } catch (err) {
      onToast(err.message || '没成功', 'error');
    } finally {
      setBusy(false);
    }
  };

  const doExport = async () => {
    setBusy(true);
    try {
      const res = await api.exportAll();
      setExported(res);
      onToast('已经导出到 data/exports');
    } catch (err) {
      onToast(err.message || '导出失败', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="settings" onClick={(e) => e.stopPropagation()}>
        <header className="settings-head">
          <h2>设置</h2>
          <button className="icon-btn" onClick={onClose}>
            <Icon name="x" size={18} />
          </button>
        </header>

        <section className="settings-block">
          <h3>外观</h3>
          <div className="theme-picker">
            {[
              { id: 'light', label: '浅色', bg: '#F5F2FF', fg: '#211A33' },
              { id: 'dark', label: '深色', bg: '#14101F', fg: '#EFEBFA' },
            ].map((t) => (
              <button
                key={t.id}
                className={`theme-card${theme === t.id ? ' active' : ''}`}
                onClick={() => onTheme(t.id)}
              >
                <span className="theme-preview" style={{ background: t.bg, color: t.fg }}>
                  <span className="tp-bar" />
                  <span className="tp-line" />
                  <span className="tp-line short" />
                </span>
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="settings-block">
          <h3>密码锁</h3>
          {authEnabled ? (
            <div className="stack">
              <p className="muted">每次启动需要输入密码。密码忘了可以删掉 data 下的 config 重置。</p>
              {mode === 'idle' && (
                <div className="row-actions">
                  <button className="ghost-btn" onClick={() => setMode('change')}>修改密码</button>
                  <button className="ghost-btn danger" onClick={() => setMode('disable')}>关闭密码锁</button>
                </div>
              )}
              {mode === 'change' && (
                <div className="stack">
                  <input className="text-input" type="password" placeholder="当前密码" value={current} onChange={(e) => setCurrent(e.target.value)} />
                  <input className="text-input" type="password" placeholder="新密码" value={next} onChange={(e) => setNext(e.target.value)} />
                  <div className="row-actions">
                    <button className="primary-btn" disabled={busy || !current || !next} onClick={() => run(() => api.authChange(current, next), '密码已更新')}>保存</button>
                    <button className="ghost-btn" onClick={() => setMode('idle')}>取消</button>
                  </div>
                </div>
              )}
              {mode === 'disable' && (
                <div className="stack">
                  <input className="text-input" type="password" placeholder="当前密码" value={current} onChange={(e) => setCurrent(e.target.value)} />
                  <div className="row-actions">
                    <button
                      className="primary-btn danger"
                      disabled={busy || !current}
                      onClick={() => run(async () => {
                        await api.authDisable(current);
                        setAuthEnabled(false);
                      }, '密码锁已关闭')}
                    >
                      确认关闭
                    </button>
                    <button className="ghost-btn" onClick={() => setMode('idle')}>取消</button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="stack">
              <p className="muted">加一道简单的门：启动时输一次密码。数据本身不加密。</p>
              {mode === 'enable' ? (
                <div className="stack">
                  <input className="text-input" type="password" placeholder="设一个密码" value={next} onChange={(e) => setNext(e.target.value)} autoFocus />
                  <div className="row-actions">
                    <button
                      className="primary-btn"
                      disabled={busy || next.length < 1}
                      onClick={() => run(async () => {
                        await api.authSetup(next);
                        setAuthEnabled(true);
                      }, '密码锁已开启')}
                    >
                      开启
                    </button>
                    <button className="ghost-btn" onClick={() => setMode('idle')}>取消</button>
                  </div>
                </div>
              ) : (
                <button className="ghost-btn" onClick={() => setMode('enable')}>设置密码</button>
              )}
            </div>
          )}
        </section>

        <section className="settings-block">
          <h3>数据</h3>
          <p className="muted mono path">{info ? info.dbPath : '读取中…'}</p>
          <div className="row-actions">
            <button className="ghost-btn" onClick={() => api.openDataDir()}>
              <Icon name="folder" size={15} /> 打开数据文件夹
            </button>
            <button className="ghost-btn" onClick={doExport} disabled={busy}>
              <Icon name="arrow" size={15} /> 一键导出
            </button>
          </div>
          {exported && (
            <button className="export-result" onClick={() => api.reveal(exported.dir)}>
              已导出 {exported.files.length} 个文件 · 点这里打开
            </button>
          )}
        </section>

        <section className="settings-block">
          <h3>提醒</h3>
          <p className="muted">窗口关掉后会收进托盘，到点照样弹系统通知。全天待办不弹通知，避免半夜打扰。</p>
          <p className="muted">
            随手记：任意软件里按 <kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>Space</kbd>，写一句话回车就能存成灵感、待办或支出。
          </p>
          <button
            className="ghost-btn"
            onClick={async () => {
              await window.linsssside.notifyTest();
              onToast('已发送一条测试通知');
            }}
          >
            发一条测试通知
          </button>
        </section>

        <footer className="settings-foot">
          <span>Linsssside {info ? `v${info.version}` : ''}</span>
          <span>数据只保存在本机</span>
        </footer>
      </div>
    </div>
  );
}
