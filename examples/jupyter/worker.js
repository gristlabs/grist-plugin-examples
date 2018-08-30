"use strict";
/* global grist, self */

self.importScripts('/grist-plugin-api.js');

grist.rpc.registerFunc("greet", name => {
  return `Dear ${name}, webworker welcomes you`;
});
grist.ready();
