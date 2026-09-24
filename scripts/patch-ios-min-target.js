#!/usr/bin/env node
/* global __dirname */
/**
 * Demo-only: relax Expo SDK 57's declared iOS 16.4 floor so a Simulator build can target an
 * older runtime (e.g. iOS 16.2 on Xcode 14.2). No-op unless VIRALLENS_IOS_DEPLOYMENT_TARGET
 * is set (only the `preview-sim-ios16` EAS profile sets it).
 *
 * Expo pods declare `:ios => '16.4'` and ExpoModulesJSI's Package.swift declares
 * `.iOS("16.4")`; CocoaPods refuses a lower app target without this. The Swift compiler still
 * enforces API availability, so real 16.4-only API use fails the build instead of crashing.
 * Unsupported by Expo — never use for App Store builds.
 */
const fs = require('fs');
const path = require('path');

const target = process.env.VIRALLENS_IOS_DEPLOYMENT_TARGET;
if (!target) process.exit(0);
if (!/^\d+\.\d+$/.test(target)) {
  console.error(`[patch-ios-min-target] invalid VIRALLENS_IOS_DEPLOYMENT_TARGET: ${target}`);
  process.exit(1);
}

const root = path.join(__dirname, '..', 'node_modules');
const FLOOR = '16.4';
let patched = 0;

function patchFile(file, pairs) {
  const src = fs.readFileSync(file, 'utf8');
  let out = src;
  for (const [re, rep] of pairs) out = out.replace(re, rep);
  if (out !== src) {
    fs.writeFileSync(file, out);
    patched += 1;
  }
}

function walk(dir, depth) {
  if (depth > 6) return;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === '.bin' || e.name === 'android' || e.name === '__tests__') continue;
      walk(p, depth + 1);
    } else if (e.name.endsWith('.podspec')) {
      patchFile(p, [[/(:ios\s*=>\s*)(['"])16\.4\2/g, `$1$2${target}$2`]]);
    } else if (e.name === 'Package.swift' && p.includes('expo-modules-jsi')) {
      patchFile(p, [[/\.iOS\("16\.4"\)/g, `.iOS("${target}")`]]);
    }
  }
}

walk(root, 0);
console.log(
  `[patch-ios-min-target] iOS floor ${FLOOR} -> ${target} in ${patched} file(s) (demo build only)`,
);
