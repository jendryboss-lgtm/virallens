/**
 * Dynamic config layered on top of app.json (all real config lives in app.json).
 *
 * VIRALLENS_IOS_DEPLOYMENT_TARGET (optional, demo builds only): overrides the iOS
 * deployment target, e.g. "16.2" for the `preview-sim-ios16` EAS profile so the
 * Simulator build runs on older Xcode/iOS 16.2 runtimes. Unset = Expo SDK default (16.4).
 */
module.exports = ({ config }) => {
  const target = process.env.VIRALLENS_IOS_DEPLOYMENT_TARGET;
  if (!target) return config;
  return { ...config, ios: { ...config.ios, deploymentTarget: target } };
};
