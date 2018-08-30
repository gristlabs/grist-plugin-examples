'use strict';

const path = require('path');

module.exports = {
  target: 'web',
  entry: { "frontend": "./dist/frontend/section.js", },
  output: {
    filename: "[name].bundle.js",
    sourceMapFilename: "[file].map",
    path: path.resolve("./dist"),
  },
  resolve: {
    // Add '.ts' and '.tsx' as a resolvable extension.
    extensions: [".webpack.js", ".web.js", ".ts", ".tsx", ".js"],
    modules: [
      path.resolve('.'),
      path.resolve('./node_modules')
    ]
  },
  node: {
    process: false
  }
};
