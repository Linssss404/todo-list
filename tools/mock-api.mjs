/**
 * 测试与预览共用的假后端：结构严格对齐 electron/ipc.js 的返回，方便离线跑界面。
 */

export const pad = (n) => String(n).padStart(2, '0');

const now = new Date();
export const TODAY = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
const shift = (days) => {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export function createStore() {
  return {
    theme: 'light',
    lists: [
      { id: 1, name: '收件箱', color: '#7C5CFF', sort: 0 },
      { id: 2, name: '工作', color: '#4C9AFF', sort: 1024 },
      { id: 3, name: '生活', color: '#3FBF9F', sort: 2048 },
    ],
    todos: [
      { id: 11, listId: 1, title: '把周报写完，附上三张数据图', note: '重点写清楚三个结论', priority: 3, dueAt: `${TODAY}T18:00`, allDay: false, doneAt: null, sort: 1024, subTotal: 3, subDone: 1, listName: '工作', repeatFreq: 'weekly', repeatInterval: 1 },
      { id: 12, listId: 2, title: '给妈妈打个视频电话', note: '', priority: 2, dueAt: TODAY, allDay: true, doneAt: null, sort: 2048, subTotal: 0, subDone: 0, listName: '收件箱', repeatFreq: null },
      { id: 13, listId: 3, title: '把旅行照片导出来，挑九张洗出来', note: '', priority: 0, dueAt: null, allDay: false, doneAt: null, sort: 3072, subTotal: 0, subDone: 0, listName: '生活' },
      { id: 14, listId: 1, title: '预约下周三的牙科', note: '', priority: 3, dueAt: `${shift(4)}T09:30`, allDay: false, doneAt: null, sort: 4096, subTotal: 0, subDone: 0, listName: '收件箱' },
      { id: 15, listId: 3, title: '读完《城市与狗》剩下的四十页', note: '', priority: 1, dueAt: shift(1), allDay: true, doneAt: null, sort: 5120, subTotal: 0, subDone: 0, listName: '生活', repeatFreq: 'daily' },
      { id: 16, listId: 2, title: '整理这周的灵感碎片', note: '', priority: 0, dueAt: TODAY, allDay: true, doneAt: null, sort: 6144, subTotal: 0, subDone: 0, listName: '工作' },
      { id: 17, listId: 2, title: '回复设计稿的两条批注', note: '', priority: 2, dueAt: TODAY, allDay: true, doneAt: null, sort: 7168, subTotal: 0, subDone: 0, listName: '工作' },
      { id: 18, listId: 3, title: '早上跑了三公里', note: '', priority: 0, dueAt: null, doneAt: `${TODAY}T07:20`, sort: 8192, subTotal: 0, subDone: 0, listName: '生活' },
      { id: 19, listId: 2, title: '把上周的会议纪要归档', note: '', priority: 0, dueAt: null, doneAt: `${TODAY}T09:05`, sort: 9216, subTotal: 0, subDone: 0, listName: '工作' },
    ],
    subtasks: [
      { id: 101, parentId: 11, title: '导出三张图', doneAt: `${TODAY}T10:00`, listName: '工作' },
      { id: 102, parentId: 11, title: '写完结论部分', doneAt: null, listName: '工作' },
      { id: 103, parentId: 11, title: '通读一遍', doneAt: null, listName: '工作' },
    ],
    categories: [
      { id: 1, name: '餐饮', kind: 'expense', icon: '🍜', color: '#F0748C', sort: 0 },
      { id: 2, name: '交通', kind: 'expense', icon: '🚕', color: '#4C9AFF', sort: 1024 },
      { id: 3, name: '购物', kind: 'expense', icon: '🛍️', color: '#B96BE0', sort: 2048 },
      { id: 4, name: '居住', kind: 'expense', icon: '🏠', color: '#3FBF9F', sort: 3072 },
      { id: 5, name: '娱乐', kind: 'expense', icon: '🎬', color: '#F0A44B', sort: 4096 },
      { id: 6, name: '工资', kind: 'income', icon: '💼', color: '#3FBF9F', sort: 0 },
    ],
    txns: [
      { id: 21, kind: 'expense', amountCents: 1850, categoryId: 1, categoryName: '餐饮', categoryIcon: '🍜', categoryColor: '#F0748C', occurredOn: TODAY, merchant: '楼下小面馆', note: '午饭', tags: '', createdAt: `${TODAY}T12:10` },
      { id: 22, kind: 'expense', amountCents: 3200, categoryId: 2, categoryName: '交通', categoryIcon: '🚕', categoryColor: '#4C9AFF', occurredOn: TODAY, merchant: '', note: '打车去客户那边', tags: '工作', createdAt: `${TODAY}T09:20` },
      { id: 23, kind: 'expense', amountCents: 12800, categoryId: 3, categoryName: '购物', categoryIcon: '🛍️', categoryColor: '#B96BE0', occurredOn: shift(-1), merchant: '', note: '换季买了两件衬衫', tags: '', createdAt: `${shift(-1)}T20:00` },
      { id: 24, kind: 'expense', amountCents: 8600, categoryId: 5, categoryName: '娱乐', categoryIcon: '🎬', categoryColor: '#F0A44B', occurredOn: shift(-2), merchant: '', note: '两张电影票', tags: '', createdAt: `${shift(-2)}T19:00` },
      { id: 25, kind: 'expense', amountCents: 260000, categoryId: 4, categoryName: '居住', categoryIcon: '🏠', categoryColor: '#3FBF9F', occurredOn: `${TODAY.slice(0, 8)}03`, merchant: '', note: '房租', tags: '固定', createdAt: `${TODAY}T08:00` },
      { id: 26, kind: 'income', amountCents: 1200000, categoryId: 6, categoryName: '工资', categoryIcon: '💼', categoryColor: '#3FBF9F', occurredOn: `${TODAY.slice(0, 8)}01`, merchant: '', note: '这个月工资', tags: '', createdAt: `${TODAY}T09:00` },
    ],
    events: [
      { id: 31, key: '31@a', title: '和设计对齐视觉稿', note: '', startAt: `${TODAY}T10:00`, endAt: `${TODAY}T11:00`, allDay: false, repeatFreq: null, repeatInterval: 1, remindBefore: 15, color: '#7C5CFF' },
      { id: 32, key: '32@a', title: '牙科复查', note: '', startAt: `${shift(1)}T09:30`, endAt: `${shift(1)}T10:00`, allDay: false, repeatFreq: null, repeatInterval: 1, remindBefore: 30, color: '#4C9AFF' },
      { id: 33, key: '33@a', title: '每周复盘', note: '', startAt: `${shift(2)}T20:00`, endAt: `${shift(2)}T21:00`, allDay: false, repeatFreq: 'weekly', repeatInterval: 1, remindBefore: 15, color: '#9B7BF5' },
      { id: 34, key: '34@a', title: '妈妈生日', note: '', startAt: `${shift(5)}`, endAt: null, allDay: true, repeatFreq: 'yearly', repeatInterval: 1, remindBefore: 1440, color: '#F0748C' },
    ],
    notes: [
      { id: 41, title: '写周报的一个角度', content: '从**数据**说起，而不是从做了什么说起。\n\n- 结论先行\n- 再讲过程\n- 最后给下一步', tags: '工作,写作', attachments: [], pinned: true, archived: false, createdAt: `${TODAY}T08:00`, updatedAt: `${TODAY}T08:30`, excerpt: '从数据说起，而不是从做了什么说起。' },
      { id: 42, title: '周末想去的三个地方', content: '1. 城南那家旧书店\n2. 河边的新咖啡馆\n3. 山上的观景台', tags: '生活', attachments: [], pinned: false, archived: false, createdAt: `${shift(-1)}T21:00`, updatedAt: `${shift(-1)}T21:10`, excerpt: '城南那家旧书店 河边的新咖啡馆 山上的观景台' },
      { id: 43, title: '一句话记账的好处', content: '> 记账不是为了省钱，是为了知道钱去哪了。', tags: '想法', attachments: [], pinned: false, archived: false, createdAt: `${shift(-3)}T13:00`, updatedAt: `${shift(-3)}T13:05`, excerpt: '记账不是为了省钱，是为了知道钱去哪了。' },
    ],
    dayLabels: { [TODAY]: '自信绽放日' },
    budgetYuan: 3000,
  };
}

export function makeApi(store) {
  const month = TODAY.slice(0, 7);

  const moneySummary = (target = month) => {
    const rows = store.txns.filter((t) => t.occurredOn.slice(0, 7) === target);
    const expense = rows.filter((r) => r.kind === 'expense').reduce((s, r) => s + r.amountCents, 0);
    const income = rows.filter((r) => r.kind === 'income').reduce((s, r) => s + r.amountCents, 0);
    const map = new Map();
    for (const r of rows.filter((x) => x.kind === 'expense')) {
      const key = r.categoryId || 0;
      if (!map.has(key)) {
        map.set(key, { id: key, name: r.categoryName, icon: r.categoryIcon, color: r.categoryColor, totalCents: 0, count: 0 });
      }
      const entry = map.get(key);
      entry.totalCents += r.amountCents;
      entry.count += 1;
    }
    const trend = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      return {
        month: `${d.getFullYear()}-${pad(d.getMonth() + 1)}`,
        expenseCents: [180000, 240000, 152000, 298000, 210000, expense][i],
        incomeCents: i === 5 ? income : 1200000,
      };
    });
    return {
      month: target,
      expenseCents: expense,
      incomeCents: income,
      todayCents: store.txns
        .filter((t) => t.kind === 'expense' && t.occurredOn === TODAY)
        .reduce((s, t) => s + t.amountCents, 0),
      count: rows.length,
      budgetCents: store.budgetYuan * 100,
      byCategory: [...map.values()].sort((a, b) => b.totalCents - a.totalCents),
      trend,
    };
  };

  const inMonth = (t) => !t.month || t.occurredOn.slice(0, 7) === t.month;

  return {
    'auth.status': () => ({ enabled: false, unlocked: true }),
    'auth.unlock': () => ({ unlocked: true }),
    'auth.setup': () => ({ enabled: true }),
    'auth.change': () => true,
    'auth.disable': () => true,
    'lists.list': () => store.lists,
    'lists.create': ({ name, color }) => {
      const created = { id: 90, name, color, sort: 9000 };
      store.lists.push(created);
      return created;
    },
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
      return todo ? { ...todo, subtasks: store.subtasks.filter((s) => s.parentId === id) } : null;
    },
    'todos.subtasks': ({ id }) => store.subtasks.filter((s) => s.parentId === id),
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
        sort: 99999,
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
      if (todo) todo.doneAt = done ? `${TODAY}T10:00` : null;
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
    'settings.all': () => ({ theme: store.theme, budget: store.budgetYuan }),
    'settings.set': ({ key, value }) => {
      if (key === 'theme') store.theme = value;
      return true;
    },

    'money.categories': () => store.categories,
    'money.category.save': (payload) => ({ id: 999, ...payload }),
    'money.category.remove': () => true,
    'money.list': ({ month: m, kind, categoryId } = {}) =>
      store.txns.filter((t) => inMonth({ month: m, occurredOn: t.occurredOn }) && (!kind || t.kind === kind) && (!categoryId || t.categoryId === categoryId)),
    'money.recent': () => store.txns.slice(0, 5),
    'money.summary': ({ month: m } = {}) => moneySummary(m || month),
    'money.create': (payload) => {
      const cat = store.categories.find((c) => c.id === payload.categoryId) || store.categories[0];
      const created = {
        id: 200 + store.txns.length,
        ...payload,
        categoryName: cat.name,
        categoryIcon: cat.icon,
        categoryColor: cat.color,
        merchant: payload.merchant || '',
        tags: payload.tags || '',
      };
      store.txns.push(created);
      return created;
    },
    'money.update': ({ id, patch }) => {
      const txn = store.txns.find((t) => t.id === id);
      if (txn) Object.assign(txn, patch);
      return txn;
    },
    'money.remove': () => true,
    'money.setBudget': ({ yuan }) => {
      store.budgetYuan = yuan;
      return { budgetCents: yuan * 100 };
    },

    'events.list': ({ from, to }) => store.events.filter((e) => e.startAt >= from && e.startAt <= `${to}T23:59`),
    'events.get': ({ id }) => store.events.find((e) => e.id === id) || null,
    'events.create': (payload) => {
      const created = { id: 300, key: '300@a', ...payload };
      store.events.push(created);
      return created;
    },
    'events.update': ({ id, patch }) => {
      const ev = store.events.find((e) => e.id === id);
      if (ev) Object.assign(ev, patch);
      return ev;
    },
    'events.remove': () => true,
    'agenda.get': ({ from, to }) => ({
      events: store.events
        .filter((e) => e.startAt >= from && e.startAt <= `${to}T23:59`)
        .sort((a, b) => a.startAt.localeCompare(b.startAt)),
      todos: store.todos
        .filter((t) => t.dueAt && t.dueAt.slice(0, 10) >= from && t.dueAt.slice(0, 10) <= to)
        .map((t) => ({
          id: t.id,
          title: t.title,
          dueAt: t.dueAt,
          allDay: t.allDay,
          doneAt: t.doneAt,
          priority: t.priority,
          listName: t.listName,
          listColor: store.lists.find((l) => l.id === t.listId)?.color || '#7C5CFF',
        })),
      days: Object.entries(store.dayLabels).map(([date, label]) => ({ date, label })),
      from,
      to,
      today: TODAY,
    }),

    'notes.list': ({ q = '', tag = '', archived = false } = {}) =>
      store.notes
        .filter(
          (n) =>
            !!n.archived === !!archived &&
            (!q || n.title.includes(q) || n.content.includes(q)) &&
            (!tag || String(n.tags).includes(tag))
        )
        .sort((a, b) => Number(b.pinned) - Number(a.pinned) || String(b.updatedAt).localeCompare(String(a.updatedAt))),
    'notes.tags': () => {
      const map = new Map();
      store.notes.forEach((n) =>
        String(n.tags || '')
          .split(',')
          .filter(Boolean)
          .forEach((t) => map.set(t.trim(), (map.get(t.trim()) || 0) + 1))
      );
      return [...map.entries()].map(([name, count]) => ({ name, count }));
    },
    'notes.get': ({ id }) => store.notes.find((n) => n.id === id) || null,
    'notes.save': (payload) => {
      if (payload.id) {
        const note = store.notes.find((n) => n.id === payload.id);
        Object.assign(note, payload, { updatedAt: `${TODAY}T12:00` });
        return note;
      }
      const created = {
        id: 400 + store.notes.length,
        ...payload,
        createdAt: `${TODAY}T12:00`,
        updatedAt: `${TODAY}T12:00`,
        excerpt: String(payload.content || '').slice(0, 60),
      };
      store.notes.push(created);
      return created;
    },
    'notes.patch': ({ id, patch }) => {
      const note = store.notes.find((n) => n.id === id);
      if (note) Object.assign(note, patch);
      return note;
    },
    'notes.remove': ({ id }) => {
      store.notes = store.notes.filter((n) => n.id !== id);
      return true;
    },
    'notes.toTodo': ({ id }) => {
      const note = store.notes.find((n) => n.id === id);
      return { todoId: 999, title: note ? note.title : '' };
    },
    'files.saveAttachment': ({ name }) => ({ path: `attachments/${name}.png`, size: 1200 }),
    'files.readAttachments': () => ({}),

    'quick.add': ({ type, text }) => {
      if (type === 'todo') {
        store.todos.push({ id: 500, listId: 1, title: text, note: '', priority: 0, dueAt: null, allDay: false, doneAt: null, sort: 12000, subTotal: 0, subDone: 0, listName: '收件箱' });
        return { kind: 'todo', id: 500, text };
      }
      if (type === 'money') {
        const amount = Number((/^(\d+(?:\.\d{1,2})?)/.exec(text) || [])[1] || 0);
        store.txns.push({
          id: 501,
          kind: 'expense',
          amountCents: Math.round(amount * 100),
          categoryId: 1,
          categoryName: '餐饮',
          categoryIcon: '🍜',
          categoryColor: '#F0748C',
          occurredOn: TODAY,
          merchant: '',
          note: text,
          tags: '',
          createdAt: `${TODAY}T13:00`,
        });
        return { kind: 'money', id: 501, amount, note: text };
      }
      store.notes.push({ id: 502, title: text, content: '', tags: '', attachments: [], pinned: false, archived: false, createdAt: `${TODAY}T13:00`, updatedAt: `${TODAY}T13:00`, excerpt: '' });
      return { kind: 'note', id: 502, text };
    },

    'overview.get': () => {
      const summary = moneySummary();
      const todayExpense = store.txns
        .filter((t) => t.kind === 'expense' && t.occurredOn === TODAY)
        .reduce((s, t) => s + t.amountCents, 0);
      const upcoming = [
        ...store.events
          .filter((e) => e.startAt.slice(0, 10) >= TODAY && e.startAt.slice(0, 10) <= shift(7))
          .map((e) => ({ type: 'event', id: e.id, key: e.key, title: e.title, at: e.startAt, allDay: e.allDay, color: e.color })),
        ...store.todos
          .filter((t) => t.dueAt && !t.doneAt)
          .map((t) => ({ type: 'todo', id: t.id, key: `todo-${t.id}`, title: t.title, at: t.dueAt, allDay: t.allDay, color: '#7C5CFF' })),
      ]
        .sort((a, b) => String(a.at).localeCompare(String(b.at)))
        .slice(0, 6);
      return {
        date: TODAY,
        dayLabel: store.dayLabels[TODAY] ? { date: TODAY, label: store.dayLabels[TODAY] } : null,
        counts: {
          openToday: store.todos.filter((t) => !t.doneAt && t.dueAt && t.dueAt.slice(0, 10) <= TODAY).length,
          overdue: 0,
          doneToday: 2,
          openAll: store.todos.filter((t) => !t.doneAt).length,
        },
        money: summary,
        topCategory: summary.byCategory[0] || null,
        upcoming,
        notes: store.notes.slice(0, 3),
        todayExpense,
      };
    },

    'search.query': ({ q }) => ({
      todos: store.todos.filter((t) => t.title.includes(q)),
      days: Object.entries(store.dayLabels)
        .filter(([, label]) => label.includes(q))
        .map(([date, label]) => ({ date, label })),
      notes: store.notes.filter((n) => n.title.includes(q)),
      txns: store.txns.filter((t) => String(t.note).includes(q)),
      events: store.events.filter((e) => e.title.includes(q)),
    }),

    'export.run': () => ({ dir: 'data/exports', files: ['全部数据.json', '账单.csv', '待办.csv'] }),
    'app.info': () => ({ version: '0.2.0', dataDir: 'data', packaged: false, dbPath: 'data/life.db' }),
    'app.openDataDir': () => true,
    'app.revealPath': () => true,
  };
}
