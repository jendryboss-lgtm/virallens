/**
 * DEMO ONLY (demo/sdk55-ios16 branch). RevenueCat's iOS SDK intentionally fatalErrors when a
 * Test Store API key is used in a Release build (`#if !DEBUG && !BYPASS_SIMULATED_STORE_RELEASE_CHECK`
 * in Sources/Purchasing/Configuration.swift). The standalone `preview-sim` Simulator build is
 * Release, so we compile the RevenueCat pods with RevenueCat's documented opt-out flag.
 * app.config.js never applies this when APP_ENV=production.
 */
const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

const MARKER = '# [virallens-demo] RevenueCat Test Store in Release';
const SNIPPET = `
    ${MARKER}
    installer.pods_project.targets.each do |t|
      next unless ['RevenueCat', 'RevenueCatUI'].include?(t.name)
      t.build_configurations.each do |c|
        c.build_settings['SWIFT_ACTIVE_COMPILATION_CONDITIONS'] = '$(inherited) BYPASS_SIMULATED_STORE_RELEASE_CHECK'
      end
    end
`;

module.exports = function withRevenueCatTestStoreRelease(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const podfile = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let src = fs.readFileSync(podfile, 'utf8');
      if (!src.includes(MARKER)) {
        const anchor = /post_install do \|installer\|\n/;
        if (!anchor.test(src)) throw new Error('[withRevenueCatTestStoreRelease] post_install not found');
        src = src.replace(anchor, (m) => m + SNIPPET);
        fs.writeFileSync(podfile, src);
      }
      return cfg;
    },
  ]);
};
