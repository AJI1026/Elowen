/**
 * @license
 * Copyright 2025 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { ListContent, ListItem, ElowenSpan, TextContent } from "./elowen_doc";

interface DrawioNode {
  id: string;
  label: string;
  children: DrawioNode[];
}

const NODE_WIDTH = 180;
const NODE_HEIGHT = 44;
const H_GAP = 56;
const V_GAP = 18;

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function spansToPlainText(spans: ElowenSpan[]): string {
  return spans
    .map((span) => span.text)
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function listItemToNode(item: ListItem, idPrefix: string): DrawioNode {
  return {
    id: idPrefix,
    label: spansToPlainText(item.spans) || "…",
    children: (item.subListContent?.listItems ?? []).map((child, index) =>
      listItemToNode(child, `${idPrefix}_${index + 1}`)
    ),
  };
}

function buildForest(
  textContents: TextContent[],
  listContents: ListContent[]
): DrawioNode[] {
  const title = textContents
    .map((content) => spansToPlainText(content.spans ?? []))
    .filter(Boolean)
    .join(" · ");

  const rootsFromLists = listContents.flatMap((list, listIndex) =>
    list.listItems.map((item, itemIndex) =>
      listItemToNode(item, `n${listIndex + 1}_${itemIndex + 1}`)
    )
  );

  if (title && rootsFromLists.length > 0) {
    return [
      {
        id: "root",
        label: title,
        children: rootsFromLists,
      },
    ];
  }
  if (title) {
    return [{ id: "root", label: title, children: [] }];
  }
  return rootsFromLists;
}

function subtreeHeight(node: DrawioNode): number {
  if (node.children.length === 0) {
    return NODE_HEIGHT;
  }
  const childrenHeight = node.children.reduce(
    (sum, child) => sum + subtreeHeight(child),
    0
  );
  const gaps = (node.children.length - 1) * V_GAP;
  return Math.max(NODE_HEIGHT, childrenHeight + gaps);
}

interface PlacedCell {
  id: string;
  label: string;
  x: number;
  y: number;
  parentEdgeFrom?: string;
}

function layoutNode(
  node: DrawioNode,
  depth: number,
  top: number,
  parentId: string | undefined,
  out: PlacedCell[]
): void {
  const height = subtreeHeight(node);
  const x = depth * (NODE_WIDTH + H_GAP);
  const y = top + height / 2 - NODE_HEIGHT / 2;
  out.push({
    id: node.id,
    label: node.label,
    x,
    y,
    parentEdgeFrom: parentId,
  });

  let childTop = top;
  for (const child of node.children) {
    const childHeight = subtreeHeight(child);
    layoutNode(child, depth + 1, childTop, node.id, out);
    childTop += childHeight + V_GAP;
  }
}

function cellStyle(isRoot: boolean): string {
  if (isRoot) {
    return [
      "rounded=1",
      "whiteSpace=wrap",
      "html=1",
      "fillColor=#E8F5E9",
      "strokeColor=#2E7D32",
      "fontStyle=1",
      "align=center",
      "verticalAlign=middle",
    ].join(";");
  }
  return [
    "rounded=1",
    "whiteSpace=wrap",
    "html=1",
    "fillColor=#F5F5F5",
    "strokeColor=#9E9E9E",
    "align=center",
    "verticalAlign=middle",
  ].join(";");
}

/**
 * Converts Elowen mind-map list content into a draw.io `.drawio` / mxfile XML string.
 */
export function mindmapToDrawioXml(
  textContents: TextContent[],
  listContents: ListContent[]
): string {
  const forest = buildForest(textContents, listContents);
  if (forest.length === 0) {
    forest.push({ id: "root", label: "Mind map", children: [] });
  }

  const placed: PlacedCell[] = [];
  let top = 40;
  for (const root of forest) {
    layoutNode(root, 0, top, undefined, placed);
    top += subtreeHeight(root) + V_GAP * 2;
  }

  const maxX = placed.reduce((m, c) => Math.max(m, c.x), 0);
  const maxY = placed.reduce((m, c) => Math.max(m, c.y), 0);
  const pageWidth = Math.max(827, maxX + NODE_WIDTH + 80);
  const pageHeight = Math.max(1169, maxY + NODE_HEIGHT + 80);

  const vertexXml = placed
    .map((cell) => {
      const isRoot = !cell.parentEdgeFrom;
      return `        <mxCell id="${escapeXml(cell.id)}" value="${escapeXml(
        cell.label
      )}" style="${cellStyle(isRoot)}" vertex="1" parent="1">
          <mxGeometry x="${Math.round(cell.x)}" y="${Math.round(
        cell.y
      )}" width="${NODE_WIDTH}" height="${NODE_HEIGHT}" as="geometry"/>
        </mxCell>`;
    })
    .join("\n");

  const edgeXml = placed
    .filter((cell) => cell.parentEdgeFrom)
    .map(
      (cell, index) => `        <mxCell id="e${index + 1}" edge="1" parent="1" source="${escapeXml(
        cell.parentEdgeFrom!
      )}" target="${escapeXml(cell.id)}">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>`
    )
    .join("\n");

  return `<mxfile host="app.diagrams.net" agent="Elowen" version="22.0.0">
  <diagram id="mindmap" name="Logic map">
    <mxGraphModel dx="1200" dy="800" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="${pageWidth}" pageHeight="${pageHeight}" math="0" shadow="0">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
${vertexXml}
${edgeXml}
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;
}

/** Opens the generated diagram in diagrams.net embed editor. */
export function openMindmapInDrawio(xml: string): Window | null {
  const editor = window.open(
    "https://embed.diagrams.net/?embed=1&proto=json&spin=1&ui=min&libraries=1&saveAndExit=1&noSaveBtn=1",
    "_blank"
  );
  if (!editor) {
    return null;
  }

  const onMessage = (event: MessageEvent) => {
    if (event.source !== editor) return;
    const data = event.data;
    const isReady =
      data === "ready" ||
      (typeof data === "string" &&
        (() => {
          try {
            const parsed = JSON.parse(data);
            return parsed?.event === "init";
          } catch {
            return false;
          }
        })());

    if (!isReady) return;

    editor.postMessage(
      JSON.stringify({
        action: "load",
        xml,
      }),
      "*"
    );
    window.removeEventListener("message", onMessage);
  };

  window.addEventListener("message", onMessage);
  return editor;
}

/** Triggers a browser download of a `.drawio` file. */
export function downloadMindmapDrawio(
  xml: string,
  filename = "elowen-mindmap.drawio"
): void {
  const blob = new Blob([xml], { type: "application/xml" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
