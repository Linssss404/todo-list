import { useEffect, useMemo, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { api } from '../api.js';
import { currentMonth, monthDay, monthLabel, parseYuan, shiftMonth, yuan, yuanShort } from '../lib/money.js';

/* ---------------- 小图：环形占比 ---------------- */
function Donut({ data, total, size = 132 }) {
  const r = 50;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const safeTotal = total || 1;
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" className="donut">
      <circle cx="60" cy="60" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="13" />
      {data.map((item) => {
        const frac = item.totalCents / safeTotal;
        const dash = Math.max(0, frac * c - 2);
        const el = (
          <circle
            key={item.id}
            cx="60"
            cy="60"
            r={r}
            fill="none"
            stroke={item.color}
            strokeWidth="13"
            strokeDasharray={`${dash} ${c - dash}`}
            strokeDashoffset={-offset}
            strokeLinecap="round"
            transform="rotate(-90 60 60)"
          />
        );
        offset += frac * c;
        return el;
      })}
      <text x="60" y="57" textAnchor="middle" className="donut-value">
        ¥{yuanShort(total)}
      </text>
      <text x="60" y="73" textAnchor="middle" className="donut-cap">
        本月支出
      </text>
    </svg>
  );
}

/* ---------------- 小图：近 6 个月柱状 ---------------- */
function Trend({ data }) {
  const max = Math.max(1, ...data.map((d) => Math.max(d.expenseCents, d.incomeCents)));
  return (
    <div className="trend">
      {data.map((d) => {
        const expenseH = Math.max(2, (d.expenseCents / max) * 100);
        const incomeH = Math.max(2, (d.incomeCents / max) * 100);
        return (
          <div className="trend-col" key={d.month} title={`${d.month} 支出 ¥${yuan(d.expenseCents)}`}>
            <div className="trend-bars">
              <span className="bar income" style={{ height: `${incomeH}%` }} />
              <span className="bar expense" style={{ height: `${expenseH}%` }} />
            </div>
            <span className="trend-label">{Number(d.month.slice(5))}月</span>
          </div>
        );
      })}
    </div>
  );
}

