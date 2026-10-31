/** 日期小工具：全部走本地时间，和主进程的存储格式一一对应 */

const pad = (n) => String(n).padStart(2, '0');

export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function nowStr() {
  const d = new Date();
  return `${todayStr()}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "2026-10-31T18:00" → Date；"2026-10-31" → 当天 00:00 */
export function parseDue(due) {
  if (!due) return null;
  const [datePart, timePart] = String(due).split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  const [hh, mm] = (timePart || '0:0').split(':').map(Number);
  return new Date(y, m - 1, d, hh || 0, mm || 0, 0, 0);
}

export function toDateInput(due) {
  return due ? String(due).slice(0, 10) : '';
}

export function toTimeInput(due) {
  if (!due || !String(due).includes('T')) return '';
  return String(due).split('T')[1].slice(0, 5);
}

export function combineDateTime(dateStr, timeStr, allDay) {
  if (!dateStr) return null;
  return allDay || !timeStr ? dateStr : `${dateStr}T${timeStr}`;
}

const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export function weekday(dateStr) {
  const d = parseDue(dateStr);
  return d ? WEEK[d.getDay()] : '';
}

export function dateCN(dateStr) {
  const d = parseDue(dateStr);
  if (!d) return '';
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

export function fullDateCN(dateStr) {
  const d = parseDue(dateStr);
  if (!d) return '';
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function diffDays(a, b) {
  const ms = parseDue(a).setHours(0, 0, 0, 0) - parseDue(b).setHours(0, 0, 0, 0);
  return Math.round(ms / 86400000);
}

/** 截止时间的显示文案 + 语气（overdue / today / soon / later） */
export function dueLabel(due, allDay) {
  if (!due) return null;
  const day = String(due).slice(0, 10);
  const today = todayStr();
  const delta = diffDays(day, today);
  const time = String(due).includes('T') ? String(due).split('T')[1].slice(0, 5) : '';

  let text;
  let tone;
  if (delta < 0) {
    text = delta === -1 ? '昨天' : `逾期 ${-delta} 天`;
    tone = 'overdue';
  } else if (delta === 0) {
    text = '今天';
    tone = 'today';
  } else if (delta === 1) {
    text = '明天';
    tone = 'soon';
  } else if (delta <= 7) {
    text = `${dateCN(day)} ${weekday(day)}`;
    tone = 'soon';
  } else {
    text = `${dateCN(day)} ${weekday(day)}`;
    tone = 'later';
  }
  if (time && !allDay) text += ` ${time}`;
  return { text, tone };
}

export function greeting() {
  const h = new Date().getHours();
  if (h < 5) return '还没睡吗';
  if (h < 11) return '早上好';
  if (h < 14) return '中午好';
  if (h < 18) return '下午好';
  if (h < 23) return '晚上好';
  return '夜深了';
}

export const PRIORITY = [
  { value: 0, label: '无', tone: 'none' },
  { value: 1, label: '低', tone: 'low' },
  { value: 2, label: '中', tone: 'mid' },
  { value: 3, label: '高', tone: 'high' },
];

export const REPEAT = [
  { value: '', label: '不重复' },
  { value: 'daily', label: '每天' },
  { value: 'weekly', label: '每周' },
  { value: 'monthly', label: '每月' },
  { value: 'yearly', label: '每年' },
];

export function repeatLabel(freq, interval) {
  const found = REPEAT.find((r) => r.value === freq);
  if (!found) return '';
  const n = Number(interval) || 1;
  if (n === 1) return found.label;
  return `每 ${n} ${freq === 'daily' ? '天' : freq === 'weekly' ? '周' : freq === 'monthly' ? '个月' : '年'}`;
}
