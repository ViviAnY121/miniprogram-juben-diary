// app.js
// !!! 请先在微信公众平台/开发者工具中开通「云开发」，并把下面的 CLOUD_ENV_ID 换成你自己的环境 ID
const CLOUD_ENV_ID = 'cloud1-d7gs43iqrc6169197';

// 汇文明朝体字体文件（.ttf/.otf）在云存储中的 fileID。
// 需要你自己下载「汇文明朝体」字体文件，上传到云开发-存储，把生成的 fileID 填在这里。
// 没有配置的话会自动跳过，使用系统默认字体，不影响其它功能。
const FONT_FILE_ID = '';

App({
  onLaunch() {
    if (!wx.cloud) {
      console.error('当前微信基础库版本过低，无法使用云开发');
    } else {
      wx.cloud.init({
        env: CLOUD_ENV_ID,
        traceUser: true,
      });
      this.loadCustomFont();
    }
    this.globalData = {};
  },

  // 加载汇文明朝体，全局生效（global: true）
  async loadCustomFont() {
    if (!FONT_FILE_ID) {
      console.warn('未配置 FONT_FILE_ID，跳过汇文明朝体加载，使用系统默认字体');
      return;
    }
    try {
      const res = await wx.cloud.getTempFileURL({ fileList: [FONT_FILE_ID] });
      const url = res.fileList[0] && res.fileList[0].tempFileURL;
      if (!url) return;
      wx.loadFontFace({
        family: 'HuiwenMincho',
        source: `url("${url}")`,
        global: true,
        success: () => console.log('汇文明朝体加载成功'),
        fail: (err) => console.warn('汇文明朝体加载失败，使用系统默认字体', err),
      });
    } catch (e) {
      console.warn('获取字体临时链接失败，使用系统默认字体', e);
    }
  },

  globalData: {},
});
