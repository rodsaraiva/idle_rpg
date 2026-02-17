// Minimal mock for react-native/Libraries/BatchedBridge/NativeModules
global.__fbBatchedBridgeConfig = global.__fbBatchedBridgeConfig || { remoteModuleConfig: [] };

const mockNativeModules = {
  NativeUnimoduleProxy: {
    viewManagersMetadata: {},
  },
  UIManager: {},
  Linking: {},
  ImageLoader: {},
  ImageViewManager: {},
  NativeModules: {},
};

module.exports = mockNativeModules;

