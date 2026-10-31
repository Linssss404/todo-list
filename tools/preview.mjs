/**
 * 生成静态预览页：把 React 真实渲染结果 + 同一份 CSS 存成 HTML，
 * 用浏览器打开即可看到与桌面版一致的界面（只读，不可交互）。
 *
 *   node tools/preview.mjs
 */

import { JSDOM, VirtualConsole } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStore, makeApi } from './mock-api.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outDir = path.join(root, 'preview');

let css = fs.readFileSync(path.join(root, 'src', 'styles.css'), 'utf8');
const modulesCss = path.join(root, 'src', 'styles-modules.css');
if (fs.existsSync(modulesCss)) css += '\n\n/* ===== 模块样式 ===== */\n' + fs.readFileSync(modulesCss, 'utf8');

const appBundle = fs.readFileSync(path.join(root, 'dist', 'assets', 'app.js'), 'utf8');
const quickBundle = fs.readFileSync(path.join(root, 'dist', 'assets', 'quick.js'), 'utf8');

function mount({ htmlFile, bundleCode, theme = 'light' }) {
  const store = createStore();
  store.theme = theme;
  const api = makeApi(store);
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>preview</title></head><body></body></html>`;

  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (e) => console.error('[jsdom]', e.message));

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
        hideQuick: async () => true,
        openQuick: async () => true,
        onQuickReset: () => {},
        onFocus: () => {},
        platform: 'win32',
      };
    },
  });

  // 主窗口和快记窗的根节点不一样
  const src = htmlFile === 'quick.html'
    ? fs.readFileSync(path.join(root, 'dist', 'quick.html'), 'utf8')
    : fs.readFileSync(path.join(root, 'dist', 'index.html'), 'utf8');
  dom.window.document.body.innerHTML = src.includes('quick-root') ? '<div id="quick-root"></div>' : '<div id="root"></div>';
  dom.window.eval(bundleCode);
  return { dom, store };
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const OVERRIDE = `
html, body { height: auto; min-height: 100%; overflow: auto; }
.app { height: auto; min-height: 100vh; }
.content { overflow: visible; }
.main-panel { min-height: 0; }
.notes-page { height: auto; min-height: calc(100vh - 158px); }
`;

function save(window, name, title, extraCss = '') {
  const theme = window.document.documentElement.dataset.theme || 'light';
  const isQuick = !!window.document.getElementById('quick-root');
  const rootEl = window.document.getElementById(isQuick ? 'quick-root' : 'root');
  const html = `<!doctype html>
<html lang="zh-CN" data-theme="${theme}">
<head>
<meta charset="utf-8" />
<title>Linsssside · ${title}</title>
<style>
${css}
${isQuick ? 'html,body{height:100%;margin:0;overflow:hidden}' : OVERRIDE}
${extraCss}
</style>
</head>
<body>
${rootEl ? rootEl.innerHTML : ''}
</body>
</html>`;
  fs.writeFileSync(path.join(outDir, name), html, 'utf8');
  console.log('  →', name, `${(html.length / 1024).toFixed(0)} KB`);
}

const clickButton = (window, label) => {
  const btn = [...window.document.querySelectorAll('button')].find((b) => b.textContent.trim() === label);
  if (btn) btn.click();
  return !!btn;
};

const run = async () => {
  fs.mkdirSync(outDir, { recursive: true });

  console.log('渲染浅色界面…');
  const light = mount({ htmlFile: 'index.html', bundleCode: appBundle, theme: 'light' });
  const w = light.dom.window;
  await wait(900);

  save(w, '1-仪表盘-浅色.html', '仪表盘（浅色）');

  clickButton(w, '待办');
  await wait(600);
  save(w, '2-待办-浅色.html', '待办（浅色）');

  const firstRow = w.document.querySelector('.todo-row');
  if (firstRow) firstRow.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await wait(600);
  save(w, '3-待办抽屉-浅色.html', '待办详情（浅色）');
  const closeDrawer = w.document.querySelector('.drawer .icon-btn');
  if (closeDrawer) closeDrawer.click();
  await wait(300);

  clickButton(w, '记账');
  await wait(800);
  save(w, '4-记账-浅色.html', '记账（浅色）');

  clickButton(w, '日程');
  await wait(800);
  save(w, '5-日程月视图-浅色.html', '日程 · 月视图（浅色）');

  clickButton(w, '灵感');
  await wait(800);
  save(w, '6-灵感-浅色.html', '灵感（浅色）');

  console.log('渲染深色界面…');
  const dark = mount({ htmlFile: 'index.html', bundleCode: appBundle, theme: 'dark' });
  const dw = dark.dom.window;
  await wait(900);
  save(dw, '7-仪表盘-深色.html', '仪表盘（深色）');

  clickButton(dw, '记账');
  await wait(800);
  save(dw, '8-记账-深色.html', '记账（深色）');

  clickButton(dw, '日程');
  await wait(800);
  save(dw, '9-日程月视图-深色.html', '日程（深色）');

  console.log('渲染快速记录窗…');
  const quick = mount({ htmlFile: 'quick.html', bundleCode: quickBundle, theme: 'dark' });
  await wait(500);
  save(quick.dom.window, '10-快速记录窗.html', '快速记录窗（Ctrl+Alt+Space）');

  const cards = [
    ['1-仪表盘-浅色.html', '仪表盘 · 浅色', '今日待办 / 每日命名 / 本月支出 / 接下来 7 天'],
    ['2-待办-浅色.html', '待办 · 浅色', '清单栏 + 筛选 + 优先级 + 拖拽'],
    ['3-待办抽屉-浅色.html', '待办详情 · 浅色', '右侧抽屉就地编辑，改动自动保存'],
    ['4-记账-浅色.html', '记账 · 浅色', '月度汇总 / 流水 / 分类占比 / 六个月趋势'],
    ['5-日程月视图-浅色.html', '日程 · 浅色', '月历 + 待办截止合并显示 + 每天的名字'],
    ['6-灵感-浅色.html', '灵感 · 浅色', '笔记列表 + Markdown 编辑与预览'],
    ['7-仪表盘-深色.html', '仪表盘 · 深色', '同一套界面，深色模式'],
    ['8-记账-深色.html', '记账 · 深色', '深色下的图表与流水'],
    ['9-日程月视图-深色.html', '日程 · 深色', '深色下的月历'],
    ['10-快速记录窗.html', '快速记录窗', 'Ctrl+Alt+Space 唤起，一句话存成灵感 / 待办 / 支出'],
  ];

  const links = cards
    .map(
      ([file, title, desc], i) => `<a class="card" href="${file}">
        <span class="no">${String(i + 1).padStart(2, '0')}</span>
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
  .wrap { width: min(920px, 100%); }
  h1 { margin: 0 0 6px; font-size: 26px; letter-spacing: .01em; }
  p.lead { margin: 0 0 26px; color: #6f6689; font-size: 14px; line-height: 1.7; }
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
    <p class="lead">这是真实渲染结果的静态导出，和桌面版共用同一份 CSS，看到的就是应用里的样子。点进去看。</p>
    <div class="grid">
${links}
    </div>
    <p class="foot">静态页没有交互（点按钮不会动）。要试真实交互，双击项目根目录的 <code>启动 Linsssside.cmd</code>。</p>
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
