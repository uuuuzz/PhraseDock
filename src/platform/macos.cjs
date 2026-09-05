'use strict';
const { createBridgeClient } = require('./bridge-client.cjs');
function createMacPlatform(helperPath, initialTarget) {
  let target = initialTarget;
  const client = createBridgeClient(helperPath, (action, extra) => ({ action, bundleIds: target.macBundleIds, ...extra }));
  return { ...client, configure(value) { target = value; } };
}
module.exports = { createMacPlatform };
