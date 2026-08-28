# Elowen Firebase Cloud Functions

Defines cloud functions for Elowen backend.

## Set-up

1. Make sure to be in the functions directory:

```
cd functions
```

2. Create and activate a virtual env in this functions directory:

```
python3 -m venv venv
source venv/bin/activate
```

3. To install dependencies:

```
pip install -r requirements.txt
```

4. Configure the **server-side** model and API key.

This is used by backend import / formatting (not the Key you enter in the
frontend Settings page, which is stored in the browser for in-paper Ask).

```
cp models/api_config.example.py models/api_config.py
```

`models/api_config.py` is gitignored. Edit it and/or set environment
variables before starting the emulator:

| Setting | In `api_config.py` | Environment override |
| --- | --- | --- |
| Provider (`gemini` / `deepseek` / `openai`) | `MODEL_PROVIDER` | `ELOWEN_MODEL_PROVIDER` |
| Default model | `MODEL_NAME` | `ELOWEN_MODEL_NAME` |
| Strong model (import / PDF) | `MODEL_NAME_STRONG` | `ELOWEN_MODEL_NAME_STRONG` |
| API key | `DEFAULT_API_KEY` | `ELOWEN_API_KEY` |
| OpenAI-compatible base URL | `BASE_URL` | `ELOWEN_BASE_URL` |

Example (DeepSeek via env, then start emulators):

```bash
export ELOWEN_MODEL_PROVIDER=deepseek
export ELOWEN_API_KEY=sk-...
firebase emulators:start
```

## Running locally

To run the local emulator:

```
firebase emulators:start
```

To run with local emulator data:

```
firebase emulators:start --import .local_emulator_data
```

To view the hard-coded collection in the emulator, navigate to: http://localhost:4201/#/collections/test_collection

## Deployment

To deploy functions:

```
firebase deploy --only functions
```

## Testing

To run unittests:

```
python3 -m unittest discover -p "*_test.py"
```

To run the integration test:

```
FUNCTION_RUN_MODE=testing firebase emulators:exec 'python3 -m unittest discover -p "main_integration.py"'
```

## Utility Scripts

This directory contains several Python scripts to help manage Firestore data.

(See [instructions](https://firebase.google.com/docs/admin/setup) for setting up Firebaes Admin SDK credentials.)

### `script_firebase_import.py`

Imports papers into Firestore from a CSV file. The script (1) triggers the `start_arxiv_doc_import` function for each paper, which writes the initial doc to Firestore, triggering the document import, and (2) adds the paper ID to the specified collection.

**Usage:**

```bash
python3 script_firebase_import.py --csv_file <path_to_csv> [--delay <seconds>]
```

- `--csv_file`: (Required) Path to the CSV file. The CSV must contain 'arxiv_id' and 'collection' headers.
- `--delay`: (Optional) Seconds to wait between importing each paper. Defaults to 10.

---

### `script_firebase_update_collections.py`

Updates collection metadata in Firestore based on a local configuration within the script itself. You must edit the `COLLECTIONS` list in the script file before running it.

**Usage:**

```bash
python3 script_firebase_update_collections.py [--overwrite_paper_ids]
```

- `--overwrite_paper_ids`: (Optional) If set, this will overwrite the `paper_ids` array in the Firestore collection with the one defined in the script. Use with caution. Defaults to `False`.

---

### `script_firebase_list.py`

Lists document IDs from the `arxiv_docs` collection that match a specific `loadingStatus`.

**Usage:**

```bash
python3 script_firebase_list.py --loading_status <status> [--output_file]
```

- `--loading_status`: (Required) The loading status to filter by (e.g., `WAITING`, `SUCCESS` - see the LoadingStatus Enum in shared/types.py).
- `--output_file`: (Optional) If set, writes the list of paper IDs to a timestamped `.txt` file.

---

### `script_firebase_list_all.py`

Runs `script_firebase_list.py` for every status in `LoadingStatus`.

**Usage:**

```bash
python3 script_firebase_list_all.py
```

This script takes no arguments.

---

### `script_firebase_check_status.py`

Checks the current `loadingStatus` for a list of paper IDs provided in a text file.

**Usage:**

```bash
python3 script_firebase_check_status.py --paper_ids_file <path_to_txt>
```

- `--paper_ids_file`: (Required) Path to a text file containing a list of paper IDs, one per line.

---

### `script_firebase_update_status.py`

Updates the `loadingStatus` for a list of papers provided in a text file.

**Usage:**

```bash
python3 script_firebase_update_status.py --paper_ids_file <path_to_txt> --status <new_status>
```

- `--paper_ids_file`: (Required) Path to a text file containing a list of paper IDs, one per line.
- `--status`: (Required) The new `LoadingStatus` to set for the papers.
- `--delay`: (Optional) Seconds to wait between importing each paper. Defaults to 0.
