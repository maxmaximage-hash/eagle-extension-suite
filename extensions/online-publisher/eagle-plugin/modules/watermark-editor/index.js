'use strict';

const schema = require('./schema.js');
const presets = require('./presets.js');
const renderer = require('./renderer.js');

module.exports = Object.freeze({
  version: '1.1.1',
  schema,
  presets,
  ...renderer
});
