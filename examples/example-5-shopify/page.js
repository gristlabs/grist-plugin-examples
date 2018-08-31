'use strict';

/* global grist, document, console */

let resolve, reject;
grist.rpc.registerImpl('shopify', {
  getImportSource: () => new Promise((_resolve, _reject) => {
    resolve = _resolve;
    reject = _reject;
  })
});

grist.ready();

document.addEventListener('DOMContentLoaded', importShopify);

function importShopify() {
  document.forms.shopify.addEventListener('submit', ev => {
    ev.preventDefault();
    grist.rpc.callRemoteFunc('importShopify@server/index.js', {
      category: document.forms.shopify.category.value
    })
    .then(resp => {
      resolve(resp);
    });
  });
}
