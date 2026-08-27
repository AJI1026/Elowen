# Copyright 2025 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
# ==============================================================================

import time

import requests
from bs4 import BeautifulSoup

import xml.etree.ElementTree as ET
from shared import string_utils
from shared.types import ArxivMetadata

_ARXIV_USER_AGENT = "Lumi/1.0 (+https://lumi.withgoogle.com)"
_ARXIV_REQUEST_TIMEOUT_SECONDS = 15
_ARXIV_MAX_RETRIES = 3
_ARXIV_RETRYABLE_HTTP_STATUSES = {429, 500, 502, 503, 504}
_ARXIV_RETRYABLE_EXCEPTIONS = (
    requests.exceptions.SSLError,
    requests.exceptions.ConnectionError,
    requests.exceptions.Timeout,
)

VALID_LICENSES = {
    "creativecommons.org/licenses/by/4.0/",
    "creativecommons.org/licenses/by-sa/4.0/",
    "creativecommons.org/share-your-work/public-domain/cc0/",
}

INVALID_LICENSE = {
    "arxiv.org/licenses/nonexclusive-distrib/1.0/",
}


def _arxiv_get(
    url: str,
    params: dict | None = None,
    max_retries: int = _ARXIV_MAX_RETRIES,
    timeout_seconds: int = _ARXIV_REQUEST_TIMEOUT_SECONDS,
) -> requests.Response:
    """Fetches a URL from arXiv with retries for flaky network/SSL errors."""
    headers = {"User-Agent": _ARXIV_USER_AGENT}
    last_error: Exception | None = None

    for attempt in range(max_retries):
        try:
            response = requests.get(
                url,
                params=params,
                headers=headers,
                timeout=timeout_seconds,
            )
            if response.status_code in _ARXIV_RETRYABLE_HTTP_STATUSES:
                last_error = requests.exceptions.HTTPError(
                    f"Retryable HTTP status: {response.status_code}",
                    response=response,
                )
            else:
                response.raise_for_status()
                return response
        except _ARXIV_RETRYABLE_EXCEPTIONS as error:
            last_error = error
        except requests.exceptions.HTTPError as error:
            if (
                error.response is not None
                and error.response.status_code in _ARXIV_RETRYABLE_HTTP_STATUSES
            ):
                last_error = error
            else:
                raise

        if attempt < max_retries - 1:
            time.sleep(min(2 ** attempt, 10))

    if last_error is not None:
        raise last_error
    raise RuntimeError(f"Failed to fetch {url}")


def check_arxiv_license(arxiv_id: str) -> None:
    """
    Checks the license of an arXiv paper from its abstract page.

    Args:
        arxiv_id (str): The arXiv paper ID.

    Raises:
        ValueError: If an invalid license is found, or if no valid license is found.
    """
    url = f"https://arxiv.org/abs/{arxiv_id}"
    response = _arxiv_get(url)

    soup = BeautifulSoup(response.content, "html.parser")
    all_hrefs = [a_tag.get("href", "") for a_tag in soup.find_all("a")]

    for href in all_hrefs:
        for invalid in INVALID_LICENSE:
            if invalid in href:
                raise ValueError(
                    "Paper has a non-exclusive license and cannot be processed."
                )

    found_license = False
    for href in all_hrefs:
        for valid in VALID_LICENSES:
            if valid in href:
                found_license = True

    if not found_license:
        raise ValueError("No valid license found.")


def fetch_pdf_bytes(url) -> bytes:
    """
    Fetches the content of a given URL.

    Args:
        url (str): The URL to fetch the PDF from.

    Returns:
        bytes: The content of the URL if the request is successful,
             raises error otherwise.
    """

    response = _arxiv_get(url)

    return response.content


def fetch_arxiv_metadata(arxiv_ids: list[str]) -> list[ArxivMetadata]:
    """
    Fetches arXiv metadata for the given ids from the arXiv api.

    Args:
        arxiv_ids (list[str]): The ids to fetch.

    Returns:
        list[ArxivMetadata]: A list of metadata for the given ids.
    """
    if isinstance(arxiv_ids, str):
        arxiv_ids = [arxiv_ids]

    try:
        return _fetch_arxiv_metadata_from_api(arxiv_ids)
    except Exception:
        # export.arxiv.org is often unreachable or rate-limited from some networks.
        # Fall back to parsing the abstract HTML pages, which are usually reachable.
        return [_fetch_arxiv_metadata_from_abs(arxiv_id) for arxiv_id in arxiv_ids]


