"use strict";

const grist = require('grist-plugin-api');
const { PsImporter } = require('./PsImportSource');


grist.rpc.registerImpl('psaux', new PsImporter());
