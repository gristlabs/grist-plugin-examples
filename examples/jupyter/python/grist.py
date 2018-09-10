"""
Python interface to Grist.
"""

import os
import pandas

GRIST_URL = os.getenv("GRIST_API_SERVER_URL")

def list_tables():
  """Fetches and returns a list of table ids in the current document."""
  return pandas.read_json(GRIST_URL + "/tables")[0].tolist()

def fetch_table(table_id):
  """Returns the given table's data from the current document, as a pandas data frame."""
  return pandas.read_json(GRIST_URL + "/tables/" + table_id)
