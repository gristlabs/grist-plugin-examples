"use strict";

import * as fse from 'fs-extra';
import * as grist from 'grist-plugin-api';
import {ChildProcess, spawn} from 'child_process';
import * as path from 'path';

let notebookProcess: ChildProcess|null = null;
let notebookUrl: Promise<string>|null = null;
const gristAPI = grist.rpc.getStub<grist.GristDocAPI>("GristDocAPI@grist", grist.checkers.GristDocAPI);
const defaultNotebookPath = path.resolve(__dirname, "..", "..", "default.ipynb");

async function startOrReuse(parentHost: string): Promise<string> {
  return notebookUrl || (notebookUrl = start(parentHost));
}

async function start(parentHost: string): Promise<string> {
  const docPath = await gristAPI.getDocPath();
  const parsedPath = path.parse(docPath);
  const notebookPath = path.format({dir: parsedPath.dir, name: parsedPath.name, ext: '.ipynb'});

  if (await fse.pathExists(notebookPath)) {
    console.log("Using existing notebook at %s", notebookPath);
  } else {
    console.log("Creating default notebook at %s", notebookPath);
    await fse.copy(defaultNotebookPath, notebookPath);
  }

  // Jupyter defaults prevent notebooks from being shown in frames of other hosts (the CSP sets
  // frame-ancestors to 'self'). To show them in Grist, we need to allow localhost and the origin
  // of the iframe containing the Jupyter iframe (untrusted-content-host, aka parentHost here).
  console.log("Starting Jupyter in %s, parentHost %s", parsedPath.dir, parentHost);
  const child = spawn("jupyter", ["notebook", "--no-browser", "-y",
    `--NotebookApp.tornado_settings={'headers':{'Content-Security-Policy':"frame-ancestors 'self' http://localhost:* ${parentHost}"}}`,
  ], {
    cwd: parsedPath.dir,
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
      if (match) { resolve(`${match[1]}/notebooks/${path.basename(notebookPath)}${match[2]}`); }
    });
  });
}

process.on('exit', () => {
  if (notebookProcess) { notebookProcess.kill(); }
});

grist.rpc.registerFunc("startOrReuse", startOrReuse);
grist.ready();
