// utils/util.js

// 格式化为 'YYYY-MM-DD'
function formatDate(date) {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// 生成某年某月的日历格子（6 行 x 7 列 = 42 格），包含上下月补位
// 返回 [{ dateStr, day, inMonth, isToday }]
function buildMonthGrid(year, month) {
  // month: 1-12
  const firstDay = new Date(year, month - 1, 1);
  const firstWeekday = firstDay.getDay(); // 0=周日
  const daysInMonth = new Date(year, month, 0).getDate();
  const daysInPrevMonth = new Date(year, month - 1, 0).getDate();

  const todayStr = formatDate(new Date());
  const cells = [];

  // 上月补位
  for (let i = 0; i < firstWeekday; i++) {
    const day = daysInPrevMonth - firstWeekday + 1 + i;
    const d = new Date(year, month - 2, day);
    cells.push({
      dateStr: formatDate(d),
      day,
      inMonth: false,
    });
  }

  // 本月
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month - 1, day);
    const dateStr = formatDate(d);
    cells.push({
      dateStr,
      day,
      inMonth: true,
      isToday: dateStr === todayStr,
    });
  }

  // 下月补位，补满 42 格
  const remaining = 42 - cells.length;
  for (let day = 1; day <= remaining; day++) {
    const d = new Date(year, month, day);
    cells.push({
      dateStr: formatDate(d),
      day,
      inMonth: false,
    });
  }

  return cells;
}

// 计算总金额：总金额 = 剧本费用 + 补贴金额 + 其他金额 + 夜场费 + 日场费
// 补贴金额本身可正可负（正=收入，负=倒贴），直接相加即可
function totalAmount(record) {
  const fee = Number(record.fee) || 0;
  const subsidy = record.hasSubsidy ? Number(record.subsidyAmount) || 0 : 0;
  const other = Number(record.otherAmount) || 0;
  const nightFee = Number(record.nightFee) || 0;
  const dayFee = Number(record.dayFee) || 0;
  return fee + subsidy + other + nightFee + dayFee;
}

// 兼容旧记录：取出某条记录的 DM 列表（数组）。
// 如果是老数据（单个字符串字段 dm），自动包装成数组，方便统一处理。
function getDmList(record) {
  if (Array.isArray(record.dmList)) {
    return record.dmList.map((s) => (s || '').trim()).filter(Boolean);
  }
  if (record.dm) {
    return [String(record.dm).trim()].filter(Boolean);
  }
  return [];
}

module.exports = {
  formatDate,
  buildMonthGrid,
  totalAmount,
  getDmList,
};
