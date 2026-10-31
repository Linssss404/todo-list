/**
 * 界面冒烟测试：在 jsdom 里把真正的 dist 包跑起来。
 * 目的不是看像素，而是确认 React 能挂载、四个页面能切换、交互不发散。
 *
 *   node tools/smoke.mjs
 */

import { JSDOM, VirtualConsole } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const html = fs.readFileSync(path.join(root, 'dist', 'index.html'), 'utf8');
const bundle = fs.readFileSync(path.join(root, 'dist', 'assets', 'app.js'), 'utf8');

const today = new Date();
const pad = (n) => String(n).padStart(2, '0');
const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

/* ---------- 假后端：和 electron/ipc.js 的返回结构保持一致 ---------- */
const store = {
  lists: [
    { id: 1, name: '收件箱', color: '#7C5CFF', sort: 0 },
    { id: 2, name: '工作', color: '#4C9AFF', sort: 1024 },
  ],
  todos: [
    { id: 11, listId: 1, title: '把日记写满三行', note: '', priority: 3, dueAt: todayStr, allDay: true, doneAt: null, sort: 1024, subTotal: 2, subDone: 1, listName: '收件箱', repeatFreq: null },
    { id: 12, listId: 2, title: '整理这周的工作笔记', note: '顺手归档', priority: 2, dueAt: `${todayStr}T18:00`, doneAt: null, sort: 2048, subTotal: 0, subDone: 0, listName: '工作', repeatFreq: 'weekly', repeatInterval: 1 },
    { id: 13, listId: 1, title: '给妈妈打个电话', note: '', priority: 0, dueAt: null, doneAt: null, sort: 3072, subTotal: 0, subDone: 0, listName: '收件箱', repeatFreq: null },
  ],
  dayLabels: { [todayStr]: '自信绽放日' },
  theme: 'light',
  exported: false,
};

const api = {
  'auth.status': () => ({ enabled: false, unlocked: true }),
  'auth.unlock': () => ({ unlocked: true }),
  'auth.setup': () => ({ enabled: true }),
  'lists.list': () => store.lists,
  'lists.create': ({ name, color }) => {
    const created = { id: 99, name, color, sort: 9000 };
    store.lists.push(created);
    return created;
  },
  'lists.update': ({ id, patch }) => ({ id, ...patch }),
  'lists.remove': () => ({ movedTo: 1 }),
  'todos.list': ({ view = 'all', listId = null, q = '' } = {}) => {
    let rows = store.todos.filter((t) => !listId || t.listId === listId);
    if (view === 'done') rows = rows.filter((t) => t.doneAt);
    else {
      rows = rows.filter((t) => !t.doneAt);
      if (view === 'today') rows = rows.filter((t) => t.dueAt && t.dueAt.slice(0, 10) <= todayStr);
      if (view === 'upcoming') rows = rows.filter((t) => t.dueAt && t.dueAt.slice(0, 10) > todayStr);
      if (view === 'inbox') rows = rows.filter((t) => !t.dueAt);
    }
    if (q) rows = rows.filter((t) => t.title.includes(q));
    return rows;
  },
  'todos.get': ({ id }) => {
    const todo = store.todos.find((t) => t.id === id);
    return todo ? { ...todo, subtasks: store.todos.filter((t) => t.parentId === id) } : null;
  },
  'todos.create': (payload) => {
    const created = {
      id: 100 + store.todos.length,
      listId: payload.listId || 1,
      title: payload.title,
      note: payload.note || '',
      priority: payload.priority || 0,
      dueAt: payload.dueAt || null,
      allDay: !!payload.allDay,
      doneAt: null,
      sort: 9999,
      subTotal: 0,
      subDone: 0,
      listName: '收件箱',
    };
    store.todos.push(created);
    return created;
  },
  'todos.update': ({ id, patch }) => {
    const todo = store.todos.find((t) => t.id === id);
    if (todo) Object.assign(todo, patch);
    return todo;
  },
  'todos.toggle': ({ id, done }) => {
    const todo = store.todos.find((t) => t.id === id);
    if (todo) todo.doneAt = done ? `${todayStr}T10:00` : null;
    return todo;
  },
  'todos.remove': () => true,
  'todos.reorder': () => true,
  'days.get': ({ date }) => (store.dayLabels[date] ? { date, label: store.dayLabels[date] } : null),
  'days.set': ({ date, label }) => {
    if (label) store.dayLabels[date] = label;
    else delete store.dayLabels[date];
    return label ? { date, label } : null;
  },
  'settings.all': () => ({ theme: store.theme, budget: 0 }),
  'settings.set': ({ key, value }) => {
    if (key === 'theme') store.theme = value;
    return true;
  },
  'overview.get': () => ({
    date: todayStr,
    dayLabel: store.dayLabels[todayStr] ? { date: todayStr, label: store.dayLabels[todayStr] } : null,
    counts: {
      openToday: store.todos.filter((t) => !t.doneAt && t.dueAt && t.dueAt.slice(0, 10) <= todayStr).length,
      overdue: 0,
      doneToday: 0,
      openAll: store.todos.filter((t) => !t.doneAt).length,
    },
  }),
  'search.query': ({ q }) => ({
    todos: store.todos.filter((t) => t.title.includes(q)),
    days: Object.entries(store.dayLabels)
      .filter(([, label]) => label.includes(q))
      .map(([date, label]) => ({ date, label })),
  }),
  'export.run': () => ({ dir: 'C:/tmp/exports', files: ['全部数据.json', '账单.csv'] }),
  'app.info': () => ({ version: '0.1.0', dataDir: 'data', packaged: false, dbPath: 'data/life.db' }),
  'app.openDataDir': () => true,
  'app.revealPath': () => true,
};

