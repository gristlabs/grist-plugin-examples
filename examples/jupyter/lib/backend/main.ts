"use strict";

import * as grist from 'grist-plugin-api';
import {ChildProcess, spawn} from 'child_process';

let notebookProcess: ChildProcess|null = null;
let notebookUrl: Promise<string>|null = null;

async function startOrReuse(): Promise<string> {
  const stub = grist.rpc.getStub<grist.GristDocAPI>("GristDocAPI@grist", grist.checkers.GristDocAPI);
  console.warn("getDocName", await stub.getDocName());
  console.warn("getDocPath", await stub.getDocPath());
  return notebookUrl || (notebookUrl = start());
}

// TODO: This is needed in ~/.jupyter/jupyter_notebook_config.py
// c.NotebookApp.tornado_settings = {
//   'headers': {
//     'Content-Security-Policy': "frame-ancestors 'self' http://localhost:8080 http://getgrist.localtest.me:8080 http://127.0.0.1:8080"
//     // "UNTRUSTED-CONTENT-HOST:GRIST-PORT"
//   }
// }

function start(): Promise<string> {
  const child = spawn("jupyter", ["notebook", "--no-browser", "-y"], {
    stdio: ['ignore', 'inherit', 'pipe'],
  });
  notebookProcess = child;

  // Get the notebook URL from parsing the process's stderr.
  return new Promise<string>((resolve, reject) => {
    const stderr: string[] = [];
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (signal || code) {
        reject(new Error(`jupyter notebook exited with ${signal || code}\n${stderr.join("")}`));
      }
    });
    child.stderr.on('data', (data) => {
      data = data.toString();
      stderr.push(data);
      console.log("from jupyter:", data.replace(/\s+$/, ''));
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
