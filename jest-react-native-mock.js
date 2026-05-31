const React = require('react');

const Text = (props) => React.createElement('Text', props, props.children);
const View = (props) => React.createElement('View', props, props.children);
const TouchableOpacity = (props) => React.createElement('TouchableOpacity', props, props.children);
const Button = (props) => React.createElement('Button', props, props.children);
const ScrollView = (props) => React.createElement('ScrollView', props, props.children);
const FlatList = (props) => React.createElement('FlatList', props, props.children);
const Modal = (props) => React.createElement('Modal', props, props.children);
const ActivityIndicator = (props) => React.createElement('ActivityIndicator', props, props.children);
const TextInput = (props) => React.createElement('TextInput', props, props.children);

const ReactNative = {
  Text,
  View,
  TouchableOpacity,
  Button,
  ScrollView,
  FlatList,
  Modal,
  ActivityIndicator,
  TextInput,
  StyleSheet: {
    create: (styles) => styles,
  },
  Platform: {
    OS: 'ios',
    select: (obj) => obj.ios || obj.default,
  },
  Animated: {
    View: (props) => React.createElement('Animated.View', props, props.children),
    Value: class { setValue() {} interpolate() { return 0; } addListener() {} removeAllListeners() {} },
    ValueXY: class {
      constructor() { this.x = { setValue() {}, addListener() {}, removeAllListeners() {} }; this.y = { setValue() {}, addListener() {}, removeAllListeners() {} }; }
      setValue() {}
      interpolate() { return 0; }
      addListener() {}
      removeAllListeners() {}
      stopAnimation() {}
    },
    timing: () => ({ start: (cb) => cb && cb() }),
    spring: () => ({ start: (cb) => cb && cb() }),
  },
  PanResponder: {
    create: () => ({ panHandlers: {} }),
  },
  Dimensions: {
    get: () => ({ width: 375, height: 667 }),
  },
  Alert: {
    alert: jest.fn(),
  },
  NativeModules: {
    UIManager: {},
    BlobModule: {},
    WebSocketModule: {},
  },
  NativeEventEmitter: class {
    constructor() {}
    addListener() { return { remove: () => {} }; }
    removeListeners() {}
    removeAllListeners() {}
  },
};

module.exports = ReactNative;
