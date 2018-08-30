"use strict";

/* global grist, self */

self.importScripts('/grist-plugin-api.js');

grist.addImporter('shopify', 'index.html', 'inline');
grist.ready();
