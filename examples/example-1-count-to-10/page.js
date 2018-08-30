"use strict";

/* global grist, window, document */

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

const importer = grist.handleImporter('count_to_10');
const inlineImporter = grist.handleImporter('inline_count_to_10');

grist.ready();

window.onload = function() {
  document.getElementById('import').addEventListener('click', () => {
    const importSource = {
      item: {
        kind: "fileList",
        files: [{content: numbers, name: "numbers.csv"}]
      },
      description: "The numbers between 1 and 10"
    };
    importer.getImportSource.resolve(importSource);
    inlineImporter.getImportSource.resolve(importSource);
  });
  document.getElementById('cancel').addEventListener('click', () => {
    // resolving with with no-argument causes import to cancel.
    importer.getImportSource.resolve();
    inlineImporter.getImportSource.resolve();
  });
};
