const os = require('os');
const path = require('path');
require('dotenv').config({ path: path.resolve(os.homedir(), '.shopify') });
const Shopify = require('shopify-api-node');

const grist = require('grist-plugin-api');

grist.rpc.registerFunc('importShopify', params => {
  let shopify = new Shopify({
    shopName: process.env.SHOPIFY_STORE_NAME,
    apiKey: process.env.SHOPIFY_API_KEY,
    password: process.env.SHOPIFY_API_SECRET
  });

  return shopify[params.category].list()
    .then(data => {
      return {
        item: {
          kind: 'fileList',
          files: [{ content: JSON.stringify(data), name: 'shopify.json' }],
        },
        description: 'Import from Shopify'
      };
    });
});
grist.ready();
