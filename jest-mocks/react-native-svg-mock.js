const React = require('react');
const make = (name) => (props) => React.createElement(name, props, props.children);
const Svg = make('Svg');
module.exports = {
  __esModule: true,
  default: Svg,
  Svg,
  Path: make('Path'),
  G: make('G'),
  Circle: make('Circle'),
  Rect: make('Rect'),
  Polygon: make('Polygon'),
  Line: make('Line'),
  Defs: make('Defs'),
  LinearGradient: make('LinearGradient'),
  Stop: make('Stop'),
};
