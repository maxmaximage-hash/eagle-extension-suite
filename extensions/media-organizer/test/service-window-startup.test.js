'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'plugin.js'), 'utf8');
const manifest = require('../manifest.json');
const create = source.slice(source.indexOf('eagle.onPluginCreate('), source.indexOf('eagle.onLibraryChanged('));
assert.doesNotMatch(create, /ensurePanelVisible\(/, 'creating the background service must never open the tag window');
assert.equal(manifest.main.show, false, 'the host must not show the service window before its lifecycle handler');
const run = source.slice(source.indexOf('eagle.onPluginRun(async () => {'));
const automatic = run.slice(run.indexOf('  const automaticServiceStart'), run.indexOf('  try {\n    seedExpectedLibraryIdentityFromHost();'));
(async () => {
 const actions=[];
 const scope={ Date, pluginCreatedAt:Date.now(), startupWindowRequestHandled:false,
  startPromise:Promise.resolve(), ensurePanelVisible:async()=>actions.push('show'),
  bindFeaturePanelsSafely:async()=>actions.push('bind'), setStatus:()=>{},
 };
 await vm.runInNewContext('(async () => {' + automatic + '})()',scope);
 assert.deepEqual(actions,[], 'automatic plugin-run must remain a background operation');
 assert.equal(scope.startupWindowRequestHandled,true);
 console.log('service window startup tests passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
