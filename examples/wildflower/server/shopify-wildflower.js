const os = require('os');
const path = require('path');
require('dotenv').config({ path: path.resolve(os.homedir(), '.shopify') });
const Shopify = require('shopify-api-node');
const fs = require('fse');
const _ = require('lodash');

const BACKUP_JSON = "_data_.json";

function fetchData() {
  console.warn("fetching data from shopify");
  let shopify = new Shopify({
    shopName: process.env.SHOPIFY_STORE_NAME,
    apiKey: process.env.SHOPIFY_API_KEY,
    password: process.env.SHOPIFY_API_SECRET
  });

  return shopify.order.list({status: 'any'})
}

/**
 * Try to read data from data.json. If file is not found fetch from shopify.
 */
function loadData() {
  const filepath = "./data.json";
  return fs.readFile(filepath, 'utf8')
    .then(content => JSON.parse(content))
    .catch(err => {
      return fetchData()
        .then(data => {
          fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
          return data;
        });
    })
}

// default gristType to 'Text' if omitted
const line_items_properties = createProperties([
  {
    key: "price",
    gristType: "Numeric",
  },
  "title",
  {key: 'quantity', gristType: 'Int'},
  {key: 'price', gristType: 'Numeric'},
  'sku',
  'variant_title',
  'name',
  {
    key: 'discount',
    gristType: 'Numeric',
    value: line_item => _.sum(line_item.discount_allocations.map(da => Number(da.amount)))
  },
  {
    key: 'ordered_at',
    gristType: 'Text',
    value: (li, order) => {
      const d = new Date(order.created_at);
      return `${d.getFullYear()}-${d.getMonth()}`;
    }
  },
  {
    key: 'order_name',
    gristType: 'Text',
    value: (li, order) => order.name
  }
]);

function createProperties(props) {
  return props.map(prop => {
    if (typeof prop === 'string') {
      return {
        key: prop,
        gristType: 'Text',
      };
    }
    return prop;
  });
}

function pick_line_items(orders, prop) {
  const values = [];
  for (const order of orders) {
    if (order.line_items) {
      for (const li of order.line_items) {
        values.push(prop.value ? prop.value(li, order) : li[prop.key]);
      }
    }
  }
  return values;
}

function processData(orders) {
  return {
    tables: [{
      table_name: "line_items",
      column_metadata: line_items_properties.map(prop => ({
        id: prop.key,
        type: prop.gristType
      })),
      table_data: line_items_properties.map(prop => pick_line_items(orders, prop))
    }]
  };
}

function list() {
  return loadData().then(processData);
}
exports.list = list;

if (require.main === module) {
  list()
    .then(data => {
      console.log(JSON.stringify(data));
    }).catch(err => console.error(err));
}
