## Installation

First, you'll need to install the required npm dependencies:

1. Go to the `server` directory (e.g. `cd server`)
2. Run `npm install`

## Setup

You'll need to add your Shopify store credentials to `.shopify` in your user's home director (e.g. `/Users/alice~/.shopify`).

The following three parameters should be present in the file:


```
SHOPIFY_STORE_NAME="<your store name>"
SHOPIFY_API_KEY="<your API key>"
SHOPIFY_API_SECRET="<your API secret>"
```

## Note

The plugin caches data that it fetches from shopify under `$APP_ROOT/data.json`. To clear the cache delete the file ($APP_ROOT is the root of grist app).
