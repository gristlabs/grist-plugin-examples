"use strict";

import * as grist from 'grist-plugin-api';
import {ChildProcess, spawn} from 'child_process';

let notebookProcess: ChildProcess|null = null;
let notebookUrl: Promise<string>|null = null;

function startOrReuse(): Promise<string> {
  return notebookUrl || (notebookUrl = start());
}

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
