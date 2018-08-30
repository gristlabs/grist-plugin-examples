"use strict";

/* global grist, window, document, fetch */

let resolve, reject;
grist.rpc.registerImpl('github', {
  getImportSource: () => new Promise((_resolve, _reject) => {
    resolve = _resolve;
    reject = _reject;
  })
});

grist.ready();

window.onload = function() {
  document.getElementById('import').addEventListener('click', () => {
    const name = document.getElementById('name').value;
    fetch(`https://api.github.com/users/${name}/repos`).then(
      resp => resp.text()
    ).then(
      resp => resolve({
        item: {
          kind: "fileList",
          files: [{content: resp, name: "repos.json"}]
        },
        description: `Github repositories of ${name}`
      }));
  });
  document.getElementById('cancel').addEventListener('click', () => resolve());
};