def _fetch_arxiv_metadata_from_api(arxiv_ids: list[str]) -> list[ArxivMetadata]:
    params = {"id_list": ",".join(arxiv_ids)}
    # Fail fast so we can fall back to HTML parsing instead of burning the
    # callable timeout on a hanging export.arxiv.org connection.
    response = _arxiv_get(
        "https://export.arxiv.org/api/query",
        params=params,
        max_retries=1,
        timeout_seconds=10,
    )

    xml_content = response.content
    root = ET.fromstring(xml_content)

    arxiv_metadata_list = []
    for entry in root.findall(_format_atom_field("entry")):
        versioned_id = string_utils.get_arxiv_versioned_id(
            entry.find(_format_atom_field("id")).text
        )
        arxiv_id, version = string_utils.get_id_and_version(versioned_id)

        authors = []
        for author in entry.findall(_format_atom_field("author")):
            authors.append(author.find(_format_atom_field("name")).text)

        arxiv_metadata_list.append(
            ArxivMetadata(
                paper_id=arxiv_id,
                version=version,
                authors=authors,
                title=entry.find(_format_atom_field("title")).text,
                summary=entry.find(_format_atom_field("summary")).text.strip(),
                updated_timestamp=entry.find(_format_atom_field("updated")).text,
                published_timestamp=entry.find(_format_atom_field("published")).text,
            )
        )
    return arxiv_metadata_list


def _fetch_arxiv_metadata_from_abs(arxiv_id: str) -> ArxivMetadata:
    response = _arxiv_get(f"https://arxiv.org/abs/{arxiv_id}")
    soup = BeautifulSoup(response.content, "html.parser")

    def meta_contents(name: str) -> list[str]:
        return [
            tag.get("content", "").strip()
            for tag in soup.find_all("meta", attrs={"name": name})
            if tag.get("content")
        ]

    def meta_content(name: str) -> str:
        values = meta_contents(name)
        return values[0] if values else ""

    title = meta_content("citation_title")
    summary = meta_content("citation_abstract")
    authors = meta_contents("citation_author")
    published_raw = meta_content("citation_date") or meta_content("citation_online_date")
    published_timestamp = _normalize_citation_date(published_raw)
    updated_timestamp = published_timestamp

    paper_id = meta_content("citation_arxiv_id") or arxiv_id
    version = "1"
    og_url = ""
    og_tag = soup.find("meta", attrs={"property": "og:url"})
    if og_tag and og_tag.get("content"):
        og_url = og_tag.get("content")
    if og_url:
        versioned_id = string_utils.get_arxiv_versioned_id(og_url)
        paper_id, version = string_utils.get_id_and_version(versioned_id)

    if not title or not summary:
        raise ValueError(f"Could not parse metadata from abs page for {arxiv_id}")

    return ArxivMetadata(
        paper_id=paper_id,
        version=version,
        authors=authors,
        title=title,
        summary=summary,
        updated_timestamp=updated_timestamp,
        published_timestamp=published_timestamp,
    )


def _normalize_citation_date(date_str: str) -> str:
    """Converts citation_date values like 2026/03/12 into ISO-8601 UTC."""
    if not date_str:
        return ""
    if "T" in date_str:
        return date_str
    parts = date_str.replace("-", "/").split("/")
    if len(parts) == 3:
        year, month, day = parts
        return f"{year}-{month.zfill(2)}-{day.zfill(2)}T00:00:00Z"
    return date_str


def _format_atom_field(field_name: str) -> str:
    return "{http://www.w3.org/2005/Atom}" + field_name


def fetch_latex_source(arxiv_id: str, version: str) -> bytes:
    """
    Fetches the LaTeX source as a .tar.gz file from arXiv.

    Args:
        arxiv_id (str): The arXiv paper ID.
        version (str): The version of the paper.

    Returns:
        bytes: The content of the .tar.gz file if the request is successful,
               raises an error otherwise.
    """
    url = f"https://arxiv.org/src/{arxiv_id}v{version}"
    response = _arxiv_get(url)

    # Check if the content type indicates a gzipped tarball
    content_type = response.headers.get("Content-Type", "")
    if (
        "application/x-gzip" not in content_type
        and "application/gzip" not in content_type
    ):
        # This can happen if the paper only has a PDF source.
        raise ValueError(
            f"Expected gzipped tarball, but got Content-Type: {content_type} for {url}"
        )

    return response.content
