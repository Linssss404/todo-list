'use strict';
/**
 * Linsssside 主进程
 * - 单实例、托盘常驻（关窗口不退出，方便准点弹提醒）
 * - 数据库初始化 + 定时检查到点待办
 * - 所有渲染进程请求走 ipcMain.handle('api:call')
 */

const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  Notification,
  ipcMain,
  nativeImage,
  shell,
  globalShortcut,
} = require('electron');
const path = require('path');
const fs = require('fs');

const { Database } = require('./db');
const { createApi } = require('./ipc');
const { parseDue } = require('./time');

const ROOT = path.join(__dirname, '..');

let win = null;
let tray = null;
let quickWin = null;
let quitting = false;
let db = null;
let api = null;
let scanTimer = null;
let trayHintShown = false;

function resolveDataDir() {
  if (!app.isPackaged) return path.join(ROOT, 'data');

  // 便携版：electron-builder 会把解压目录告诉我，数据要落回 exe 旁边
  // 绿色版 / 安装版：优先 exe 同级目录；安装在 Program Files 这种只读位置时退回 AppData
  const base = process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(app.getPath('exe'));
  const candidate = path.join(base, 'data');
  try {
    fs.mkdirSync(candidate, { recursive: true });
    fs.accessSync(candidate, fs.constants.W_OK);
    return candidate;
  } catch (_) {
    return path.join(app.getPath('userData'), 'data');
  }
}

function windowIcon() {
  const p = path.join(ROOT, 'build', 'icon.png');
  return fs.existsSync(p) ? nativeImage.createFromPath(p) : undefined;
}

function createWindow() {
  win = new BrowserWindow({
    width: 1320,
    height: 880,
    minWidth: 1080,
    minHeight: 700,
    show: false,
    backgroundColor: '#F5F2FF',
    title: 'Linsssside',
    icon: windowIcon(),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });

  win.loadFile(path.join(ROOT, 'dist', 'index.html'));

  // 开发期自检模式：不开窗口，直接把界面截图存成 PNG
  //   set LINSSSSIDE_SHOT=out.png && electron .
  if (process.env.LINSSSSIDE_SHOT) {
    win.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        try {
          const image = await win.webContents.capturePage();
          fs.writeFileSync(path.resolve(process.env.LINSSSSIDE_SHOT), image.toPNG());
          console.log('[shot] saved', process.env.LINSSSSIDE_SHOT);
        } catch (err) {
          console.error('[shot]', err);
        }
        quitting = true;
        app.quit();
      }, 1800);
    });
    return;
  }

  win.once('ready-to-show', () => win.show());

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.on('close', (event) => {
    if (quitting) return;
    event.preventDefault();
    win.hide();
    if (!trayHintShown && Notification.isSupported()) {
      trayHintShown = true;
      new Notification({
        title: 'Linsssside 还在后台',
        body: '窗口已收进托盘，到点的待办仍会提醒你。',
        silent: true,
      }).show();
    }
  });

  win.on('closed', () => { win = null; });
}

function showWindow() {
  if (!win) {
    createWindow();
    return;
  }
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function createTray() {
  const iconPath = path.join(ROOT, 'build', 'tray.png');
  const image = fs.existsSync(iconPath)
    ? nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
    : nativeImage.createEmpty();

  tray = new Tray(image);
  tray.setToolTip('Linsssside · 个人生活助手');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '打开 Linsssside', click: showWindow },
    { label: '快速记录  Ctrl+Alt+Space', click: () => toggleQuick() },
    { type: 'separator' },
    { label: '退出', click: () => { quitting = true; app.quit(); } },
  ]));
  tray.on('click', showWindow);
  tray.on('double-click', showWindow);
}

