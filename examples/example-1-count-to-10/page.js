"use strict";

/* global grist, window, document, $ */

const numbers = [
  "name,numeric",
  "one,1",
  "two,2",
  "three,3",
  "four,4",
  "five,5",
  "six,6",
  "seven,7",
  "eight,8",
  "nine,9",
  "ten,10"].join('\n');

let resolve, reject;
grist.rpc.registerFunc('getImportSource', () => new Promise((_resolve, _reject) => {
  console.log("saving resolver", _resolve);
  resolve = _resolve;
  reject = _reject;
}));

grist.ready();

window.onload = function() {
  document.getElementById('import').addEventListener('click', () => {
    resolve({
      item: {
        kind: "fileList",
        files: [{content: numbers, name: "numbers.csv"}]
      },
      description: "The numbers between 1 and 10"
    });
  });
  document.getElementById('cancel').addEventListener('click', () => {
    // resolving with with no-argument causes import to cancel.
    resolve();
  });
};
