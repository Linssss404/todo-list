import Icon from './Icon.jsx';

const TABS = [
  { id: 'home', label: '仪表盘', icon: 'home' },
  { id: 'todos', label: '待办', icon: 'check' },
  { id: 'money', label: '记账', icon: 'wallet' },
  { id: 'calendar', label: '日程', icon: 'calendar' },
  { id: 'notes', label: '灵感', icon: 'sparkles' },
];

export default function TopNav({ view, onChange, theme, onToggleTheme, onOpenSearch, onOpenSettings }) {
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark">L</span>
        <span className="brand-text">
          <strong>Linsssside</strong>
          <em>个人生活助手</em>
        </span>
      </div>

      <nav className="tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`tab${view === tab.id ? ' active' : ''}`}
            onClick={() => onChange(tab.id)}
          >
            <Icon name={tab.icon} size={16} />
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>

      <div className="top-actions">
        <button className="search-btn" onClick={onOpenSearch} title="全局搜索">
          <Icon name="search" size={16} />
          <span>搜索</span>
          <kbd>Ctrl K</kbd>
        </button>
        <button className="icon-btn" onClick={onToggleTheme} title={theme === 'dark' ? '切到浅色' : '切到深色'}>
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
        </button>
        <button className="icon-btn" onClick={onOpenSettings} title="设置">
          <Icon name="gear" size={18} />
        </button>
      </div>
    </header>
  );
}
