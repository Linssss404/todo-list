'use strict';
/**
 * 时间与重复规则：全部使用本地时间字符串，避免时区错位
 *   due_at 形如 "2026-10-31T09:30"（带时间）或 "2026-10-31"（全天）
 */

function pad(n) {
  return String(n).padStart(2, '0');
}

function nowLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 把 due_at 解析成本地 Date（全天取当天 00:00） */
function parseDue(due) {
  if (!due) return null;
  const [datePart, timePart] = String(due).split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  const [hh, mm] = (timePart || '0:0').split(':').map(Number);
  return new Date(y, m - 1, d, hh || 0, mm || 0, 0, 0);
}

function formatDue(date, allDay) {
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  if (allDay) return day;
  return `${day}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function addMonths(date, months) {
  const day = date.getDate();
  const next = new Date(date.getFullYear(), date.getMonth() + months, 1, date.getHours(), date.getMinutes());
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(day, lastDay));
  return next;
}

/**
 * 计算下一次重复时间
 * freq: daily | weekly | monthly | yearly
 */
function nextOccurrence(due, freq, interval = 1) {
  const base = parseDue(due);
  if (!base || !freq) return null;
  const allDay = !String(due).includes('T');
  const step = Math.max(1, Number(interval) || 1);
  const d = new Date(base.getTime());

  if (freq === 'daily') d.setDate(d.getDate() + step);
  else if (freq === 'weekly') d.setDate(d.getDate() + 7 * step);
  else if (freq === 'monthly') return formatDue(addMonths(base, step), allDay);
  else if (freq === 'yearly') return formatDue(addMonths(base, 12 * step), allDay);
  else return null;

  return formatDue(d, allDay);
}

module.exports = { nowLocal, todayLocal, parseDue, formatDue, nextOccurrence };
