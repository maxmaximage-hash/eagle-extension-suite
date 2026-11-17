"use strict";
const assert = require("node:assert/strict");
const {createDeliveryEntryConsumer} = require("../delivery-entry.js");
(async () => {
  let request = {version:1,id:"one",action:"manage-delivery-templates",templateId:"tier-6600",requestedAt:new Date().toISOString()};
  let count = 0;
  const consumer = createDeliveryEntryConsumer({
    read:async () => request,
    remove:async id => { if (request?.id===id) request=null; },
    open:async payload => { assert.equal(payload.templateId,"tier-6600"); count++; }
  });
  await Promise.all([consumer(),consumer(),consumer()]);
  assert.equal(count,1);
  assert.equal(request,null);
  request={version:1,id:"stale",action:"manage-delivery-templates",requestedAt:"2000-01-01T00:00:00Z"};
  await consumer(); assert.equal(count,1); assert.equal(request,null);
  request={version:1,id:"two",action:"manage-delivery-templates",templateId:"tier-6600",requestedAt:new Date().toISOString()};
  await consumer(); assert.equal(count,2);
  let attempts=0;
  request={version:1,id:"retry",action:"manage-delivery-templates",requestedAt:new Date().toISOString()};
  const retry=createDeliveryEntryConsumer({read:async()=>request,remove:async()=>{request=null;},open:async()=>{ if(++attempts===1)throw Error("temporary"); }});
  await assert.rejects(retry(),/temporary/);
  await retry(); assert.equal(attempts,2); assert.equal(request,null);
  console.log("delivery entry lifecycle tests passed");
})().catch(error=>{console.error(error);process.exitCode=1;});
