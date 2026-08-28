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
"""Script to test the personal_summary.py generation logic locally."""

import os
import sys

# Add the project root to sys.path to allow imports.
script_dir = os.path.dirname(__file__)
# Assuming project root is two levels up from this script:
project_root = os.path.abspath(os.path.join(script_dir, '..'))
sys.path.insert(0, project_root)

from import_pipeline.personal_summary import get_personal_summary
from shared.elowen_doc import ElowenDoc, ElowenSection, ElowenContent, TextContent, ElowenSpan, Heading
from shared.types_local_storage import PaperData


def create_dummy_doc() -> ElowenDoc:
    """Creates a hardcoded ElowenDoc for testing."""
    span1 = ElowenSpan(id='s1', text='Gemini is a family of multimodal models developed by Google.', inner_tags=[])
    span2 = ElowenSpan(id='s2', text='It was announced on December 6, 2023.', inner_tags=[])
    span3 = ElowenSpan(id='s3', text='The family includes Gemini Ultra, Gemini Pro, and Gemini Nano.', inner_tags=[])
    span4 = ElowenSpan(id='s4', text='Elowen is an experimental AI reading app that uses Gemini.', inner_tags=[])

    doc = ElowenDoc(
        markdown='',
        concepts=[],
        sections=[
            ElowenSection(
                id='sec1',
                heading=Heading(heading_level=1, text='About Gemini'),
                contents=[
                    ElowenContent(
                        id='c1',
                        text_content=TextContent(tag_name='p', spans=[span1, span2])
                    ),
                    ElowenContent(
                        id='c2',
                        text_content=TextContent(tag_name='p', spans=[span3])
                    )
                ]
            ),
            ElowenSection(
                id='sec2',
                heading=Heading(heading_level=1, text='About Elowen'),
                contents=[
                    ElowenContent(
                        id='c3',
                        text_content=TextContent(tag_name='p', spans=[span4])
                    )
                ]
            )
        ]
    )
    return doc

def create_dummy_past_papers() -> list[PaperData]:
    """Creates a hardcoded list of past PaperData for testing."""
    # For now, this is empty, but can be expanded for more complex tests.
    return []


def main():
    """Main function to run the script."""
    # Create a dummy ElowenDoc and past papers for testing
    doc = create_dummy_doc()
    past_papers = create_dummy_past_papers()
    print("Using a dummy document and empty past papers list for context...")

    print("Generating personal summary...")
    personal_summary = get_personal_summary(doc, past_papers)

    print("\n" + "="*20 + " RESULT " + "="*20)
    print("\nResponse:")
    for span in personal_summary.response:
        print(f"  Span Text: {span.text}")
        if span.inner_tags:
            print("  Inner Tags:")
            for tag in span.inner_tags:
                print(f"    - {tag.tag_name.value}: {tag.metadata}")


    print("="*48 + "\n")


if __name__ == "__main__":
    main()