const errors = [];
const virtualConsole = new VirtualConsole();
virtualConsole.on('jsdomError', (e) => errors.push(`jsdomError: ${e.message}`));
virtualConsole.on('error', (...args) => errors.push(`console.error: ${args.join(' ')}`));
virtualConsole.on('warn', () => {});

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  virtualConsole,
  url: 'file:///C:/app/dist/index.html',
  beforeParse(window) {
    window.linsssside = {
      call: async (method, payload) => {
        const fn = api[method];
        if (!fn) return { ok: false, error: { message: `未见接口 ${method}` } };
        try {
          return { ok: true, data: fn(payload || {}) };
        } catch (err) {
          return { ok: false, error: { message: err.message } };
        }
      },
      notifyTest: async () => ({ ok: true }),
      onFocus: () => {},
      platform: 'win32',
    };
  },
});

const { window } = dom;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// 手动注入打包后的脚本（file:// 下 jsdom 不会去取外链）
try {
  window.eval(bundle);
} catch (err) {
  errors.push(`bundle eval failed: ${err.message}`);
}

await wait(700);

const text = () => window.document.body.textContent.replace(/\s+/g, ' ');
/** React 自己记着 value，直接赋值不会触发 onChange，要用原生 setter */
const setValue = (el, value) => {
  const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
  el.dispatchEvent(new window.Event('input', { bubbles: true }));
};
const report = [];
const check = (label, condition, detail = '') => {
  report.push({ label, ok: !!condition, detail });
};

check('应用已挂载', window.document.querySelector('#root').children.length > 0);
check('顶部导航存在', text().includes('Linsssside') && text().includes('仪表盘'));
check('首页显示每日命名', text().includes('自信绽放日'));
check('首页显示今日待办', text().includes('今日待办'));
check('首页出现待办条目', text().includes('把日记写满三行'));
check('下一阶段卡片', text().includes('下一阶段'));

// 切到待办页
const clickByText = (label) => {
  const nodes = [...window.document.querySelectorAll('button')];
  const target = nodes.find((n) => n.textContent.trim() === label || n.textContent.includes(label));
  if (target) target.click();
  return !!target;
};

check('能点到待办标签', clickByText('待办'));
await wait(400);
check('待办页渲染清单', text().includes('收件箱') && text().includes('全部'));
check('待办页渲染条目', text().includes('给妈妈打个电话'));
check('待办页筛选器', text().includes('即将') && text().includes('已完成'));

// 新增一条待办
const input = window.document.querySelector('.quickadd input');
let added = false;
if (input) {
  setValue(input, '冒烟测试新增的一条');
  await wait(80);
  input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await wait(400);
  added = text().includes('冒烟测试新增的一条');
}
check('回车能新增待办', added);

// 打开抽屉
const row = window.document.querySelector('.todo-row');
if (row) row.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await wait(400);
check('点击待办能开抽屉', !!window.document.querySelector('.drawer'));
const drawerTitle = window.document.querySelector('.drawer .title-field');
check('抽屉带标题输入', !!drawerTitle);
if (drawerTitle) {
  setValue(drawerTitle, '改过标题了');
  await wait(900);
}
check('抽屉改动会回写', store.todos.some((t) => t.title === '改过标题了'));

// 关闭抽屉 + 切到记账占位页
const closeBtn = [...window.document.querySelectorAll('.drawer .icon-btn')][0];
if (closeBtn) closeBtn.click();
await wait(300);
check('能关掉抽屉', !window.document.querySelector('.drawer'));

check('能切到记账', clickByText('记账'));
await wait(300);
check('记账占位页有路线图', text().includes('自定义分类') || text().includes('月度趋势'));

check('能切到日程', clickByText('日程'));
await wait(300);
check('日程占位页提到待办联动', text().includes('自动出现在日历上'));

check('能切到灵感', clickByText('灵感'));
await wait(300);
check('灵感占位页提到 Markdown', text().includes('Markdown'));

// 深色模式
check('能点开设置', (() => {
  const gear = window.document.querySelectorAll('.top-actions .icon-btn');
  if (gear.length >= 2) {
    gear[1].click();
    return true;
  }
  return false;
})());
await wait(300);
check('设置面板出现', !!window.document.querySelector('.settings'));

/* ---------- 输出 ---------- */
let pass = 0;
for (const item of report) {
  if (item.ok) pass += 1;
  console.log(`${item.ok ? '  ✔' : '  ✘'} ${item.label}${item.detail ? ' — ' + item.detail : ''}`);
}
console.log(`\n${pass}/${report.length} 通过`);
if (errors.length) {
  console.log('\n运行期错误：');
  errors.slice(0, 12).forEach((e) => console.log('  ! ' + e));
}
process.exit(pass === report.length && errors.length === 0 ? 0 : 1);
