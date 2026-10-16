const cloudApi = require('../../utils/cloud.js');
const { totalAmount, getDmList } = require('../../utils/util.js');

Page({
  data: {
    mode: 'add', // add | view
    editable: true,
    recordId: '',
    originalPosterFileID: '',
    newPosterTempPath: '', // 本地新选的临时图片路径（尚未上传）
    posterDisplayUrl: '',
    totalDisplay: '0',
    form: {
      scriptName: '',
      date: '',
      character: '',
      location: '',
      dmList: [''],
      isPending: false,
      fee: '',
      nightFee: '',
      dayFee: '',
      hasSubsidy: false,
      subsidyAmount: '',
      otherAmount: '',
      otherRemark: '',
      remark: '',
    },
  },

  onLoad(options) {
    if (options.mode === 'view' && options.id) {
      this.setData({ mode: 'view', editable: false, recordId: options.id });
      wx.setNavigationBarTitle({ title: '打本记录' });
      this.loadRecord(options.id);
    } else {
      // add 模式
      const posterTemp = options.posterTemp ? decodeURIComponent(options.posterTemp) : '';
      wx.setNavigationBarTitle({ title: '添加记录' });
      this.setData({
        mode: 'add',
        editable: true,
        newPosterTempPath: posterTemp,
        posterDisplayUrl: posterTemp,
        'form.date': options.date || '',
      });
      this.recalcTotal();
    }
  },

  async loadRecord(id) {
    wx.showLoading({ title: '加载中' });
    try {
      const res = await cloudApi.getRecord(id);
      const rec = res.data;
      const urlMap = await cloudApi.resolveTempUrls([rec.posterFileID]);
      const dmList = getDmList(rec);
      this.setData({
        originalPosterFileID: rec.posterFileID,
        posterDisplayUrl: urlMap[rec.posterFileID] || '',
        form: {
          scriptName: rec.scriptName || '',
          date: rec.date || '',
          character: rec.character || '',
          location: rec.location || '',
          dmList: dmList.length > 0 ? dmList : [''],
          isPending: !!rec.isPending,
          fee: rec.fee != null ? String(rec.fee) : '',
          nightFee: rec.nightFee != null ? String(rec.nightFee) : '',
          dayFee: rec.dayFee != null ? String(rec.dayFee) : '',
          hasSubsidy: !!rec.hasSubsidy,
          subsidyAmount: rec.subsidyAmount != null ? String(rec.subsidyAmount) : '',
          otherAmount: rec.otherAmount != null ? String(rec.otherAmount) : '',
          otherRemark: rec.otherRemark || '',
          remark: rec.remark || '',
        },
      });
      this.recalcTotal();
    } catch (e) {
      console.error(e);
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: e.detail.value }, () => this.recalcTotal());
  },

  // 补贴金额 / 其他金额：允许输入正负数和小数点
  onSignedInput(e) {
    const field = e.currentTarget.dataset.field;
    let v = e.detail.value.replace(/[^0-9.\-]/g, '');
    this.setData({ [`form.${field}`]: v }, () => this.recalcTotal());
  },

  onDateChange(e) {
    this.setData({ 'form.date': e.detail.value });
  },

  onPendingChange(e) {
    this.setData({ 'form.isPending': e.detail.value });
  },

  onSubsidyToggle(e) {
    this.setData({ 'form.hasSubsidy': e.detail.value }, () => this.recalcTotal());
  },

  // ---- DM 多项管理 ----
  addDM() {
    const dmList = this.data.form.dmList.concat(['']);
    this.setData({ 'form.dmList': dmList });
  },

  removeDM(e) {
    const idx = e.currentTarget.dataset.index;
    const dmList = this.data.form.dmList.slice();
    dmList.splice(idx, 1);
    this.setData({ 'form.dmList': dmList.length > 0 ? dmList : [''] });
  },

  onDmInput(e) {
    const idx = e.currentTarget.dataset.index;
    const dmList = this.data.form.dmList.slice();
    dmList[idx] = e.detail.value;
    this.setData({ 'form.dmList': dmList });
  },

  // 根据当前表单实时计算总金额，用于页面展示
  recalcTotal() {
    const total = totalAmount(this.buildPayloadFromForm());
    this.setData({ totalDisplay: Math.round(total * 100) / 100 });
  },

  buildPayloadFromForm() {
    const { form } = this.data;
    return {
      fee: Number(form.fee) || 0,
      hasSubsidy: !!form.hasSubsidy,
      subsidyAmount: Number(form.subsidyAmount) || 0,
      otherAmount: Number(form.otherAmount) || 0,
      nightFee: Number(form.nightFee) || 0,
      dayFee: Number(form.dayFee) || 0,
    };
  },

  onTapPosterImg() {
    if (!this.data.editable) {
      if (this.data.posterDisplayUrl) {
        wx.previewImage({ urls: [this.data.posterDisplayUrl] });
      }
      return;
    }
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempPath = res.tempFiles[0].tempFilePath;
        this.setData({ newPosterTempPath: tempPath, posterDisplayUrl: tempPath });
      },
    });
  },

  onEnableEdit() {
    this.setData({ editable: true });
    wx.setNavigationBarTitle({ title: '编辑记录' });
  },

  validate() {
    const { form, newPosterTempPath, originalPosterFileID } = this.data;
    if (!form.scriptName.trim()) {
      wx.showToast({ title: '请输入剧本名称', icon: 'none' });
      return false;
    }
    if (!form.date) {
      wx.showToast({ title: '请选择日期', icon: 'none' });
      return false;
    }
    if (!newPosterTempPath && !originalPosterFileID) {
      wx.showToast({ title: '请选择剧本海报', icon: 'none' });
      return false;
    }
    return true;
  },

  async onSave() {
    if (!this.validate()) return;
    wx.showLoading({ title: '保存中' });
    try {
      let posterFileID = this.data.originalPosterFileID;

      if (this.data.newPosterTempPath) {
        const uploadRes = await cloudApi.uploadPoster(this.data.newPosterTempPath);
        posterFileID = uploadRes.fileID;
        // 删除旧图（仅编辑且换图时）
        if (this.data.originalPosterFileID && this.data.originalPosterFileID !== posterFileID) {
          cloudApi.deleteFile(this.data.originalPosterFileID).catch(() => {});
        }
      }

      const { form } = this.data;
      const dmList = form.dmList.map((s) => s.trim()).filter(Boolean);

      const payload = {
        scriptName: form.scriptName.trim(),
        date: form.date,
        character: form.character.trim(),
        location: form.location.trim(),
        dmList,
        isPending: !!form.isPending,
        fee: Number(form.fee) || 0,
        nightFee: Number(form.nightFee) || 0,
        dayFee: Number(form.dayFee) || 0,
        hasSubsidy: !!form.hasSubsidy,
        subsidyAmount: form.hasSubsidy ? Number(form.subsidyAmount) || 0 : 0,
        otherAmount: Number(form.otherAmount) || 0,
        otherRemark: form.otherRemark.trim(),
        remark: form.remark.trim(),
        posterFileID,
      };

      if (this.data.mode === 'add') {
        await cloudApi.addRecord(payload);
      } else {
        await cloudApi.updateRecord(this.data.recordId, payload);
      }

      wx.hideLoading();
      wx.showToast({ title: '保存成功' });
      setTimeout(() => wx.navigateBack(), 500);
    } catch (e) {
      console.error(e);
      wx.hideLoading();
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  },

  onDelete() {
    wx.showModal({
      title: '确认删除',
      content: '删除后无法恢复，确定要删除这条记录吗？',
      confirmColor: '#e74c3c',
      success: async (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: '删除中' });
        try {
          await cloudApi.deleteRecord(this.data.recordId);
          cloudApi.deleteFile(this.data.originalPosterFileID).catch(() => {});
          wx.hideLoading();
          wx.showToast({ title: '已删除' });
          setTimeout(() => wx.navigateBack(), 500);
        } catch (e) {
          console.error(e);
          wx.hideLoading();
          wx.showToast({ title: '删除失败', icon: 'none' });
        }
      },
    });
  },
});
