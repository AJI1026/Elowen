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

import { v4 as uuidv4 } from "uuid";

/** Shared utils. */

/** ElowenDocument version (in case ElowenDocument object is updated). */
export const ELOWEN_DOCUMENT_VERSION = 0;

/** ISO date string or epoch millis — formerly Firebase Timestamp. */
export type UnifiedTimestamp =
  | string
  | number
  | { seconds: number; nanoseconds: number };

/** Temporary ElowenDocument object. */
export interface ElowenDocument {
  id: string;
  versionElowen: number; // use ELOWEN_DOCUMENT_VERSION
  versionArxiv: string; // version from arXiv
  content: string;
  dateCreated: UnifiedTimestamp;
  dateEdited: UnifiedTimestamp;
}

/** Create new ElowenDocument. */
export function createElowenDocument(
  config: Partial<ElowenDocument> = {}
): ElowenDocument {
  const now = Date.now();
  return {
    id: config.id ?? generateId(),
    versionElowen: config.versionElowen ?? ELOWEN_DOCUMENT_VERSION,
    versionArxiv: config.versionArxiv ?? "",
    content: config.content ?? "",
    dateCreated: config.dateCreated ?? now,
    dateEdited: config.dateEdited ?? now,
  };
}

export function generateId(isSequential: boolean = false): string {
  // If isSequential is selected, the ID will be lower in the alphanumeric
  // scale as time progresses. This helps to ensure that IDs created at a later
  // time will be sorted later.
  if (isSequential) {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 8);
    return `${timestamp}-${randomPart}`;
  }

  return uuidv4();
}

export function debounce<T extends Function>(fn: T, ms = 300): T {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  return function (this: any, ...args: any[]) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn.apply(this, args);
    }, ms);
  } as unknown as T;
}

export function areArraysEqual<T>(arrayA: T[], arrayB: T[]): boolean {
  if (arrayA.length !== arrayB.length) {
    return false;
  }
  for (let i = 0; i < arrayA.length; i++) {
    if (arrayA[i] !== arrayB[i]) {
      return false;
    }
  }
  return true;
}
