'use strict';

const { createBridgeClient } = require('./bridge-client.cjs');
function createWindowsPlatform(helperPath, initialTarget) {
  let target = initialTarget;
  const client = createBridgeClient(helperPath, (action, extra) => ({ action,
    executables: target.windowsExecutables,
    packageFamilyNames: target.windowsPackageFamilyNames,
    fixtureHwnd: target.fixtureHwnd, fixturePid: target.fixturePid, ...extra }));
  return { ...client, configure(value) { target = value; } };
}

module.exports = { createWindowsPlatform };
