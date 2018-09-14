const os = require('os');
const path = require('path');
require('dotenv').config({ path: path.resolve(os.homedir(), '.shopify') });
const shopifyWildflower = require('./shopify-wildflower');

const grist = require('grist-plugin-api');

grist.rpc.registerImpl('shopify', {
  getImportSource: () => shopifyWildflower.list()
    .then(data => ({
      item: {
        kind: 'fileList',
        files: [{content: JSON.stringify(data), name: 'wildflower-shopify.jgrist'}]
      },
      description: 'Import from shopify'
    }))
});
grist.ready();
