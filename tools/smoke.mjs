/**
 * 界面冒烟测试：在 jsdom 里把真正的 dist 包跑起来（主窗口 + 快速记录窗）。
 * 目的不是看像素，而是确认 React 能挂载、五个页面能切换、交互不发散。
 *
 *   node tools/smoke.mjs
 */

import { JSDOM, VirtualConsole } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStore, makeApi, TODAY } from './mock-api.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const bundle = fs.readFileSync(path.join(root, 'dist', 'assets', 'app.js'), 'utf8');
const quickBundle = fs.readFileSync(path.join(root, 'dist', 'assets', 'quick.js'), 'utf8');

function boot({ htmlFile, bundleCode, store }) {
  const html = fs.readFileSync(path.join(root, 'dist', htmlFile), 'utf8');
  const api = makeApi(store);
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (e) => errors.push(`jsdomError: ${e.message}`));
  virtualConsole.on('error', (...args) => errors.push(`console.error: ${args.join(' ')}`));

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
  try {
    dom.window.eval(bundleCode);
  } catch (err) {
    errors.push(`bundle eval failed: ${err.message}`);
  }
  return { dom, window: dom.window, errors, store };
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const report = [];
const check = (label, condition, detail = '') => report.push({ label, ok: !!condition, detail });

const textOf = (window) => window.document.body.textContent.replace(/\s+/g, ' ');
const setValue = (window, el, value) => {
  const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
  el.dispatchEvent(new window.Event('input', { bubbles: true }));
};
const clickButton = (window, label) => {
  const btn = [...window.document.querySelectorAll('button')].find((b) => b.textContent.trim() === label);
  if (btn) btn.click();
  return !!btn;
};