/** 快速记录小窗：一个快捷键，写一句话就能存成灵感 / 待办 / 支出 */
function createQuickWindow() {
  quickWin = new BrowserWindow({
    width: 540,
    height: 208,
    frame: false,
    resizable: false,
    movable: true,
    show: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    backgroundColor: '#1b1430',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  quickWin.loadFile(path.join(ROOT, 'dist', 'quick.html'));
  quickWin.on('blur', () => quickWin && quickWin.hide());
  quickWin.on('close', (event) => {
    if (quitting) return;
    event.preventDefault();
    quickWin.hide();
  });
}

function toggleQuick() {
  if (!quickWin) {
    createQuickWindow();
    // 第一次还没渲染完，等加载好再显示，避免闪一下白屏
    quickWin.webContents.once('did-finish-load', () => {
      quickWin.center();
      quickWin.show();
      quickWin.focus();
      quickWin.webContents.send('quick:reset');
    });
    return;
  }
  if (quickWin.isVisible()) {
    quickWin.hide();
    return;
  }
  quickWin.center();
  quickWin.show();
  quickWin.focus();
  quickWin.webContents.send('quick:reset');
}

/** 每 20 秒看一次有没有到点的待办和日程 */
function startReminderLoop() {
  const scan = () => {
    try {
      const now = new Date();
      const rows = db.all(
        `SELECT id, title, due_at, remind_at, all_day FROM todos
         WHERE parent_id IS NULL AND done_at IS NULL AND reminded = 0
           AND IFNULL(remind_at, due_at) IS NOT NULL`
      );
      for (const row of rows) {
        // 全天待办没有具体时间，不弹通知，避免半夜轰炸
        if (row.all_day && !row.remind_at) continue;
        const due = parseDue(row.remind_at || row.due_at);
        if (!due || due > now) continue;
        // 过期太久的（超过 12 小时）静默跳过，只标成已提醒
        const late = now.getTime() - due.getTime();
        db.run('UPDATE todos SET reminded = 1 WHERE id = ?', [row.id]);
        if (late > 12 * 60 * 60 * 1000) continue;
        if (!Notification.isSupported()) continue;
        const n = new Notification({
          title: '该做这件事了',
          body: row.title,
          silent: false,
        });
        n.on('click', () => {
          showWindow();
          if (win) win.webContents.send('app:focus', { kind: 'todo', id: row.id });
        });
        n.show();
      }

      // 日程：按 remind_before 提前提醒
      const events = db.all(
        `SELECT id, title, start_at, remind_before, all_day FROM events
         WHERE reminded = 0 AND remind_before > 0 AND start_at IS NOT NULL`
      );
      for (const ev of events) {
        const start = parseDue(ev.start_at);
        if (!start) continue;
        const fireAt = new Date(start.getTime() - Number(ev.remind_before) * 60 * 1000);
        if (fireAt > now) continue;
        db.run('UPDATE events SET reminded = 1 WHERE id = ?', [ev.id]);
        if (now.getTime() - start.getTime() > 6 * 60 * 60 * 1000) continue;
        if (!Notification.isSupported()) continue;
        const minutes = Number(ev.remind_before);
        const n = new Notification({
          title: minutes >= 60 ? `${Math.round(minutes / 60)} 小时后有安排` : `${minutes} 分钟后有安排`,
          body: ev.title,
        });
        n.on('click', () => {
          showWindow();
          if (win) win.webContents.send('app:focus', { kind: 'event', id: ev.id });
        });
        n.show();
      }
    } catch (err) {
      console.error('[reminder]', err);
    }
  };
  scanTimer = setInterval(scan, 20000);
  scan();
}

async function bootstrap() {
  const dataDir = resolveDataDir();
  fs.mkdirSync(dataDir, { recursive: true });

  db = await new Database(dataDir).open();
  api = createApi({ db, app, shell, dataDir, getWindow: () => win });

  ipcMain.handle('api:call', async (_event, method, payload) => {
    try {
      return { ok: true, data: api.invoke(method, payload) };
    } catch (err) {
      return { ok: false, error: { message: err.message, code: err.code || 'ERROR' } };
    }
  });

  ipcMain.handle('api:notify-test', async () => {
    if (Notification.isSupported()) {
      new Notification({ title: 'Linsssside', body: '通知是通的，到点就会这样提醒你。' }).show();
      return { ok: true };
    }
    return { ok: false, error: { message: '系统不支持通知' } };
  });

  ipcMain.handle('quick:hide', () => {
    if (quickWin) quickWin.hide();
    return true;
  });

  ipcMain.handle('window:quick-open', () => {
    toggleQuick();
    return true;
  });

  app.setAppUserModelId('com.linsssside.app');
  createWindow();
  createTray();
  createQuickWindow();
  startReminderLoop();

  // 全局快捷键：任意软件里都能叫出快速记录
  try {
    globalShortcut.register('Control+Alt+Space', toggleQuick);
  } catch (err) {
    console.warn('[shortcut] 注册失败', err && err.message);
  }
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', showWindow);
  app.whenReady().then(bootstrap).catch((err) => {
    console.error('[boot]', err);
    app.quit();
  });
}

app.on('window-all-closed', () => {
  // 托盘常驻：不退出
});

app.on('activate', showWindow);

app.on('before-quit', () => {
  quitting = true;
  if (scanTimer) clearInterval(scanTimer);
  try { globalShortcut.unregisterAll(); } catch (_) { /* ignore */ }
  try { quickWin && quickWin.destroy(); } catch (_) { /* ignore */ }
  try { db && db.close(); } catch (err) { console.error(err); }
});
