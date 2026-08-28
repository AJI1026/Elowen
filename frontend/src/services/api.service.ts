/**
 * Local HTTP API service (replaces FirebaseService).
 */

import { makeObservable } from "mobx";

import { imageUrl } from "../shared/http_api";
import { Service } from "./service";

/** Manages connection to the local Elowen backend. */
export class ApiService extends Service {
  constructor() {
    super();
    makeObservable(this);
  }

  /** Returns a browser URL for a storage path served by the API. */
  async getDownloadUrl(path: string): Promise<string> {
    return imageUrl(path);
  }
}
