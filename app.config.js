/**
 * Layered on app.json. DEMO BRANCH ONLY: for non-production builds, allow the RevenueCat Test
 * Store key in Release Simulator builds (see plugins/withRevenueCatTestStoreRelease.js).
 */
const withRevenueCatTestStoreRelease = require('./plugins/withRevenueCatTestStoreRelease');

module.exports = ({ config }) => {
  if (process.env.APP_ENV === 'production') return config;
  return withRevenueCatTestStoreRelease(config);
};