export default function Money({ onToast }) {
  const [month, setMonth] = useState(currentMonth());
  const [kind, setKind] = useState('');
  const [categoryId, setCategoryId] = useState(null);
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({ kind: 'expense', amount: '', categoryId: '', note: '', date: '' });
  const [editing, setEditing] = useState(null);
  const [managing, setManaging] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState('');

  const today = new Date().toISOString().slice(0, 10);

  const load = async () => {
    const [list, sum, cats] = await Promise.all([
      api.txns({ month, kind: kind || null, categoryId }),
      api.moneySummary(month),
      api.moneyCategories(),
    ]);
    setRows(list);
    setSummary(sum);
    setCategories(cats);
    if (!budgetDraft && sum.budgetCents) setBudgetDraft(String(sum.budgetCents / 100));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, kind, categoryId]);

  const expenseCats = categories.filter((c) => c.kind === 'expense');
  const incomeCats = categories.filter((c) => c.kind === 'income');

  const grouped = useMemo(() => {
    const map = new Map();
    for (const row of rows) {
      if (!map.has(row.occurredOn)) map.set(row.occurredOn, []);
      map.get(row.occurredOn).push(row);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [rows]);

  const add = async () => {
    const cents = parseYuan(form.amount);
    if (!cents) {
      onToast && onToast('金额还没填', 'error');
      return;
    }
    await api.createTxn({
      kind: form.kind,
      amountCents: cents,
      categoryId: form.categoryId ? Number(form.categoryId) : null,
      occurredOn: form.date || today,
      note: form.note,
    });
    setForm((prev) => ({ ...prev, amount: '', note: '' }));
    await load();
    onToast && onToast('记下了');
  };

  const saveBudget = async () => {
    await api.setBudget(Number(budgetDraft) || 0);
    await load();
    onToast && onToast('预算已更新');
  };

  const budgetPct = summary && summary.budgetCents ? Math.min(100, (summary.expenseCents / summary.budgetCents) * 100) : 0;
  const over = summary && summary.budgetCents ? summary.expenseCents - summary.budgetCents : 0;

  return (
    <div className="page money-page">
      <section className="card panel money-summary">
        <div className="stat">
          <span className="stat-label">本月支出</span>
          <strong className="stat-value">¥{yuan(summary ? summary.expenseCents : 0)}</strong>
          <span className="stat-sub">
            {summary ? summary.count : 0} 笔 · 今天 ¥{yuan(summary ? summary.todayCents : 0)}
          </span>
        </div>
        <div className="stat">
          <span className="stat-label">本月收入</span>
          <strong className="stat-value income">¥{yuan(summary ? summary.incomeCents : 0)}</strong>
          <span className="stat-sub">结余 ¥{yuan(summary ? summary.incomeCents - summary.expenseCents : 0)}</span>
        </div>
        <div className="stat budget-stat">
          <span className="stat-label">
            月度预算
            <button className="mini-btn" onClick={() => setBudgetDraft(String((summary && summary.budgetCents) / 100 || ''))}>
              <Icon name="gear" size={12} />
            </button>
          </span>
          <strong className="stat-value">{summary && summary.budgetCents ? `¥${yuan(summary.budgetCents)}` : '未设置'}</strong>
          <div className="budget-bar">
            <span className={`budget-fill${over > 0 ? ' over' : ''}`} style={{ width: `${budgetPct}%` }} />
          </div>
          <span className="stat-sub">
            {over > 0 ? `已超支 ¥${yuan(over)}` : summary && summary.budgetCents ? `还剩 ¥${yuan(summary.budgetCents - summary.expenseCents)}` : '在右侧设置一个月度上限'}
          </span>
        </div>
      </section>

      <div className="money-body">
        <section className="card panel money-list">
          <header className="panel-head">
            <div className="month-nav">
              <button className="icon-btn tiny" onClick={() => setMonth(shiftMonth(month, -1))}>
                <Icon name="chevron" size={14} style={{ transform: 'rotate(180deg)' }} />
              </button>
              <h2>{monthLabel(month)}</h2>
              <button className="icon-btn tiny" onClick={() => setMonth(shiftMonth(month, 1))}>
                <Icon name="chevron" size={14} />
              </button>
              {month !== currentMonth() && (
                <button className="link-btn" onClick={() => setMonth(currentMonth())}>回到本月</button>
              )}
            </div>
            <div className="seg">
              {[['', '全部'], ['expense', '支出'], ['income', '收入']].map(([value, label]) => (
                <button
                  key={label}
                  className={`seg-item${kind === value ? ' active' : ''}`}
                  onClick={() => setKind(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </header>

          <div className="txn-add">
            <div className="seg small">
              <button
                className={`seg-item${form.kind === 'expense' ? ' active' : ''}`}
                onClick={() => setForm((p) => ({ ...p, kind: 'expense', categoryId: '' }))}
              >
                支出
              </button>
              <button
                className={`seg-item${form.kind === 'income' ? ' active' : ''}`}
                onClick={() => setForm((p) => ({ ...p, kind: 'income', categoryId: '' }))}
              >
                收入
              </button>
            </div>
            <div className="amount-input">
              <span>¥</span>
              <input
                value={form.amount}
                inputMode="decimal"
                placeholder="0.00"
                onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && add()}
              />
            </div>
            <select
              value={form.categoryId}
              onChange={(e) => setForm((p) => ({ ...p, categoryId: e.target.value }))}
            >
              <option value="">未分类</option>
              {(form.kind === 'income' ? incomeCats : expenseCats).map((c) => (
                <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
              ))}
            </select>
            <input
              className="note-input"
              value={form.note}
              placeholder="备注（选填）"
              onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && add()}
            />
            <input
              type="date"
              value={form.date || today}
              onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
            />
            <button className="primary-btn" onClick={add}>
              <Icon name="plus" size={15} /> 记下
            </button>
          </div>

          <div className="cat-chips">
            <button className={`chip-btn${categoryId === null ? ' active' : ''}`} onClick={() => setCategoryId(null)}>
              全部分类
            </button>
            {(kind === 'income' ? incomeCats : kind === 'expense' ? expenseCats : categories).map((c) => (
              <button
                key={c.id}
                className={`chip-btn${categoryId === c.id ? ' active' : ''}`}
                onClick={() => setCategoryId(categoryId === c.id ? null : c.id)}
              >
                <span className="dot" style={{ background: c.color }} />
                {c.name}
              </button>
            ))}
          </div>

          <div className="txn-list">
            {grouped.length === 0 && (
              <div className="empty">
                <Icon name="wallet" size={26} />
                <p>这个月还没有记账，上面记第一笔</p>
              </div>
            )}
            {grouped.map(([date, list]) => {
              const dayExpense = list.filter((r) => r.kind === 'expense').reduce((s, r) => s + r.amountCents, 0);
              return (
                <div className="txn-day" key={date}>
                  <div className="txn-day-head">
                    <span>{monthDay(date)}</span>
                    <em>{dayExpense ? `支出 ¥${yuan(dayExpense)}` : ''}</em>
                  </div>
                  {list.map((row) => (
                    <button className="txn-row" key={row.id} onClick={() => setEditing(row)}>
                      <span className="txn-icon" style={{ background: `${row.categoryColor}1f`, color: row.categoryColor }}>
                        {row.categoryIcon}
                      </span>
                      <span className="txn-main">
                        <span className="txn-cat">{row.categoryName}</span>
                        {row.note && <span className="txn-note">{row.note}</span>}
                      </span>
                      <span className={`txn-amount ${row.kind}`}>
                        {row.kind === 'income' ? '+' : '-'}¥{yuan(row.amountCents)}
                      </span>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </section>

        <aside className="money-side">
          <section className="card panel">
            <header className="panel-head">
              <h2>分类占比</h2>
            </header>
            <div className="donut-wrap">
              <Donut data={(summary && summary.byCategory) || []} total={(summary && summary.expenseCents) || 0} />
            </div>
            <ul className="legend">
              {((summary && summary.byCategory) || []).slice(0, 6).map((c) => (
                <li key={`${c.id}-${c.name}`}>
                  <span className="dot" style={{ background: c.color }} />
                  <span className="legend-name">{c.icon} {c.name}</span>
                  <em>{((c.totalCents / Math.max(1, summary.expenseCents)) * 100).toFixed(0)}%</em>
                  <span className="legend-amount">¥{yuanShort(c.totalCents)}</span>
                </li>
              ))}
              {(!summary || summary.byCategory.length === 0) && <li className="muted">本月还没有支出</li>}
            </ul>
          </section>

          <section className="card panel">
            <header className="panel-head">
              <h2>近 6 个月</h2>
              <span className="legend-inline"><i className="swatch expense" />支出<i className="swatch income" />收入</span>
            </header>
            <Trend data={(summary && summary.trend) || []} />
          </section>

          <section className="card panel">
            <header className="panel-head">
              <h2>预算与分类</h2>
            </header>
            <div className="budget-edit">
              <input
                value={budgetDraft}
                inputMode="decimal"
                placeholder="月度预算，比如 3000"
                onChange={(e) => setBudgetDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveBudget()}
              />
              <button className="ghost-btn" onClick={saveBudget}>保存</button>
            </div>
            <button className="ghost-btn wide" onClick={() => setManaging(true)}>
              <Icon name="gear" size={15} /> 管理分类
            </button>
          </section>
        </aside>
      </div>

      {editing && (
        <TxnDrawer
          txn={editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onChanged={async () => {
            await load();
          }}
          onToast={onToast}
        />
      )}

      {managing && (
        <CategoryManager
          categories={categories}
          onClose={() => setManaging(false)}
          onChanged={async () => {
            await load();
          }}
          onToast={onToast}
        />
      )}
    </div>
  );
}

/* ---------------- 单笔编辑抽屉 ---------------- */
function TxnDrawer({ txn, categories, onClose, onChanged, onToast }) {
  const [draft, setDraft] = useState({
    kind: txn.kind,
    amount: String(txn.amountCents / 100),
    categoryId: txn.categoryId || '',
    date: txn.occurredOn,
    merchant: txn.merchant,
    note: txn.note,
    tags: txn.tags,
  });

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const save = async (patch = {}) => {
    const merged = { ...draft, ...patch };
    const cents = parseYuan(merged.amount);
    if (!cents) return;
    await api.updateTxn(txn.id, {
      kind: merged.kind,
      amountCents: cents,
      categoryId: merged.categoryId ? Number(merged.categoryId) : null,
      occurredOn: merged.date,
      merchant: merged.merchant,
      note: merged.note,
      tags: merged.tags,
    });
    await onChanged();
  };

  const cats = categories.filter((c) => c.kind === draft.kind);

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className="drawer narrow" onClick={(e) => e.stopPropagation()}>
        <header className="drawer-head">
          <span className="save-state">改动会自动保存</span>
          <div className="drawer-head-actions">
            <button
              className="ghost-btn danger"
              onClick={async () => {
                await api.removeTxn(txn.id);
                await onChanged();
                onClose();
              }}
            >
              <Icon name="trash" size={15} /> 删除
            </button>
            <button className="icon-btn" onClick={onClose}>
              <Icon name="x" size={18} />
            </button>
          </div>
        </header>

        <div className="drawer-body">
          <div className="seg">
            <button
              className={`seg-item${draft.kind === 'expense' ? ' active' : ''}`}
              onClick={() => {
                setDraft((p) => ({ ...p, kind: 'expense', categoryId: '' }));
                save({ kind: 'expense', categoryId: '' });
              }}
            >
              支出
            </button>
            <button
              className={`seg-item${draft.kind === 'income' ? ' active' : ''}`}
              onClick={() => {
                setDraft((p) => ({ ...p, kind: 'income', categoryId: '' }));
                save({ kind: 'income', categoryId: '' });
              }}
            >
              收入
            </button>
          </div>

          <label className="field">
            <span>金额</span>
            <div className="amount-input big">
              <span>¥</span>
              <input
                value={draft.amount}
                inputMode="decimal"
                onChange={(e) => setDraft((p) => ({ ...p, amount: e.target.value }))}
                onBlur={() => save()}
              />
            </div>
          </label>

          <label className="field">
            <span>分类</span>
            <select
              value={draft.categoryId}
              onChange={(e) => {
                setDraft((p) => ({ ...p, categoryId: e.target.value }));
                save({ categoryId: e.target.value });
              }}
            >
              <option value="">未分类</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>日期</span>
            <input
              type="date"
              value={draft.date}
              onChange={(e) => {
                setDraft((p) => ({ ...p, date: e.target.value }));
                save({ date: e.target.value });
              }}
            />
          </label>

          <label className="field">
            <span>商家 / 对方</span>
            <input
              value={draft.merchant}
              placeholder="比如 楼下便利店"
              onChange={(e) => setDraft((p) => ({ ...p, merchant: e.target.value }))}
              onBlur={() => save()}
            />
          </label>

          <label className="field">
            <span>备注</span>
            <textarea
              className="note-field"
              rows={3}
              value={draft.note}
              onChange={(e) => setDraft((p) => ({ ...p, note: e.target.value }))}
              onBlur={() => save()}
            />
          </label>

          <label className="field">
            <span>标签（逗号分隔）</span>
            <input
              value={draft.tags}
              placeholder="比如 朋友,周末"
              onChange={(e) => setDraft((p) => ({ ...p, tags: e.target.value }))}
              onBlur={() => save()}
            />
          </label>
        </div>
      </aside>
    </>
  );
}

/* ---------------- 分类管理 ---------------- */
const EMOJI = ['🍜', '🚕', '🛍️', '🏠', '🎬', '💊', '📚', '☕', '🎁', '💼', '📈', '✨', '🐱', '✈️', '💡'];
const COLORS = ['#7C5CFF', '#B96BE0', '#F0748C', '#F0A44B', '#3FBF9F', '#4C9AFF', '#E5484D', '#8B8FA3'];

function CategoryManager({ categories, onClose, onChanged, onToast }) {
  const [draft, setDraft] = useState({ id: null, name: '', kind: 'expense', icon: '✨', color: '#7C5CFF' });

  const reset = () => setDraft({ id: null, name: '', kind: 'expense', icon: '✨', color: '#7C5CFF' });

  const save = async () => {
    const name = draft.name.trim();
    if (!name) return;
    await api.saveCategory({ ...draft, name });
    reset();
    await onChanged();
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="settings cat-manager" onClick={(e) => e.stopPropagation()}>
        <header className="settings-head">
          <h2>分类管理</h2>
          <button className="icon-btn" onClick={onClose}>
            <Icon name="x" size={18} />
          </button>
        </header>

        <div className="cat-form">
          <input
            className="text-input"
            value={draft.name}
            placeholder="分类名字"
            onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
            onKeyDown={(e) => e.key === 'Enter' && save()}
          />
          <div className="seg small">
            <button
              className={`seg-item${draft.kind === 'expense' ? ' active' : ''}`}
              onClick={() => setDraft((p) => ({ ...p, kind: 'expense' }))}
            >
              支出
            </button>
            <button
              className={`seg-item${draft.kind === 'income' ? ' active' : ''}`}
              onClick={() => setDraft((p) => ({ ...p, kind: 'income' }))}
            >
              收入
            </button>
          </div>
          <div className="emoji-row">
            {EMOJI.map((e) => (
              <button
                key={e}
                className={`emoji${draft.icon === e ? ' active' : ''}`}
                onClick={() => setDraft((p) => ({ ...p, icon: e }))}
              >
                {e}
              </button>
            ))}
          </div>
          <div className="color-row">
            {COLORS.map((c) => (
              <button
                key={c}
                className={`swatch-btn${draft.color === c ? ' active' : ''}`}
                style={{ background: c }}
                onClick={() => setDraft((p) => ({ ...p, color: c }))}
              />
            ))}
          </div>
          <div className="row-actions">
            <button className="primary-btn" onClick={save}>{draft.id ? '保存修改' : '新增分类'}</button>
            {draft.id && <button className="ghost-btn" onClick={reset}>取消编辑</button>}
          </div>
        </div>

        <div className="cat-groups">
          {['expense', 'income'].map((kind) => (
            <div key={kind}>
              <h3>{kind === 'expense' ? '支出分类' : '收入分类'}</h3>
              <div className="cat-grid">
                {categories.filter((c) => c.kind === kind).map((c) => (
                  <div key={c.id} className={`cat-item${draft.id === c.id ? ' editing' : ''}`}>
                    <span className="cat-icon" style={{ background: `${c.color}1f`, color: c.color }}>{c.icon}</span>
                    <span>{c.name}</span>
                    <button
                      className="mini-btn"
                      onClick={() => setDraft({ id: c.id, name: c.name, kind: c.kind, icon: c.icon, color: c.color })}
                    >
                      <Icon name="gear" size={12} />
                    </button>
                    <button
                      className="mini-btn"
                      onClick={async () => {
                        await api.removeCategory(c.id);
                        await onChanged();
                        onToast && onToast('分类已删除，相关账目变成未分类');
                      }}
                    >
                      <Icon name="x" size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
