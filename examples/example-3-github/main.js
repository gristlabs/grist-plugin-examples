"use strict";

/* global grist, self */

self.importScripts('/grist-plugin-api.js');

grist.addImporter('github', 'index.html', 'inline');
grist.ready();
