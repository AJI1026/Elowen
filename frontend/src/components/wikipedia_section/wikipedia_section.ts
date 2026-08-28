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

import { CSSResultGroup, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { LightMobxLitElement } from "../light_mobx_lit_element/light_mobx_lit_element";
import { core } from "../../core/core";
import { SettingsService } from "../../services/settings.service";
import { ResponseLanguage } from "../../shared/model_config";
import { t } from "../../shared/i18n";
import {
  fetchWikipediaSummary,
  getWikipediaSearchUrl,
  isLikelyWikipediaLookupTerm,
  WikipediaSummary,
} from "../../shared/wikipedia_utils";
import { styles } from "./wikipedia_section.scss";

/**
 * Loads and renders a Wikipedia enrichment block for a lookup term.
 */
@customElement("elowen-wikipedia-section")
export class ElowenWikipediaSection extends LightMobxLitElement {
  static override styles: CSSResultGroup = [styles];

  private readonly settingsService = core.getService(SettingsService);

  @property({ type: String }) term = "";
  /** When false, render nothing (e.g. Ask answers that are not DEFINE). */
  @property({ type: Boolean }) enabled = true;

  @state() private wikiSummary: WikipediaSummary | null = null;
  @state() private wikiLoading = false;
  @state() private loadAttempted = false;

  private lastFetchKey = "";

  private preferredWikiLang(): "zh" | "en" {
    return this.settingsService.responseLanguage.value === ResponseLanguage.EN
      ? "en"
      : "zh";
  }

  private uiLang() {
    return this.settingsService.responseLanguage.value;
  }

  private fetchKey(): string {
    return `${this.enabled}\0${this.term.trim()}\0${this.preferredWikiLang()}`;
  }

  protected override willUpdate(): void {
    // term / enabled / response-language changes all invalidate the fetch key.
    void this.reloadIfNeeded();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    void this.reloadIfNeeded();
  }

  private async reloadIfNeeded() {
    const key = this.fetchKey();
    if (key === this.lastFetchKey) return;
    this.lastFetchKey = key;
    await this.reload();
  }

  private async reload() {
    const term = this.term.trim();
    if (!this.enabled || !term || !isLikelyWikipediaLookupTerm(term)) {
      this.wikiSummary = null;
      this.wikiLoading = false;
      this.loadAttempted = true;
      return;
    }

    this.wikiLoading = true;
    this.loadAttempted = false;
    this.wikiSummary = null;
    const requestKey = this.lastFetchKey;
    try {
      const summary = await fetchWikipediaSummary(
        term,
        this.preferredWikiLang()
      );
      if (requestKey !== this.lastFetchKey) return;
      this.wikiSummary = summary;
    } finally {
      if (requestKey === this.lastFetchKey) {
        this.wikiLoading = false;
        this.loadAttempted = true;
      }
    }
  }

  override render() {
    // Ensure MobX tracks language so EN/中 toggle re-runs willUpdate.
    void this.preferredWikiLang();

    const term = this.term.trim();
    if (!this.enabled || !term || !isLikelyWikipediaLookupTerm(term)) {
      return nothing;
    }

    const lang = this.uiLang();
    const wikiLang = this.preferredWikiLang();
    const searchUrl = getWikipediaSearchUrl(term, wikiLang);

    if (this.wikiLoading && !this.wikiSummary) {
      return html`<div class="wiki-section">
        <div class="wiki-label">${t("wiki.label", lang)}</div>
        <div class="wiki-loading">${t("wiki.loading", lang)}</div>
      </div>`;
    }

    if (this.wikiSummary) {
      return html`<div class="wiki-section">
        <div class="wiki-label">
          ${t("wiki.label", lang)} · ${this.wikiSummary.title}
        </div>
        <div class="wiki-extract">${this.wikiSummary.extract}</div>
        <a
          class="wiki-link"
          href=${this.wikiSummary.pageUrl}
          target="_blank"
          rel="noopener noreferrer"
          >${t("wiki.open", lang)}</a
        >
      </div>`;
    }

    if (!this.loadAttempted) {
      return nothing;
    }

    return html`<div class="wiki-section">
      <div class="wiki-label">${t("wiki.label", lang)}</div>
      <a
        class="wiki-link"
        href=${searchUrl}
        target="_blank"
        rel="noopener noreferrer"
        >${t("wiki.search", lang, { name: term })}</a
      >
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "elowen-wikipedia-section": ElowenWikipediaSection;
  }
}
