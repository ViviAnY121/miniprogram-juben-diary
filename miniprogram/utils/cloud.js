// utils/cloud.js
// 统一封装云数据库 records 集合的增删改查、云存储上传与临时链接获取
const db = wx.cloud.database();
const _ = db.command;
const COLLECTION = 'records';

// 新增一条记录，data 为记录字段（不含 _id）
function addRecord(data) {
  return db.collection(COLLECTION).add({
    data: {
      ...data,
      createdAt: db.serverDate(),
    },
  });
}

// 更新记录
function updateRecord(id, data) {
  return db.collection(COLLECTION).doc(id).update({ data });
}

// 删除记录
function deleteRecord(id) {
  return db.collection(COLLECTION).doc(id).remove();
}

// 获取单条记录
function getRecord(id) {
  return db.collection(COLLECTION).doc(id).get();
}

// 获取某个月的所有记录，dateStart / dateEnd 为 'YYYY-MM-DD'
function getRecordsByMonth(dateStart, dateEnd) {
  return db
    .collection(COLLECTION)
    .where({
      date: _.gte(dateStart).and(_.lte(dateEnd)),
    })
    .orderBy('date', 'asc')
    .get();
}

// 获取全部记录（用于统计），自动分页拉取
async function getAllRecords() {
  const countRes = await db.collection(COLLECTION).count();
  const total = countRes.total;
  const batchSize = 100;
  const batchTimes = Math.ceil(total / batchSize);
  const tasks = [];
  for (let i = 0; i < batchTimes; i++) {
    tasks.push(
      db
        .collection(COLLECTION)
        .skip(i * batchSize)
        .limit(batchSize)
        .get()
    );
  }
  const results = await Promise.all(tasks);
  let all = [];
  results.forEach((r) => {
    all = all.concat(r.data);
  });
  return all;
}

// 上传海报图片到云存储，返回 fileID
function uploadPoster(filePath) {
  const cloudPath = `posters/${Date.now()}-${Math.floor(Math.random() * 100000)}.jpg`;
  return wx.cloud.uploadFile({
    cloudPath,
    filePath,
  });
}

// 删除云存储中的图片
function deleteFile(fileID) {
  if (!fileID) return Promise.resolve();
  return wx.cloud.deleteFile({ fileList: [fileID] });
}

// 批量把 fileID 转换成可展示的临时链接，返回 { fileID: tempUrl } 的映射
async function resolveTempUrls(fileIDs) {
  const uniqueIds = [...new Set(fileIDs.filter(Boolean))];
  if (uniqueIds.length === 0) return {};
  const res = await wx.cloud.getTempFileURL({ fileList: uniqueIds });
  const map = {};
  res.fileList.forEach((item) => {
    map[item.fileID] = item.tempFileURL || item.fileID;
  });
  return map;
}

module.exports = {
  addRecord,
  updateRecord,
  deleteRecord,
  getRecord,
  getRecordsByMonth,
  getAllRecords,
  uploadPoster,
  deleteFile,
  resolveTempUrls,
};
