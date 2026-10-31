import { useCallback, useEffect, useState } from 'react';
import TopNav from './components/TopNav.jsx';
import LockScreen from './components/LockScreen.jsx';
import SearchPalette from './components/SearchPalette.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Todos from './pages/Todos.jsx';
import ComingSoon from './pages/ComingSoon.jsx';
import { api } from './api.js';
import { dateCN, todayStr } from './lib/dates.js';

export default function App() {
  const [phase, setPhase] = useState('boot'); // boot | locked | ready
  const [theme, setTheme] = useState('light');
  const [view, setView] = useState('home');
  const [lists, setLists] = useState([]);
  const [dayLabel, setDayLabel] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [focusTodoId, setFocusTodoId] = useState(null);

  const today = todayStr();

  const showToast = useCallback((message, tone = 'ok') => {
    const id = Date.now();
    setToast({ id, message, tone });
    setTimeout(() => {
      setToast((prev) => (prev && prev.id === id ? null : prev));
    }, 2600);
  }, []);

  const loadLists = useCallback(async () => {
    setLists(await api.lists());
  }, []);

  useEffect(() => {
    (async () => {
      const status = await api.authStatus();
      if (status.enabled && !status.unlocked) {
        setPhase('locked');
        return;
      }
      setPhase('ready');
    })();
  }, []);

  useEffect(() => {
    if (phase !== 'ready') return;
    (async () => {
      const [settings, day] = await Promise.all([api.settings(), api.dayGet(today)]);
      setTheme(settings.theme === 'dark' ? 'dark' : 'light');
      setDayLabel(day ? day.label : '');
      await loadLists();
    })();
  }, [phase, today, loadLists]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!window.linsssside.onFocus) return;
    window.linsssside.onFocus(({ kind, id }) => {
      if (kind === 'todo') {
        setView('todos');
        setFocusTodoId(id);
      }
    });
  }, []);

  const changeTheme = async (next) => {
    setTheme(next);
    await api.setSetting('theme', next);
  };

  const saveDayLabel = async (label) => {
    setDayLabel(label);
    await api.daySet(today, label);
    if (label) showToast(`今天叫「${label}」`);
    else showToast('已经去掉今天的名字');
  };

  const openTodo = (todo) => {
    setFocusTodoId(todo.id);
    setView('todos');
  };

  if (phase === 'boot') {
    return <div className="boot" />;
  }

  if (phase === 'locked') {
    return <LockScreen onUnlock={() => setPhase('ready')} />;
  }

  return (
    <div className="app">
      <TopNav
        view={view}
        onChange={setView}
        theme={theme}
        onToggleTheme={() => changeTheme(theme === 'dark' ? 'light' : 'dark')}
        onOpenSearch={() => setSearchOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <main className="content">
        {view === 'home' && (
          <Dashboard
            dayLabel={dayLabel}
            onDayLabel={saveDayLabel}
            onOpenTodo={openTodo}
            onNavigate={setView}
          />
        )}

        {view === 'todos' && (
          <Todos
            lists={lists}
            refreshLists={loadLists}
            dayLabel={dayLabel}
            onDayLabel={saveDayLabel}
            focusTodoId={focusTodoId}
            onFocusConsumed={() => setFocusTodoId(null)}
          />
        )}

        {view === 'money' && <ComingSoon module="money" />}
        {view === 'calendar' && <ComingSoon module="calendar" />}
        {view === 'notes' && <ComingSoon module="notes" />}
      </main>

      {searchOpen && (
        <SearchPalette
          onClose={() => setSearchOpen(false)}
          onPickTodo={(id) => {
            setView('todos');
            setFocusTodoId(id);
          }}
          onPickDay={(date) => {
            setView('home');
            showToast(date === today ? '今天就在首页' : `${dateCN(date)} 这一天`);
          }}
        />
      )}

      {settingsOpen && (
        <SettingsModal
          onClose={() => setSettingsOpen(false)}
          theme={theme}
          onTheme={changeTheme}
          onToast={showToast}
        />
      )}

      {toast && <div className={`toast ${toast.tone}`}>{toast.message}</div>}
    </div>
  );
}