const run = async () => {
  const store = createStore();
  const app = boot({ htmlFile: 'index.html', bundleCode: bundle, store });
  const { window } = app;
  await wait(900);

  /* ---------- 首页 ---------- */
  check('应用已挂载', window.document.querySelector('#root').children.length > 0);
  check('顶部导航五个模块', ['仪表盘', '待办', '记账', '日程', '灵感'].every((t) => textOf(window).includes(t)));
  check('首页显示每日命名', textOf(window).includes('自信绽放日'));
  check('首页显示今日待办', textOf(window).includes('今日待办') && textOf(window).includes('把周报写完'));
  const bigMoney = window.document.querySelector('.money-big strong');
  check('首页支出卡有金额', !!bigMoney && bigMoney.textContent.includes('2,864.50'), bigMoney && bigMoney.textContent);
  check('首页显示接下来 7 天', textOf(window).includes('接下来 7 天') && textOf(window).includes('和设计对齐视觉稿'));
  check('首页显示最近灵感', textOf(window).includes('最近的灵感') && textOf(window).includes('写周报的一个角度'));

  /* ---------- 待办 ---------- */
  check('能切到待办', clickButton(window, '待办'));
  await wait(500);
  check('待办页渲染清单和条目', textOf(window).includes('收件箱') && textOf(window).includes('给妈妈打个视频电话'));
  const quick = window.document.querySelector('.quickadd input');
  let added = false;
  if (quick) {
    setValue(window, quick, '冒烟测试新增的一条');
    await wait(60);
    quick.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await wait(450);
    added = textOf(window).includes('冒烟测试新增的一条');
  }
  check('回车能新增待办', added);

  const row = window.document.querySelector('.todo-row');
  if (row) row.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await wait(450);
  check('点击待办能开抽屉', !!window.document.querySelector('.drawer'));
  const drawerTitle = window.document.querySelector('.drawer .title-field');
  let edited = false;
  if (drawerTitle) {
    setValue(window, drawerTitle, '改过标题了');
    await wait(900);
    edited = store.todos.some((t) => t.title === '改过标题了');
  }
  check('抽屉改动会回写', edited);
  const closeDrawer = window.document.querySelector('.drawer .icon-btn');
  if (closeDrawer) closeDrawer.click();
  await wait(300);

  /* ---------- 记账 ---------- */
  check('能切到记账', clickButton(window, '记账'));
  await wait(700);
  check('记账页有月度汇总', textOf(window).includes('本月支出') && textOf(window).includes('月度预算'));
  check('记账页有流水', textOf(window).includes('午饭') || textOf(window).includes('楼下小面馆'));
  check('记账页有分类占比图', !!window.document.querySelector('.donut'));
  check('记账页有趋势图', !!window.document.querySelector('.trend'));
  check('记账页有分类筛选', window.document.querySelectorAll('.cat-chips .chip-btn').length > 3);

  const amount = window.document.querySelector('.txn-add .amount-input input');
  let txnAdded = false;
  if (amount) {
    setValue(window, amount, '25.5');
    await wait(80);
    window.document.querySelector('.txn-add .primary-btn').click();
    await wait(500);
    txnAdded = store.txns.some((t) => t.amountCents === 2550);
  }
  check('能记一笔账', txnAdded);

  /* ---------- 日程 ---------- */
  check('能切到日程', clickButton(window, '日程'));
  await wait(700);
  check('日程页有月历格子', window.document.querySelectorAll('.month-cell').length === 42);
  check('日程页显示事件', textOf(window).includes('和设计对齐视觉稿'));
  check('日程页显示待办截止', window.document.querySelectorAll('.cell-item.todo').length > 0);
  const todayCell = [...window.document.querySelectorAll('.month-cell')].find((c) => c.classList.contains('today'));
  if (todayCell) todayCell.click();
  await wait(450);
  check('点日期能开当天面板', !!window.document.querySelector('.drawer'));
  const closePanel = window.document.querySelector('.drawer .icon-btn');
  if (closePanel) closePanel.click();
  await wait(300);

  const newEventBtn = [...window.document.querySelectorAll('button')].find((b) => b.textContent.includes('新日程'));
  if (newEventBtn) newEventBtn.click();
  await wait(400);
  check('能打开日程编辑抽屉', !!window.document.querySelector('.drawer .title-field'));
  const evTitle = window.document.querySelector('.drawer .title-field');
  if (evTitle) setValue(window, evTitle, '晚上去跑步');
  await wait(200);
  const evSave = [...window.document.querySelectorAll('.drawer button')].find((b) => b.textContent.includes('创建日程'));
  if (evSave) evSave.click();
  await wait(500);
  check('能创建日程', store.events.some((e) => e.title === '晚上去跑步'));

  check('周视图可切换', clickButton(window, '周'));
  await wait(500);
  check('周视图有时间轴', !!window.document.querySelector('.week-grid'));
  check('列表视图可切换', clickButton(window, '列表'));
  await wait(500);
  check('列表视图有日程流', textOf(window).includes('接下来 30 天'));

  /* ---------- 灵感 ---------- */
  check('能切到灵感', clickButton(window, '灵感'));
  await wait(700);
  check('灵感页有笔记列表', textOf(window).includes('写周报的一个角度'));
  check('灵感页有标签', textOf(window).includes('工作'));

  const noteTitle = window.document.querySelector('.note-title');
  let noteEdited = false;
  if (noteTitle) {
    setValue(window, noteTitle, '改过的笔记标题');
    await wait(1000);
    noteEdited = store.notes.some((n) => n.title === '改过的笔记标题');
  }
  check('笔记标题能自动保存', noteEdited);

  const previewBtn = [...window.document.querySelectorAll('.md-toolbar .seg-item')].find((b) => b.textContent.trim() === '预览');
  if (previewBtn) previewBtn.click();
  await wait(350);
  check('能切到 Markdown 预览', !!window.document.querySelector('.md-preview'));

  check('能新建笔记', clickButton(window, '新笔记'));
  await wait(350);
  check('新建后进入编辑态', !!window.document.querySelector('.md-area'));

  /* ---------- 设置 / 搜索 ---------- */
  const gear = window.document.querySelectorAll('.top-actions .icon-btn');
  if (gear.length >= 2) gear[1].click();
  await wait(350);
  check('设置面板能打开', !!window.document.querySelector('.settings'));
  const closeSettings = window.document.querySelector('.settings .icon-btn');
  if (closeSettings) closeSettings.click();
  await wait(250);

  window.document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
  await wait(350);
  check('Ctrl+K 能开搜索', !!window.document.querySelector('.palette'));
  const searchInput = window.document.querySelector('.palette-input input');
  let searchHits = 0;
  if (searchInput) {
    setValue(window, searchInput, '牙科');
    await wait(450);
    searchHits = window.document.querySelectorAll('.palette-row').length;
  }
  check('搜索能出结果', searchHits > 0, `${searchHits} 条`);

  check('主窗口没有运行期报错', app.errors.length === 0, app.errors.slice(0, 3).join(' | '));
  check('数据没被测试弄脏（仍是 3 个清单）', store.lists.length === 3);

  /* ---------- 快速记录小窗 ---------- */
  const quickStore = createStore();
  const qwin = boot({ htmlFile: 'quick.html', bundleCode: quickBundle, store: quickStore });
  await wait(500);
  check('快速记录窗挂载', !!qwin.window.document.querySelector('.quick'));
  const qinput = qwin.window.document.querySelector('.quick-input');
  let quickSaved = false;
  if (qinput) {
    setValue(qwin.window, qinput, '随手记一条灵感');
    qinput.dispatchEvent(new qwin.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await wait(350);
    quickSaved = quickStore.notes.some((n) => n.title === '随手记一条灵感');
  }
  check('快记回车能存成灵感', quickSaved);

  /* ---------- 输出 ---------- */
  let pass = 0;
  for (const item of report) {
    if (item.ok) pass += 1;
    console.log(`${item.ok ? '  ✔' : '  ✘'} ${item.label}${item.detail ? ' — ' + item.detail : ''}`);
  }
  console.log(`\n${pass}/${report.length} 通过`);
  process.exit(pass === report.length ? 0 : 1);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
