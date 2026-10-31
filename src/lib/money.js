/** 金额与月份的显示小工具 */

export function yuan(cents) {
  const n = Number(cents || 0) / 100;
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function yuanShort(cents) {
  const n = Number(cents || 0) / 100;
  if (Math.abs(n) >= 10000) return `${(n / 10000).toFixed(1)} 万`;
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toFixed(0);
}

export function parseYuan(text) {
  const clean = String(text || '').replace(/[^\d.]/g, '');
  const value = Number(clean);
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100);
}

export function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(month) {
  const [y, m] = String(month).split('-');
  return `${y} 年 ${Number(m)} 月`;
}

export function shiftMonth(month, delta) {
  const [y, m] = String(month).split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function monthDay(iso) {
  const [y, m, d] = String(iso).split('-');
  return `${Number(m)}月${Number(d)}日`;
}
