# Elowen shared Python library (import pipeline, answers, LLM clients).
#
# Used by the FastAPI backend via PYTHONPATH. Not a Firebase Cloud Functions
# deployment package anymore.

# Install (from repo root or this directory):
#   python3 -m venv .venv && source .venv/bin/activate
#   pip install -r requirements.txt
#
# Run unit tests:
#   python3 -m unittest discover -s . -p "*_test.py"
#
# Local paper import helper:
#   python3 script_local_import.py --help
#
# Configure LLM keys by copying models/api_config.example.py → api_config.py
# (or set ELOWEN_* environment variables; see the example file).
