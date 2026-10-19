const { Settings } = require('../models');
const cache = require('./cache');
exports.getSettings = org => cache.wrap('settings:' + org, 60, async () => {
  let s = await Settings.findOne({ org }).lean();
  if (!s) s = (await Settings.create({ org })).toObject();
  return JSON.parse(JSON.stringify(s));
});
exports.updateSettings = async (org, patch) => {
  await Settings.findOneAndUpdate({ org }, { $set: patch }, { upsert: true });
  await cache.delPrefix('settings:' + org);
  return exports.getSettings(org);
};
