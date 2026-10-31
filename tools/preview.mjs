/**
 * 生成静态预览页：把 React 真正渲染出来的 DOM + 同一份 CSS 存成 HTML，
 * 用浏览器打开即可看到和桌面版一致的界面（只读，不可交互）。
 *
 *   node tools/preview.mjs
 */

import { JSDOM, VirtualConsole } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outDir = path.join(root, 'preview');
const css = fs.readFileSync(path.join(root, 'src', 'styles.css'), 'utf8');
const bundle = fs.readFileSync(path.join(root, 'dist', 'assets', 'app.js'), 'utf8');

const pad = (n) => String(n).padStart(2, '0');
const shift = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const TODAY = shift(0);

const baseTodos = [
  {
    id: 1,
    listId: 1,
    title: '把周报写完，附上三张数据图',
    note: '重点写清楚这周的三个结论',
    priority: 3,
    dueAt: `${TODAY}T18:00`,
    allDay: false,
    doneAt: null,
    sort: 1024,
    subTotal: 3,
    subDone: 1,
    listName: '工作',
    repeatFreq: 'weekly',
    repeatInterval: 1,
  },
  { id: 2, listId: 1, title: '给妈妈打个视频电话', priority: 2, dueAt: TODAY, allDay: true, doneAt: null, sort: 2048, subTotal: 0, subDone: 0, listName: '收件箱' },
  { id: 3, listId: 2, title: '把旅行照片导出来，挑九张洗出来', priority: 0, dueAt: null, allDay: false, doneAt: null, sort: 3072, subTotal: 0, subDone: 0, listName: '生活' },
  { id: 4, listId: 1, title: '预约下周三的牙科', priority: 3, dueAt: `${shift(4)}T09:30`, allDay: false, doneAt: null, sort: 4096, subTotal: 0, subDone: 0, listName: '收件箱' },
  { id: 5, listId: 2, title: '读完《城市与狗》剩下的四十页', priority: 1, dueAt: shift(1), allDay: true, doneAt: null, sort: 5120, subTotal: 0, subDone: 0, listName: '生活', repeatFreq: 'daily' },
  { id: 6, listId: 1, title: '整理这周的灵感碎片', priority: 0, dueAt: TODAY, allDay: true, doneAt: null, sort: 6144, subTotal: 0, subDone: 0, listName: '工作' },
  { id: 7, listId: 1, title: '回复设计稿的两条批注', priority: 2, dueAt: TODAY, allDay: true, doneAt: null, sort: 7168, subTotal: 0, subDone: 0, listName: '工作' },
  { id: 8, listId: 2, title: '早上跑了三公里', priority: 0, dueAt: null, doneAt: `${TODAY}T07:20`, sort: 8192, subTotal: 0, subDone: 0, listName: '生活' },
  { id: 9, listId: 1, title: '把上周的会议纪要归档', priority: 0, dueAt: null, doneAt: `${TODAY}T09:05`, sort: 9216, subTotal: 0, subDone: 0, listName: '工作' },
];

const subtasks = [
  { id: 101, parentId: 1, title: '导出三张图', doneAt: `${TODAY}T10:00`, subTotal: 0, subDone: 0, listName: '工作' },
  { id: 102, parentId: 1, title: '写完结论部分', doneAt: null, subTotal: 0, subDone: 0, listName: '工作' },
  { id: 103, parentId: 1, title: '通读一遍', doneAt: null, subTotal: 0, subDone: 0, listName: '工作' },
];

