// tslint:disable:no-console
"use strict";

import {ChildProcess, spawn} from 'child_process';
import * as express from 'express';
import * as fse from 'fs-extra';
import * as grist from 'grist-plugin-api';
import * as path from 'path';

let notebookProcess: ChildProcess|null = null;
let notebookUrl: Promise<string>|null = null;
const gristDocAPI = grist.rpc.getStub<grist.GristDocAPI>("GristDocAPI@grist", grist.checkers.GristDocAPI);
const defaultNotebookPath = path.resolve(__dirname, "..", "..", "default.ipynb");

function expressWrap(callback: (req: express.Request, res: express.Response) => any): express.RequestHandler {
  return async (req, res, next) => {
    try {
      res.json(await callback(req, res));
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Starts an API server, and returns its URL.
 */
async function startAPIServer(): Promise<string> {
  const app = express();

  app.route('/tables')
  .get(expressWrap(() => gristDocAPI.listTables()));
  // .post(expressWrap((req) => gristDocAPI.createTable(req.body)));

  app.route('/tables/:tableId')
  .get(expressWrap(async (req) => gristDocAPI.fetchTable(req.params.tableId)));
  // .put(expressWrap((req) => gristDocAPI.replaceTableData(req.params.tableId, req.body)))
  // .delete(expressWrap((req) => gristDocAPI.removeTable(req.params.tableId)));

  const server = app.listen(0, 'localhost');
  await new Promise((resolve) => server.once('listening', resolve));
  const serverUrl = `http://localhost:${server.address().port}`;
  console.log("REST interface started at %s", serverUrl);
  return serverUrl;
}

async function startOrReuse(parentHost: string): Promise<string> {
  return notebookUrl || (notebookUrl = start(parentHost));
}

async function start(parentHost: string): Promise<string> {
  const docPath = process.env.GRIST_DOC_PATH;
  if (!docPath || path.extname(docPath) !== ".grist") {
    throw new Error(`Invalid or missing document path: ${docPath}`);
  }
  const parsedPath = path.parse(docPath);
  const notebookPath = path.format({dir: parsedPath.dir, name: parsedPath.name, ext: '.ipynb'});
  const pythonRoot = path.resolve(__dirname, "..", "..", "python");
  const PYTHONPATH = (process.env.PYTHONPATH || '') + ':' + pythonRoot;

  if (await fse.pathExists(notebookPath)) {
    console.log("Using existing notebook at %s", notebookPath);
  } else {
    console.log("Creating default notebook at %s", notebookPath);
    await fse.copy(defaultNotebookPath, notebookPath);
  }

  const serverUrl = await startAPIServer();

  // Jupyter defaults prevent notebooks from being shown in frames of other hosts (the CSP sets
  // frame-ancestors to 'self'). To show them in Grist, we need to allow localhost and the origin
  // of the iframe containing the Jupyter iframe (untrusted-content-host, aka parentHost here).
  console.log("Starting Jupyter in %s, parentHost %s", parsedPath.dir, parentHost);
  const child = spawn("jupyter", ["notebook", "--no-browser", "-y",
    `--NotebookApp.tornado_settings={'headers':{'Content-Security-Policy':` +
    `"frame-ancestors 'self' http://localhost:* ${parentHost}"}}`,
  ], {
    cwd: parsedPath.dir,
    stdio: ['ignore', 'inherit', 'pipe'],
    env: {...process.env, GRIST_API_SERVER_URL: serverUrl, PYTHONPATH},
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
