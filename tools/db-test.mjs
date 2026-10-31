/**
 * 后端逻辑测试：直接跑 electron/db.js + electron/ipc.js（不启动 Electron）。
 *
 *   node tools/db-test.mjs
 */

import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const { Database } = require(path.join(root, 'electron', 'db.js'));
const { createApi } = require(path.join(root, 'electron', 'ipc.js'));

const tmpDir = path.join(root, '.tmp-data');
fs.rmSync(tmpDir, { recursive: true, force: true });

const fakeApp = { getVersion: () => '0.1.0', isPackaged: false, quit: () => {} };
const fakeShell = { openPath: () => {}, showItemInFolder: () => {} };

const failures = [];
const pass = [];
const expect = (label, condition, detail = '') => {
  if (condition) pass.push(label);
  else failures.push(`${label}${detail ? ' — ' + detail : ''}`);
};

const run = async () => {
  const db = await new Database(tmpDir).open();
  const api = createApi({ db, app: fakeApp, shell: fakeShell, dataDir: tmpDir, getWindow: () => null });

  const lists = api.invoke('lists.list');
  expect('默认清单建好了', lists.length === 3 && lists[0].name === '收件箱', JSON.stringify(lists.map((l) => l.name)));

  const inbox = lists[0];

  /* ---------- 待办 ---------- */
  const todo = api.invoke('todos.create', { title: '写周报', listId: inbox.id, priority: 2, dueAt: '2026-10-31', allDay: true });
  expect('新增待办返回实体', !!todo && todo.id > 0);
  expect('新增待办字段正确', todo.title === '写周报' && todo.priority === 2 && todo.dueAt === '2026-10-31');

  api.invoke('todos.update', { id: todo.id, patch: { title: '写周报（周四）', note: '带上数据' } });
  const updated = api.invoke('todos.get', { id: todo.id });
  expect('更新待办生效', updated.title === '写周报（周四）' && updated.note === '带上数据');

  const sub = api.invoke('todos.create', { title: '整理数据', parentId: todo.id, listId: inbox.id });
  const withSubs = api.invoke('todos.get', { id: todo.id });
  expect('子任务挂到父任务下', withSubs.subtasks.length === 1 && withSubs.subTotal === 1);

  api.invoke('todos.toggle', { id: todo.id, done: true });
  const afterDone = api.invoke('todos.get', { id: todo.id });
  expect('完成父任务时子任务一起完成', afterDone.doneAt && afterDone.subtasks.every((s) => s.doneAt));

  const openOnly = api.invoke('todos.list', { view: 'all' });
  expect('已完成的不出现在未完成列表', openOnly.every((t) => !t.doneAt));

  const doneList = api.invoke('todos.list', { view: 'done' });
  // 已完成列表只列顶层待办（子任务在抽屉里看），所以这里应该正好 1 条
  expect('已完成列表能查到顶层完成项', doneList.length === 1, `实际 ${doneList.length}`);

  /* ---------- 重复任务 ---------- */
  const repeat = api.invoke('todos.create', {
    title: '每天喝水',
    listId: inbox.id,
    dueAt: '2026-10-31',
    allDay: true,
    repeatFreq: 'daily',
    repeatInterval: 1,
  });
  api.invoke('todos.toggle', { id: repeat.id, done: true });
  const all = api.invoke('todos.list', { view: 'all' });
  const nextOne = all.find((t) => t.title === '每天喝水');
  expect('重复任务完成后自动生成下一次', !!nextOne && nextOne.dueAt === '2026-11-01', nextOne && nextOne.dueAt);

  /* ---------- 按月重复的边界 ---------- */
  const monthly = api.invoke('todos.create', {
    title: '房租',
    dueAt: '2026-01-31',
    allDay: true,
    repeatFreq: 'monthly',
  });
  api.invoke('todos.toggle', { id: monthly.id, done: true });
  const rent = api.invoke('todos.list', { view: 'all' }).find((t) => t.title === '房租');
  expect('1 月 31 日按月重复落到 2 月最后一天', rent && rent.dueAt === '2026-02-28', rent && rent.dueAt);

  /* ---------- 视图筛选 ---------- */
  api.invoke('todos.create', { title: '今天的事', dueAt: new Date().toISOString().slice(0, 10), allDay: true });
  api.invoke('todos.create', { title: '下周的事', dueAt: '2099-01-01', allDay: true });
  api.invoke('todos.create', { title: '没定时间的事' });
  const todayView = api.invoke('todos.list', { view: 'today' }).map((t) => t.title);
  const upcoming = api.invoke('todos.list', { view: 'upcoming' }).map((t) => t.title);
  const inboxView = api.invoke('todos.list', { view: 'inbox' }).map((t) => t.title);
  expect('今天视图只含今天及过期', todayView.includes('今天的事') && !todayView.includes('下周的事'));
  expect('即将视图只含未来', upcoming.includes('下周的事') && !upcoming.includes('今天的事'));
  expect('收件箱视图只含无日期', inboxView.includes('没定时间的事'));

  const searched = api.invoke('search.query', { q: '房租' });
  expect('搜索能搜到待办', searched.todos.some((t) => t.title === '房租'));

  /* ---------- 排序 ---------- */
  const ids = api.invoke('todos.list', { view: 'all' }).map((t) => t.id).reverse();
  api.invoke('todos.reorder', { ids });
  const reordered = api.invoke('todos.list', { view: 'all' }).map((t) => t.id);
  expect('拖拽排序结果被保存', reordered[0] === ids[0], `${reordered[0]} vs ${ids[0]}`);

  /* ---------- 清单 ---------- */
  const work = lists.find((l) => l.name === '工作');
  const moved = api.invoke('todos.create', { title: '项目复盘', listId: work.id });
  api.invoke('lists.remove', { id: work.id });
  const orphan = api.invoke('todos.get', { id: moved.id });
  expect('删清单时待办回到收件箱', orphan.listId === inbox.id);

  /* ---------- 每天的名字 ---------- */
  api.invoke('days.set', { date: '2026-10-31', label: '自信绽放日' });
  expect('每日命名能存', api.invoke('days.get', { date: '2026-10-31' }).label === '自信绽放日');
  api.invoke('days.set', { date: '2026-10-31', label: '  ' });
  expect('清空名字会删掉记录', api.invoke('days.get', { date: '2026-10-31' }) === null);

  const overview = api.invoke('overview.get');
  expect('概览带今日计数', typeof overview.counts.openToday === 'number' && !!overview.date);

  /* ---------- 设置与密码 ---------- */
  api.invoke('settings.set', { key: 'theme', value: 'dark' });
  expect('设置可读写', api.invoke('settings.all').theme === 'dark');

  api.invoke('auth.setup', { password: 'abc123' });
  expect('设置密码后处于解锁态', api.invoke('auth.status').unlocked === true);
  api.invoke('auth.lock');
  expect('锁定后状态正确', api.invoke('auth.status').unlocked === false);

  let blocked = false;
  try {
    api.invoke('todos.list', { view: 'all' });
  } catch (err) {
    blocked = err.code === 'LOCKED';
  }
  expect('锁定时业务接口被拦住', blocked);

  let wrong = false;
  try {
    api.invoke('auth.unlock', { password: 'wrong' });
  } catch (err) {
    wrong = true;
  }
  expect('错密码解不开', wrong);
  api.invoke('auth.unlock', { password: 'abc123' });
  expect('对的密码能解开', api.invoke('auth.status').unlocked === true);

  /* ---------- 记账 ---------- */
  const cats = api.invoke('money.categories');
  expect('默认分类已建好', cats.length === 12 && cats.some((c) => c.name === '餐饮'), `${cats.length} 个`);
  const food = cats.find((c) => c.name === '餐饮');
  const salary = cats.find((c) => c.name === '工资');

  api.invoke('money.create', { kind: 'expense', amountCents: 1850, categoryId: food.id, occurredOn: '2026-10-30', note: '楼下面馆' });
  api.invoke('money.create', { kind: 'expense', amountCents: 3000, categoryId: food.id, occurredOn: '2026-10-31', note: '和朋友吃饭' });
  api.invoke('money.create', { kind: 'income', amountCents: 1200000, categoryId: salary.id, occurredOn: '2026-10-01', note: '十月工资' });

  const oct = api.invoke('money.list', { month: '2026-10' });
  expect('按月查账', oct.length === 3, `实际 ${oct.length}`);

  const sum = api.invoke('money.summary', { month: '2026-10' });
  expect('月度支出合计正确', sum.expenseCents === 4850, `${sum.expenseCents}`);
  expect('月度收入合计正确', sum.incomeCents === 1200000);
  expect('分类占比有餐饮', sum.byCategory[0].name === '餐饮' && sum.byCategory[0].totalCents === 4850);
  expect('趋势返回 6 个月', sum.trend.length === 6);

  api.invoke('money.setBudget', { yuan: 3000 });
  expect('预算能存下', api.invoke('money.summary', { month: '2026-10' }).budgetCents === 300000);

  const txnId = oct.find((t) => t.note === '楼下面馆').id;
  api.invoke('money.update', { id: txnId, patch: { amountCents: 2000 } });
  expect('改金额生效', api.invoke('money.list', { month: '2026-10' }).find((t) => t.id === txnId).amountCents === 2000);

  const newCat = api.invoke('money.category.save', { name: '宠物', kind: 'expense', icon: '🐱', color: '#B96BE0' });
  expect('能新增分类', !!newCat.id);
  api.invoke('money.category.remove', { id: newCat.id });
  expect('删分类后分类消失', api.invoke('money.categories').every((c) => c.name !== '宠物'));

  /* ---------- 日程 ---------- */
  const ev = api.invoke('events.create', {
    title: '每周复盘',
    startAt: '2026-10-05T20:00',
    endAt: '2026-10-05T21:00',
    repeatFreq: 'weekly',
    remindBefore: 15,
  });
  expect('事件创建成功', !!ev.id);

  const expanded = api.invoke('events.list', { from: '2026-10-01', to: '2026-10-31' });
  const weeklyHits = expanded.filter((e) => e.title === '每周复盘');
  expect('重复事件被展开成 4 次', weeklyHits.length === 4, `实际 ${weeklyHits.length}`);
  expect('展开保留时长', weeklyHits[0].endAt.includes('T21:00'));

  api.invoke('events.update', { id: ev.id, patch: { title: '每周复盘（改）' } });
  expect('改事件标题生效', api.invoke('events.get', { id: ev.id }).title === '每周复盘（改）');

  const agenda = api.invoke('agenda.get', { from: '2026-10-01', to: '2026-10-31' });
  expect('日历合并了待办截止', agenda.todos.length > 0 || agenda.events.length > 0);
  expect('日历带每天的名字', Array.isArray(agenda.days));

  api.invoke('events.remove', { id: ev.id });
  expect('删事件生效', api.invoke('events.get', { id: ev.id }) === null);

  /* ---------- 灵感 ---------- */
  const note = api.invoke('notes.save', {
    title: '写周报的角度',
    content: '从**数据**说起。\n\n- 结论先行\n- 再讲过程',
    tags: '工作,写作',
  });
  expect('笔记保存成功', !!note.id);

  const noteList = api.invoke('notes.list', {});
  expect('笔记列表能查到', noteList.some((n) => n.id === note.id));
  expect('标签能聚合', api.invoke('notes.tags').some((t) => t.name === '工作'));

  api.invoke('notes.patch', { id: note.id, patch: { pinned: true } });
  expect('置顶生效', api.invoke('notes.get', { id: note.id }).pinned === true);

  const todoFromNote = api.invoke('notes.toTodo', { id: note.id });
  expect('笔记能转成待办', todoFromNote.todoId > 0);

  const att = api.invoke('files.saveAttachment', {
    name: 'shot',
    dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  });
  expect('附件写入本地目录', fs.existsSync(path.join(tmpDir, att.path)));
  const read = api.invoke('files.readAttachments', { paths: [att.path] });
  expect('附件能读成 data URL', String(read[att.path] || '').startsWith('data:image/png'));

  /* ---------- 快速记录 ---------- */
  const q1 = api.invoke('quick.add', { type: 'note', text: '地铁上想到的点子' });
  const q2 = api.invoke('quick.add', { type: 'todo', text: '买猫粮' });
  const q3 = api.invoke('quick.add', { type: 'money', text: '18 早餐' });
  expect('快记存成灵感', q1.kind === 'note');
  expect('快记存成待办', q2.kind === 'todo');
  expect('快记解析金额', q3.kind === 'money' && q3.amount === 18);
  expect('快记的支出进了账本', api.invoke('money.list', { month: '2026-10' }).some((t) => t.note === '早餐'));

  const globalSearch = api.invoke('search.query', { q: '数据' });
  expect('全局搜索能搜到笔记', globalSearch.notes.length > 0);
  const moneySearch = api.invoke('search.query', { q: '面馆' });
  expect('全局搜索能搜到账目', moneySearch.txns.length > 0);

  /* ---------- 导出 ---------- */
  const exported = api.invoke('export.run');
  const files = fs.readdirSync(exported.dir);
  expect('导出目录有 3 个文件', files.length === 3, files.join(','));
  const json = JSON.parse(fs.readFileSync(path.join(exported.dir, '全部数据.json'), 'utf8'));
  expect('导出的 JSON 结构完整', Array.isArray(json.data.todos) && json.data.todos.length > 0);
  expect('导出包含账单和笔记', json.data.txns.length > 0 && json.data.notes.length > 0);
  const csv = fs.readFileSync(path.join(exported.dir, '账单.csv'), 'utf8');
  expect('账单 CSV 带表头', csv.includes('日期') && csv.includes('金额'));
  expect('账单 CSV 有真实数据', csv.includes('楼下面馆'));

  /* ---------- 落盘与重开 ---------- */
  db.flush();
  const dbFile = path.join(tmpDir, 'life.db');
  expect('数据库文件已写盘', fs.existsSync(dbFile) && fs.statSync(dbFile).size > 0);
  const head = fs.readFileSync(dbFile).subarray(0, 15).toString('utf8');
  expect('文件是标准 SQLite 格式', head.startsWith('SQLite format 3'), head);

  db.close();
  const db2 = await new Database(tmpDir).open();
  const api2 = createApi({ db: db2, app: fakeApp, shell: fakeShell, dataDir: tmpDir, getWindow: () => null });
  expect('重启后默认是锁定状态', api2.invoke('auth.status').unlocked === false);
  api2.invoke('auth.unlock', { password: 'abc123' });
  const reopened = api2.invoke('todos.list', { view: 'all' });
  expect('重开数据库数据还在', reopened.length > 0);
  expect('密码设置持久化', api2.invoke('auth.status').enabled === true);
  db2.close();

  /* ---------- 输出 ---------- */
  pass.forEach((label) => console.log('  ✔ ' + label));
  failures.forEach((label) => console.log('  ✘ ' + label));
  console.log(`\n${pass.length}/${pass.length + failures.length} 通过`);
  process.exit(failures.length === 0 ? 0 : 1);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
