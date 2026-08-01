"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const source = fs.readFileSync(
  path.join(__dirname, "..", "plugin.js"),
  "utf8"
);

assert.match(
  source,
  /async function persistDiagnosticFailure\(phase, error\) \{[\s\S]*?error\?\.stack[\s\S]*?appendFile\([\s\S]*?diagnosticPath/s,
  "injection failures must persist their complete stack in diagnostic.log"
);
assert.match(
  source,
  /async function inject\(\) \{\s+try \{\s+return await injectIntoMain\(\);\s+\} catch \(error\) \{\s+await persistDiagnosticFailure\("INJECTION_FAILURE", error\);[\s\S]*?throw error;\s+\}\s+\}/s,
  "inject must persist the exact failure before handing control back to the retry loop"
);
assert.match(
  source,
  /catch \(error\) \{\s+injectionReady = false;\s+if \(!error\?\.__eaglePhotoDiagnosticLogged\) \{\s+await persistDiagnosticFailure\("MONITOR_FAILURE", error\);/s,
  "monitor-only failures must also be persisted without duplicating an injection record"
);
assert.match(
  source,
  /failureDiagnosticSignature[\s\S]*?failureDiagnosticAt[\s\S]*?60_000/,
  "repeated failures must be rate-limited instead of flooding the diagnostic file"
);

console.log("injection diagnostic persistence contract passed");
