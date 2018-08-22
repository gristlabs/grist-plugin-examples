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

grist.rpc.registerImpl('github', new Importer(), grist.ImportSourceDescription);
grist.ready();
