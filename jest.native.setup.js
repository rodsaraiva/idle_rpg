// Initialize minimal native bridge config expected by react-native modules during Jest runs
global.__fbBatchedBridgeConfig = { remoteModuleConfig: [] };
// Provide a basic NativeModules mock if not present
if (!global.__fbBatchedBridgeConfig) {
  global.__fbBatchedBridgeConfig = { remoteModuleConfig: {} };
}
global.nativeCallSyncHook = () => {};

// Provide timers and RAF mocks
global.requestAnimationFrame = global.requestAnimationFrame || function (cb) {
  return setTimeout(cb, 0);
};
global.cancelAnimationFrame = global.cancelAnimationFrame || function (id) {
  clearTimeout(id);
};

// Provide atob/btoa for some RN libs
if (typeof global.atob === 'undefined') {
  global.atob = (str) => Buffer.from(str, 'base64').toString('binary');
}
if (typeof global.btoa === 'undefined') {
  global.btoa = (str) => Buffer.from(str, 'binary').toString('base64');
}

module.exports = {};