function makeApi(theme) {
  const store = {
    theme,
    lists: [
      { id: 1, name: '收件箱', color: '#7C5CFF', sort: 0 },
      { id: 2, name: '生活', color: '#3FBF9F', sort: 1024 },
      { id: 3, name: '工作', color: '#4C9AFF', sort: 2048 },
    ],
    todos: baseTodos,
    dayLabels: { [TODAY]: '自信绽放日' },
  };

  const api = {
    'auth.status': () => ({ enabled: false, unlocked: true }),
    'auth.unlock': () => ({ unlocked: true }),
    'auth.setup': () => ({ enabled: true }),
    'lists.list': () => store.lists,
    'lists.create': ({ name, color }) => ({ id: 9, name, color }),
    'lists.update': ({ id, patch }) => ({ id, ...patch }),
    'lists.remove': () => ({ movedTo: 1 }),
    'todos.list': ({ view = 'all', listId = null } = {}) => {
      let rows = store.todos.filter((t) => !listId || t.listId === listId);
      if (view === 'done') return rows.filter((t) => t.doneAt);
      rows = rows.filter((t) => !t.doneAt);
      if (view === 'today') return rows.filter((t) => t.dueAt && t.dueAt.slice(0, 10) <= TODAY);
      if (view === 'upcoming') return rows.filter((t) => t.dueAt && t.dueAt.slice(0, 10) > TODAY);
      if (view === 'inbox') return rows.filter((t) => !t.dueAt);
      return rows;
    },
    'todos.get': ({ id }) => {
      const todo = store.todos.find((t) => t.id === id);
      if (!todo) return null;
      return { ...todo, subtasks: subtasks.filter((s) => s.parentId === id) };
    },
    'todos.subtasks': ({ id }) => subtasks.filter((s) => s.parentId === id),
    'todos.create': (payload) => ({ id: 999, ...payload, subTotal: 0, subDone: 0 }),
    'todos.update': ({ id, patch }) => ({ id, ...patch }),
    'todos.toggle': ({ id }) => store.todos.find((t) => t.id === id),
    'todos.remove': () => true,
    'todos.reorder': () => true,
    'days.get': ({ date }) => (store.dayLabels[date] ? { date, label: store.dayLabels[date] } : null),
    'days.set': ({ date, label }) => ({ date, label }),
    'settings.all': () => ({ theme: store.theme, budget: 0 }),
    'settings.set': ({ key, value }) => {
      if (key === 'theme') store.theme = value;
      return true;
    },
    'overview.get': () => ({
      date: TODAY,
      dayLabel: { date: TODAY, label: '自信绽放日' },
      counts: {
        openToday: store.todos.filter((t) => !t.doneAt && t.dueAt && t.dueAt.slice(0, 10) <= TODAY).length,
        overdue: 0,
        doneToday: 2,
        openAll: store.todos.filter((t) => !t.doneAt).length,
      },
    }),
    'search.query': () => ({ todos: [], days: [] }),
    'export.run': () => ({ dir: 'data/exports', files: [] }),
    'app.info': () => ({ version: '0.1.0', dataDir: 'data', packaged: false, dbPath: 'data/life.db' }),
    'app.openDataDir': () => true,
    'app.revealPath': () => true,
  };
  return { api, store };
}

function mount(theme) {
  const { api, store } = makeApi(theme);
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (e) => console.error('[jsdom]', e.message));

  const page = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>preview</title></head><body><div id="root"></div></body></html>`;
  const dom = new JSDOM(page, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole,
    url: 'file:///C:/app/index.html',
    beforeParse(window) {
      window.linsssside = {
        call: async (method, payload) => {
          const fn = api[method];
          if (!fn) return { ok: false, error: { message: 'no method ' + method } };
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
  dom.window.eval(bundle);
  return { dom, store };
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const clickText = (window, label) => {
  const btn = [...window.document.querySelectorAll('button')].find((b) => b.textContent.trim() === label);
  if (btn) btn.click();
  return !!btn;
};

const OVERRIDE = `
html, body { height: auto; min-height: 100%; overflow: auto; }
.app { height: auto; min-height: 100vh; }
.content { overflow: visible; }
.main-panel { min-height: 0; }
.drawer { position: absolute; }
`;

function save(window, name, title) {
  const theme = window.document.documentElement.dataset.theme || 'light';
  const rootHtml = window.document.getElementById('root').innerHTML;
  const html = `<!doctype html>
