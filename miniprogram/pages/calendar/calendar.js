const { buildMonthGrid, totalAmount } = require('../../utils/util.js');
const cloudApi = require('../../utils/cloud.js');

Page({
  data: {
    year: 0,
    month: 0,
    pickerValue: '', // 'YYYY-MM'，给 picker mode="date" fields="month" 用
    weekDays: ['日', '一', '二', '三', '四', '五', '六'],
    cells: [],
    loading: false,
    showAddPopup: false,
    addPopupDate: '',
    monthCount: 0,
    monthAmount: 0,
  },

  onLoad() {
    const now = new Date();
    this.setYearMonth(now.getFullYear(), now.getMonth() + 1);
  },

  onShow() {
    this.loadMonth();
  },

  onPullDownRefresh() {
    this.loadMonth().finally(() => wx.stopPullDownRefresh());
  },

  // 统一设置年月，同时更新 picker 需要用的 'YYYY-MM' 格式
  setYearMonth(year, month, callback) {
    const pickerValue = `${year}-${month < 10 ? '0' + month : month}`;
    this.setData({ year, month, pickerValue }, callback);
  },

  prevMonth() {
    let { year, month } = this.data;
    month -= 1;
    if (month < 1) {
      month = 12;
      year -= 1;
    }
    this.setYearMonth(year, month, () => this.loadMonth());
  },

  nextMonth() {
    let { year, month } = this.data;
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
    this.setYearMonth(year, month, () => this.loadMonth());
  },

  // 点击顶部“2026年9月”弹出原生年月选择器后，选中新年月触发这里
  onYearMonthChange(e) {
    const [year, month] = e.detail.value.split('-').map(Number);
    this.setYearMonth(year, month, () => this.loadMonth());
  },

  async loadMonth() {
    const { year, month } = this.data;
    const cells = buildMonthGrid(year, month);
    this.setData({ loading: true });

    try {
      const start = cells[0].dateStr;
      const end = cells[cells.length - 1].dateStr;
      const res = await cloudApi.getRecordsByMonth(start, end);
      const records = res.data;

      // 解析临时图片链接
      const fileIDs = records.map((r) => r.posterFileID);
      const urlMap = await cloudApi.resolveTempUrls(fileIDs);

      // 按日期分组
      const byDate = {};
      records.forEach((r) => {
        r.tempUrl = urlMap[r.posterFileID] || '';
        if (!byDate[r.date]) byDate[r.date] = [];
        byDate[r.date].push(r);
      });

      const newCells = cells.map((c) => ({
        ...c,
        records: byDate[c.dateStr] || [],
      }));

      // 本月（inMonth）统计
      const monthRecords = records.filter((r) => {
        const day = Number(r.date.split('-')[2]);
        return cells.some((c) => c.dateStr === r.date && c.inMonth);
      });
      const monthCount = monthRecords.length;
      const monthAmount = monthRecords.reduce((sum, r) => sum + totalAmount(r), 0);

      this.setData({
        cells: newCells,
        monthCount,
        monthAmount,
      });
    } catch (e) {
      console.error(e);
      wx.showToast({ title: '加载失败，请检查云开发配置', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  // 点击格子里除海报以外的任意区域（数字、空白）都进入添加流程
  onTapCell(e) {
    const date = e.currentTarget.dataset.date;
    this.setData({ showAddPopup: true, addPopupDate: date });
  },

  closeAddPopup() {
    this.setData({ showAddPopup: false });
  },

  noop() {},

  onChoosePoster() {
    const date = this.data.addPopupDate;
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempPath = res.tempFiles[0].tempFilePath;
        this.setData({ showAddPopup: false });
        wx.navigateTo({
          url: `/pages/detail/detail?mode=add&date=${date}&posterTemp=${encodeURIComponent(tempPath)}`,
        });
      },
    });
  },

  onTapPoster(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/detail/detail?mode=view&id=${id}` });
  },
});

