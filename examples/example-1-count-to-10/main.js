"use strict";

/* global grist, self */

self.importScripts('/grist-plugin-api.js');

class Importer {
  getImportSource() {
    return grist.api.render('index.html', 'fullscreen')
      .then((procId) => grist.rpc.callRemoteFunc('getImportSource@index.html', [])
        .then((res) => (grist.api.dispose(procId), res)));
  }
}

class InlineImporter {
  getImportSource(inlineTarget) {
    return grist.api.render('index.html', inlineTarget)
      .then((procId) => grist.rpc.callRemoteFunc('getImportSource@index.html', [])
        .then((res) => (grist.api.dispose(procId), res)));
  }
}

grist.rpc.registerImpl('count_to_10', new Importer(), grist.ImportSourceDescription);

grist.rpc.registerImpl('inline_count_to_10', new InlineImporter(), grist.ImportSourceDescription);

grist.ready();
