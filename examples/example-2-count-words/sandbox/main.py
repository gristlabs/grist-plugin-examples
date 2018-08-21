import os
import sandbox

def parse_file(file_source, options):
  file_path = os.path.join('/importdir', file_source['path'])
  lines = []
  with open(file_path, 'r') as f:
    for line in f:
      x = line.rstrip()
      words = line.split(' ')
      lines.append([x, len(x), len(words)])
  return dump_tables(file_source['origName'], lines)

def dump_tables(file_name, lines):
  return {
    'tables': [{
      'table_name': file_name,
      'column_metadata': [
        {'id': 'line',  'type': 'Text'},
        {'id': 'nchar', 'type': 'Int'},
        {'id': 'nword', 'type': 'Int'
      }],
      'table_data': [
        [line[0] for line in lines],
        [line[1] for line in lines],
        [line[2] for line in lines],]
    }],
    'parseOptions': {}
  }

def main():
  sandbox.register("line_stats.parseFile", parse_file)
  sandbox.run()

if __name__ == "__main__":
  main()
