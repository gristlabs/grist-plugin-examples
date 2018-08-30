"use strict";

const grist = require('grist-plugin-api');
const childProcess = require('child_process');

let notebookProcess = null;
let notebookUrl = null;

function startOrReuse() {
  return notebookUrl || (notebookUrl = start());
}

function start() {
  notebookProcess = childProcess.spawn("jupyter", ["notebook", "--no-browser", "-y"], {
    shell: false,   // TODO either true or false work
    stdio: ['ignore', 'inherit', 'pipe'],
  });

  // Get the notebook URL from parsing the process's stderr.
  return new Promise((resolve, reject) => {
    const stderr = [];
    notebookProcess.on('error', reject);
    notebookProcess.on('exit', (code, signal) => {
      if (signal || code) {
        reject(new Error(`jupyter notebook exited with ${signal || code}\n${stderr.join("")}`));
      }
    });
    notebookProcess.stderr.on('data', (data) => {
      data = data.toString();
      stderr.push(data);
      console.log("DATA", data.replace(/\s+$/, ''));
      const match = /(http:\/\/localhost[\S]*)\/(\?\S+)/.exec(data);
      if (match) { resolve(`${match[1]}/notebooks/Untitled.ipynb${match[2]}`); }
    });
  });
}

process.on('exit', () => {
  if (notebookProcess) { notebookProcess.kill(); }
});

grist.rpc.registerFunc("startOrReuse", startOrReuse);
grist.ready();
