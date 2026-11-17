"use strict";
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const assert = require("node:assert/strict");
const source = fs.readFileSync(path.join(__dirname, "../app.js"), "utf8");
const local = [{id:"tier-6600",name:"6600",standardGroups:10,standardGroupsWithPeople:6,standardGroupsWithoutPeople:4,standardPublishGroups:12,body:"自定义\n两行"}];
const configPath = "/userData/Eagle/PluginData/com.max.eagle-photo-taken-sort/delivery-templates.json";
const requestPath = configPath.replace("delivery-templates.json", "delivery-workbench-request.json");
const flush = () => new Promise(resolve => setImmediate(resolve));
function boot({lifecycle = false, readError = null, failPathOnce = false} = {}) {
  const reads = [], writes = [], intervals = [], callbacks = {}, elements = new Map();
  const files = new Map([[configPath, JSON.stringify({version:1,templates:local,activeTemplateId:"tier-6600"})]]);
  let apiReady = !lifecycle, pathCalls = 0, showCalls = 0;
  const makeElement = () => ({hidden:true,dataset:{},value:"",handlers:{},addEventListener(name,handler){this.handlers[name]=handler;},replaceChildren(){},appendChild(){},append(){}});
  const doc = {
    getElementById(id) { if (!elements.has(id)) elements.set(id,makeElement()); return elements.get(id); },
    createElement: makeElement
  };
  const window = {
    EagleWorkbenchRegistry:{WORKBENCH_VERSION:"test",MODULES:[]},
    EagleWorkbenchDelivery:require("../delivery"),
    EagleWorkbenchDeliveryEntry:require("../delivery-entry"),
    addEventListener(){},
    localStorage:{getItem(key){reads.push(key);return key.includes("active")?"tier-6600":JSON.stringify(local);},setItem(){}},
    eagle:{
      app:{getPath:async()=>{
        pathCalls++;
        if (!apiReady) throw Error("This method can only be used after plugin-create event triggered");
        if (failPathOnce) { failPathOnce=false; throw Error("temporary path failure"); }
        return "/userData/Eagle";
      }},
      window:{show:async()=>{assert.ok(apiReady);showCalls++;}},
      onPluginRun(callback){callbacks.run=callback;}
    },
    require(name) { return name === "path" ? path : {promises:{
      readFile:async p=>{
        if(readError)throw Object.assign(Error("access denied"),{code:readError});
        if(!files.has(p))throw Object.assign(Error("missing"),{code:"ENOENT"});
        return files.get(p);
      },
      mkdir:async()=>{},
      writeFile:async(p,value)=>{writes.push([p,value]);files.set(p,value);},
      rename:async(a,b)=>{files.set(b,files.get(a));files.delete(a);},
      unlink:async p=>files.delete(p)
    }}; }
  };
  if(lifecycle)window.eagle.onPluginCreate=callback=>{callbacks.create=callback;};
  vm.runInNewContext(source,{window,document:doc,setInterval(callback){intervals.push(callback);return intervals.length;},clearInterval(){},console});
  return {
    reads,writes,elements,files,
    get pathCalls(){return pathCalls;},get showCalls(){return showCalls;},
    create(){apiReady=true;assert.equal(typeof callbacks.create,"function");callbacks.create();},
    run(){callbacks.run?.();},
    tick(){for(const callback of intervals)callback();},
    request(id){files.set(requestPath,JSON.stringify({version:1,id,action:"manage-delivery-templates",templateId:"tier-6600",requestedAt:new Date().toISOString()}));}
  };
}
(async()=>{
  const unreadable=boot({readError:"EACCES"});
  await flush();
  assert.ok(unreadable.reads.includes("eagle.workbench.delivery.templates.v2"),"startup must read persisted templates with initialized keys");
  assert.ok(unreadable.reads.includes("eagle.workbench.delivery.active-template.v1"));
  assert.equal(unreadable.writes.length,0,"unreadable shared config must not be overwritten by defaults");
  const cold=boot({lifecycle:true});
  cold.request("first");
  await flush();
  assert.equal(cold.pathCalls,0,"Eagle getPath must not run before plugin-create");
  assert.equal(cold.showCalls,0);
  cold.create();
  await flush();await flush();
  assert.equal(cold.showCalls,1,"initial request must open after API readiness");
  assert.equal(cold.elements.get("deliveryOverlay").hidden,false);
  assert.equal(cold.elements.get("deliveryTemplateName").value,"6600");
  assert.equal(cold.elements.get("deliveryStandardGroups").value,10);
  assert.equal(cold.elements.get("deliveryPublishGroups").value,12);
  assert.equal(cold.files.has(requestPath),false);
  const link = cold.elements.get("deliveryQuarkLink");
  const copy = {value:""};
  cold.elements.set("deliveryText",copy);
  copy.value = "保留编辑\n连续行\n\n链接：\n原有末尾";
  const share = "我用夸克网盘给你分享了「verol」\n/~SYNTHETIC001~:/\n链接：https://pan.quark.cn/s/a1b2c3d4e5f6";
  assert.equal(typeof link.handlers.paste,"function");
  let prevented = false;
  link.handlers.paste({clipboardData:{getData(){return share;}},preventDefault(){prevented=true;}});
  assert.equal(prevented,true);
  assert.equal(link.value,"https://pan.quark.cn/s/a1b2c3d4e5f6");
  assert.equal(copy.value,"保留编辑\n连续行\n\n链接：https://pan.quark.cn/s/a1b2c3d4e5f6\n原有末尾");
  link.value="https://pan.quark.cn/s/new-share";
  link.handlers.input();
  assert.equal(copy.value,"保留编辑\n连续行\n\n链接：https://pan.quark.cn/s/new-share\n原有末尾");
  cold.elements.get("deliveryOverlay").hidden=true;
  cold.request("second");cold.run();
  await flush();await flush();
  assert.equal(cold.showCalls,2,"already-open Workbench must consume a second request without another create event");
  assert.equal(cold.elements.get("deliveryOverlay").hidden,false);
  const retry=boot({lifecycle:true,failPathOnce:true});
  retry.request("retry");retry.create();
  await flush();
  retry.tick();await flush();await flush();
  assert.equal(retry.showCalls,1,"a transient bootstrap rejection must not poison all later requests");
  console.log("delivery bootstrap preservation and Eagle readiness tests passed");
})().catch(error=>{console.error(error);process.exitCode=1;});