<html lang="zh-CN" data-theme="${theme}">
<head>
<meta charset="utf-8" />
<title>Linsssside · ${title}</title>
<style>
${css}
${OVERRIDE}
</style>
</head>
<body>
${rootHtml}
</body>
</html>`;
  fs.writeFileSync(path.join(outDir, name), html, 'utf8');
  console.log('  →', name, `${(html.length / 1024).toFixed(0)} KB`);
}

fs.mkdirSync(outDir, { recursive: true });

const run = async () => {
  console.log('渲染浅色界面…');
  const { dom } = mount('light');
  const { window } = dom;
  await wait(700);

  save(window, '1-仪表盘-浅色.html', '仪表盘（浅色）');

  clickText(window, '待办');
  await wait(450);
  save(window, '2-待办-浅色.html', '待办（浅色）');

  const row = window.document.querySelector('.todo-row');
  if (row) row.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await wait(450);
  save(window, '3-待办抽屉-浅色.html', '待办详情抽屉（浅色）');

  const close = window.document.querySelector('.drawer .icon-btn');
  if (close) close.click();
  await wait(250);
  clickText(window, '记账');
  await wait(400);
  save(window, '4-记账占位-浅色.html', '记账（下一阶段）');

  console.log('渲染深色界面…');
  const dark = mount('dark');
  await wait(700);
  save(dark.dom.window, '5-仪表盘-深色.html', '仪表盘（深色）');

  clickText(dark.dom.window, '待办');
  await wait(450);
  save(dark.dom.window, '6-待办-深色.html', '待办（深色）');

  const cards = [
    ['1-仪表盘-浅色.html', '仪表盘 · 浅色', '今日待办 / 每日命名 / 快速添加'],
    ['2-待办-浅色.html', '待办 · 浅色', '清单栏 + 筛选 + 拖拽排序'],
    ['3-待办抽屉-浅色.html', '待办详情 · 浅色', '右侧抽屉就地编辑'],
    ['4-记账占位-浅色.html', '记账 · 占位', '下一阶段的路线图'],
    ['5-仪表盘-深色.html', '仪表盘 · 深色', '同一套界面，深色模式'],
    ['6-待办-深色.html', '待办 · 深色', '深色下的清单与条目'],
  ];

  const links = cards
    .map(
      ([file, title, desc], i) => `<a class="card" href="${file}">
        <span class="no">0${i + 1}</span>
        <strong>${title}</strong>
        <em>${desc}</em>
      </a>`
    )
    .join('\n');

  const index = `<!doctype html>
<html lang="zh-CN" data-theme="light">
<head>
<meta charset="utf-8" />
<title>Linsssside 界面预览</title>
<style>
  body { margin: 0; min-height: 100vh; background: #f4f1fd; color: #1e1830;
    font-family: 'Segoe UI Variable Text','Segoe UI','Microsoft YaHei UI',system-ui,sans-serif;
    display: grid; place-items: center; padding: 48px 24px; }
  .wrap { width: min(880px, 100%); }
  h1 { margin: 0 0 6px; font-size: 26px; letter-spacing: .01em; }
  p.lead { margin: 0 0 26px; color: #6f6689; font-size: 14px; }
  .grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 14px; }
  a.card { display: flex; flex-direction: column; gap: 4px; padding: 18px 20px; border-radius: 18px;
    background: #fff; border: 1px solid rgba(124,92,255,.14); text-decoration: none; color: inherit;
    box-shadow: 0 20px 44px -34px rgba(70,40,140,.55); transition: transform .18s, border-color .18s; }
  a.card:hover { transform: translateY(-3px); border-color: rgba(124,92,255,.4); }
  .no { font-size: 11px; letter-spacing: .14em; color: #a79ec4; }
  strong { font-size: 15px; }
  em { font-style: normal; font-size: 12.5px; color: #6f6689; }
  .foot { margin-top: 22px; font-size: 12px; color: #8b82a6; line-height: 1.7; }
  code { background: #ece7fb; padding: 1px 6px; border-radius: 6px; font-size: 11.5px; }
</style>
</head>
<body>
  <div class="wrap">
    <h1>Linsssside · 界面预览</h1>
    <p class="lead">这是把真实渲染结果导出成静态网页的样子，和桌面版用的是同一份 CSS。点进去看。</p>
    <div class="grid">
${links}
    </div>
    <p class="foot">静态页没有交互（点按钮不会动），要看真实效果请双击项目根目录的 <code>启动 Linsssside.cmd</code>。</p>
  </div>
</body>
</html>`;

  fs.writeFileSync(path.join(outDir, 'index.html'), index, 'utf8');
  console.log('  → index.html');
  console.log('\n预览已生成：preview/index.html');
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
