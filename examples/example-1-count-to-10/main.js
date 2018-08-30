"use strict";

/* global grist, self */

self.importScripts('/grist-plugin-api.js');

grist.addImporter('count_to_10', 'index.html', 'fullscreen');
grist.addImporter('inline_count_to_10', 'index.html', 'inline');

grist.ready();
