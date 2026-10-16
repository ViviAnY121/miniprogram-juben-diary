const cloudApi = require('../../utils/cloud.js');
const { totalAmount, getDmList } = require('../../utils/util.js');

Page({
  data: {
    activeTab: 'monthly',
    year: new Date().getFullYear(),
    allRecords: [],
    monthlyCounts: new Array(12).fill(0),
    monthlyAmounts: new Array(12).fill(0),
    hasYearData: false,
    yearTotalCount: 0,
    yearTotalAmount: 0,
    scriptRanking: [],
    dmRanking: [],
  },

  onShow() {
    this.fetchAllAndCompute();
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab }, () => {
      if (tab === 'monthly') {
        this.computeMonthly();
        this.drawChart();
      }
    });
  },

  prevYear() {
    this.setData({ year: this.data.year - 1 }, () => {
      this.computeMonthly();
      this.drawChart();
    });
  },

  nextYear() {
    this.setData({ year: this.data.year + 1 }, () => {
      this.computeMonthly();
      this.drawChart();
    });
  },

  async fetchAllAndCompute() {
    wx.showLoading({ title: '统计中' });
    try {
      const records = await cloudApi.getAllRecords();
      this.setData({ allRecords: records });
      this.computeMonthly();
      this.computeRankings();
      if (this.data.activeTab === 'monthly') {
        // 等待渲染后再画图
        wx.nextTick(() => this.drawChart());
      }
    } catch (e) {
      console.error(e);
      wx.showToast({ title: '加载统计数据失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  // ------- 页面一：按年度统计月度次数与净花费 -------
  computeMonthly() {
    const { allRecords, year } = this.data;
    const counts = new Array(12).fill(0);
    const amounts = new Array(12).fill(0);

    allRecords.forEach((r) => {
      if (!r.date) return;
      const [y, m] = r.date.split('-').map(Number);
      if (y !== year) return;
      counts[m - 1] += 1;
      amounts[m - 1] += totalAmount(r);
    });

    const yearTotalCount = counts.reduce((a, b) => a + b, 0);
    const yearTotalAmount = amounts.reduce((a, b) => a + b, 0);

    this.setData({
      monthlyCounts: counts,
      monthlyAmounts: amounts.map((a) => Math.round(a * 100) / 100),
      hasYearData: yearTotalCount > 0,
      yearTotalCount,
      yearTotalAmount: Math.round(yearTotalAmount * 100) / 100,
    });
  },

  drawChart() {
    const query = wx.createSelectorQuery().in(this);
    query
      .select('#lineChart')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res || !res[0] || !res[0].node) return;
        const canvas = res[0].node;
        const cssWidth = res[0].width;
        const cssHeight = res[0].height;
        const dpr = wx.getSystemInfoSync().pixelRatio || 2;

        canvas.width = cssWidth * dpr;
        canvas.height = cssHeight * dpr;
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, cssWidth, cssHeight);

        const counts = this.data.monthlyCounts;
        const amounts = this.data.monthlyAmounts;

        const padLeft = 46;
        const padRight = 46;
        const padTop = 20;
        const padBottom = 34;
        const chartW = cssWidth - padLeft - padRight;
        const chartH = cssHeight - padTop - padBottom;

        const maxCount = Math.max(1, Math.ceil(Math.max(...counts) * 1.2));
        let amountMin = Math.min(0, ...amounts);
        let amountMax = Math.max(1, ...amounts);
        amountMax = Math.ceil(amountMax * 1.2);
        amountMin = amountMin < 0 ? Math.floor(amountMin * 1.2) : 0;
        const amountRange = amountMax - amountMin || 1;

        // 网格线 + 双轴刻度
        ctx.strokeStyle = '#eee';
        ctx.fillStyle = '#999';
        ctx.font = '10px sans-serif';
        ctx.lineWidth = 1;
        const rows = 4;
        for (let i = 0; i <= rows; i++) {
          const frac = i / rows; // 0 = 底部, 1 = 顶部
          const y = padTop + chartH * (1 - frac);
          ctx.beginPath();
          ctx.moveTo(padLeft, y);
          ctx.lineTo(padLeft + chartW, y);
          ctx.stroke();

          const leftVal = Math.round(maxCount * frac);
          const rightVal = Math.round(amountMin + amountRange * frac);
          ctx.fillStyle = '#6c5ce7';
          ctx.textAlign = 'right';
          ctx.fillText(leftVal, padLeft - 6, y + 3);
          ctx.fillStyle = '#f0932b';
          ctx.textAlign = 'left';
          ctx.fillText(rightVal, padLeft + chartW + 6, y + 3);
        }

        // 坐标点
        const stepX = chartW / 11;
        const countPoints = counts.map((v, idx) => ({
          x: padLeft + stepX * idx,
          y: padTop + chartH * (1 - v / maxCount),
        }));
        const amountPoints = amounts.map((v, idx) => ({
          x: padLeft + stepX * idx,
          y: padTop + chartH * (1 - (v - amountMin) / amountRange),
        }));

        this.drawLine(ctx, countPoints, '#6c5ce7');
        this.drawLine(ctx, amountPoints, '#f0932b');

        // X 轴月份标签
        ctx.fillStyle = '#999';
        ctx.textAlign = 'center';
        ctx.font = '10px sans-serif';
        for (let m = 0; m < 12; m++) {
          ctx.fillText(`${m + 1}月`, padLeft + stepX * m, cssHeight - 10);
        }
      });
  },

  drawLine(ctx, points, color) {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    points.forEach((p, idx) => {
      if (idx === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();
    points.forEach((p) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    });
  },

  // ------- 页面二：按剧本排行（一条记录只对应一个剧本名） -------
  computeScriptRanking(allRecords) {
    const map = {};
    allRecords.forEach((r) => {
      const key = (r.scriptName || '').trim();
      if (!key) return;
      if (!map[key]) map[key] = { name: key, count: 0, amount: 0 };
      map[key].count += 1;
      map[key].amount += totalAmount(r);
    });
    return this.sortRanking(Object.values(map));
  },

  // ------- 页面三：按DM排行（一条记录可能有多个DM，每个DM都分别计1次、计入整场总金额） -------
  computeDmRanking(allRecords) {
    const map = {};
    allRecords.forEach((r) => {
      const dmList = getDmList(r);
      const amount = totalAmount(r);
      dmList.forEach((name) => {
        if (!map[name]) map[name] = { name, count: 0, amount: 0 };
        map[name].count += 1;
        map[name].amount += amount;
      });
    });
    return this.sortRanking(Object.values(map));
  },

  // 次数从多到少排列（第1名=打得最多/合作最多），次数相同按金额从高到低
  sortRanking(list) {
    return list
      .map((item) => ({ ...item, amount: Math.round(item.amount * 100) / 100 }))
      .sort((a, b) => (b.count !== a.count ? b.count - a.count : b.amount - a.amount));
  },

  computeRankings() {
    const { allRecords } = this.data;
    this.setData({
      scriptRanking: this.computeScriptRanking(allRecords),
      dmRanking: this.computeDmRanking(allRecords),
    });
  },
});
