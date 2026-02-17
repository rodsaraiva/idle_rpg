module.exports = {
  getEnforcing: (name) => {
    if (name === 'PlatformConstants') {
      return {
        reactNativeVersion: {},
        os: 'android',
        forceTouchAvailable: false,
      };
    }
    return {};
  },
};

