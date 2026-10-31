/**
 * 渲染进程访问主进程的唯一入口。
 * 主进程返回 { ok, data } 或 { ok:false, error }，这里统一抛出中文错误。
 */
export async function call(method, payload = {}) {
  const res = await window.linsssside.call(method, payload);
  if (!res || res.ok !== true) {
    const err = new Error((res && res.error && res.error.message) || '操作失败');
    err.code = res && res.error && res.error.code;
    throw err;
  }
  return res.data;
}

export const api = {
  authStatus: () => call('auth.status'),
  authUnlock: (password) => call('auth.unlock', { password }),
  authSetup: (password) => call('auth.setup', { password }),
  authChange: (current, next) => call('auth.change', { current, next }),
  authDisable: (password) => call('auth.disable', { password }),

  lists: () => call('lists.list'),
  createList: (name, color) => call('lists.create', { name, color }),
  updateList: (id, patch) => call('lists.update', { id, patch }),
  removeList: (id) => call('lists.remove', { id }),

  todos: (options) => call('todos.list', options),
  todo: (id) => call('todos.get', { id }),
  createTodo: (payload) => call('todos.create', payload),
  updateTodo: (id, patch) => call('todos.update', { id, patch }),
  toggleTodo: (id, done) => call('todos.toggle', { id, done }),
  removeTodo: (id) => call('todos.remove', { id }),
  reorderTodos: (ids) => call('todos.reorder', { ids }),

  dayGet: (date) => call('days.get', { date }),
  daySet: (date, label) => call('days.set', { date, label }),

  settings: () => call('settings.all'),
  setSetting: (key, value) => call('settings.set', { key, value }),
  overview: () => call('overview.get'),
  search: (q) => call('search.query', { q }),
  exportAll: () => call('export.run'),
  appInfo: () => call('app.info'),
  openDataDir: () => call('app.openDataDir'),
  reveal: (target) => call('app.revealPath', { target }),

  /* ---------------- 记账 ---------------- */
  moneyCategories: () => call('money.categories'),
  saveCategory: (payload) => call('money.category.save', payload),
  removeCategory: (id) => call('money.category.remove', { id }),
  txns: (options) => call('money.list', options),
  recentTxns: (limit) => call('money.recent', { limit }),
  createTxn: (payload) => call('money.create', payload),
  updateTxn: (id, patch) => call('money.update', { id, patch }),
  removeTxn: (id) => call('money.remove', { id }),
  moneySummary: (month) => call('money.summary', { month }),
  setBudget: (yuan) => call('money.setBudget', { yuan }),

  /* ---------------- 日程 ---------------- */
  events: (from, to) => call('events.list', { from, to }),
  eventGet: (id) => call('events.get', { id }),
  createEvent: (payload) => call('events.create', payload),
  updateEvent: (id, patch) => call('events.update', { id, patch }),
  removeEvent: (id) => call('events.remove', { id }),
  agenda: (from, to) => call('agenda.get', { from, to }),

  /* ---------------- 灵感 ---------------- */
  notes: (options) => call('notes.list', options),
  noteTags: () => call('notes.tags'),
  noteGet: (id) => call('notes.get', { id }),
  saveNote: (payload) => call('notes.save', payload),
  patchNote: (id, patch) => call('notes.patch', { id, patch }),
  removeNote: (id) => call('notes.remove', { id }),
  noteToTodo: (id) => call('notes.toTodo', { id }),
  saveAttachment: (dataUrl, name) => call('files.saveAttachment', { dataUrl, name }),
  readAttachments: (paths) => call('files.readAttachments', { paths }),

  /* ---------------- 快速记录 ---------------- */
  quickAdd: (type, text) => call('quick.add', { type, text }),
};
