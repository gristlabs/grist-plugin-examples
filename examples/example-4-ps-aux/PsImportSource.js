"use strict";

const { exec } = require('child_process');

const HEADERS_TYPE = {
  USER: 'Text',
  PID: 'Int',
  '%CPU': 'Numeric',
  '%MEM': 'Numeric',
  'VSZ': 'Int',
  'RSS': 'Int',
  'TT': 'Text',
  'STAT': 'Text',
  'STARTED': 'Text',
  'TIME': 'Text',
  'COMMAND': 'Text',
};

class PsImporter {

  getImportSource() {
    return new Promise(resolve => {
      exec('ps aux', (error, stdout) => {
        // parse stdout
        const [headerLine, ...lines] = stdout.split('\n');
        const headers = headerLine.split(/ +/);
        const parsedEntries = lines.map(entry => entry.split(/ +/, headers.length));

        // format data
        const data = this._formatData(headers, parsedEntries);

        // resolve with import item
        resolve({
          item: {
            kind: "fileList",
            files: [{content: JSON.stringify(data), name: 'import.jgrist'}]
          }
        });
      });
    });
  }

  _formatData(headers, parsedEntries) {
    return {
      tables: [{
        table_name: 'ps aux',
        column_metadata: headers.map(header => ({
          id: header,
          type: HEADERS_TYPE[header] || 'Text',
        })),
        table_data: headers.map((header, index) => parsedEntries.map(chunks => chunks[index]))
      }],
      parseOptions: {}
    };
  }
}
exports.PsImporter = PsImporter;

if (require.main === module) {
  const importer = new PsImporter();
  importer.getImportSource().then(importSource => console.log(`ps aux import source: ${JSON.stringify(importSource)}`));
}
