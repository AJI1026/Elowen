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

import { action, computed, makeObservable, observable } from "mobx";
import { Service } from "./service";

import { ColorMode } from "../shared/types";
import {
  DEFAULT_MODEL_CONFIG,
  ModelConfig,
  ModelProvider,
  ProviderSettings,
  ProviderSettingsMap,
  ResponseLanguage,
  UI_MODEL_PROVIDERS,
  defaultProviderSettings,
} from "../shared/model_config";
import { httpApi } from "../shared/http_api";
import { applyDocumentLanguage } from "../shared/i18n";

import {
  LocalStorageHelper,
  LocalStorageService,
} from "./local_storage.service";

interface ServiceProvider {
  localStorageService: LocalStorageService;
}

const TOS_CONFIRMED_LOCAL_STORAGE_KEY = "tosConfirmed";
const TUTORIAL_CONFIRMED_LOCAL_STORAGE_KEY = "tutorialConfirmed";

/** Legacy browser keys — migrated once into data/settings.json then cleared. */
const LEGACY_MODEL_PROVIDER_KEY = "userModelProvider";
const LEGACY_PROVIDER_SETTINGS_KEY = "userProviderSettings";
const LEGACY_RESPONSE_LANGUAGE_KEY = "userResponseLanguage";
const LEGACY_API_KEY_LOCAL_STORAGE_KEY = "userApiKey";
const LEGACY_MODEL_NAME_LOCAL_STORAGE_KEY = "userModelName";
const LEGACY_MODEL_BASE_URL_LOCAL_STORAGE_KEY = "userModelBaseUrl";

const SAVE_DEBOUNCE_MS = 400;

/** In-memory `.value` holder that notifies when the user changes settings. */
class MemoryValue<T> {
  constructor(
    defaultValue: T,
    private readonly onChange?: () => void
  ) {
    makeObservable(this);
    this.internalValue = defaultValue;
  }

  @observable private internalValue: T;

  /** Set without triggering disk persist (used while hydrating from API). */
  setSilent(value: T) {
    this.internalValue = value;
  }

  set value(value: T) {
    this.internalValue = value;
    this.onChange?.();
  }

  @computed
  get value(): T {
    return this.internalValue;
  }
}

/**
 * Settings service.
 * Model config is stored in data/settings.json via the local API (not browser).
 */
export class SettingsService extends Service {
  constructor(private readonly sp: ServiceProvider) {
    super();
    makeObservable(this);

    this.isTosConfirmed = this.sp.localStorageService.makeLocalStorageHelper(
      TOS_CONFIRMED_LOCAL_STORAGE_KEY,
      false
    );
    this.isTutorialConfirmed =
      this.sp.localStorageService.makeLocalStorageHelper(
        TUTORIAL_CONFIRMED_LOCAL_STORAGE_KEY,
        false
      );

    const persist = () => this.schedulePersist();
    this.modelProvider = new MemoryValue(ModelProvider.DEEPSEEK, persist);
    this.providerSettings = new MemoryValue<ProviderSettingsMap>({}, persist);
    this.responseLanguage = new MemoryValue(ResponseLanguage.ZH, persist);

    this.ensureUiProvider();
    this.syncActiveFieldsFromProvider();
  }

  @observable colorMode: ColorMode = ColorMode.DEFAULT;
  @observable isLoaded = false;

  /** Active fields bound by the Settings UI (synced with current provider). */
  @observable apiKey = "";
  @observable modelName = DEFAULT_MODEL_CONFIG.modelName;
  @observable modelBaseUrl = DEFAULT_MODEL_CONFIG.baseUrl;

  readonly isTosConfirmed: LocalStorageHelper<boolean>;
  readonly isTutorialConfirmed: LocalStorageHelper<boolean>;
  readonly modelProvider: MemoryValue<ModelProvider>;
  readonly providerSettings: MemoryValue<ProviderSettingsMap>;
  readonly responseLanguage: MemoryValue<ResponseLanguage>;

  private saveTimer: ReturnType<typeof setTimeout> | undefined;
  private persistSuspended = false;

  /** Load settings from data/settings.json (via API). Call once at app start. */
  override async initialize() {
    await this.loadFromServer();
    this.isLoaded = true;
  }

  /** Returns the full model config for the current settings. */
  getModelConfig(): ModelConfig {
    const provider = this.normalizeProvider(this.modelProvider.value);
    const saved = this.getProviderSettings(provider);
    return {
      provider,
      modelName: saved.modelName,
      baseUrl: saved.baseUrl,
      apiKey: saved.apiKey,
      responseLanguage: this.responseLanguage.value,
    };
  }

  /** Applies a model config to the stored settings. */
  setModelConfig(config: Partial<ModelConfig>) {
    if (config.responseLanguage !== undefined) {
      this.responseLanguage.value = config.responseLanguage;
    }

    if (config.provider !== undefined) {
      this.selectProvider(config.provider);
    }

    const provider = this.normalizeProvider(this.modelProvider.value);
    const next: ProviderSettings = {
      ...this.getProviderSettings(provider),
    };
    if (config.modelName !== undefined) next.modelName = config.modelName;
    if (config.baseUrl !== undefined) next.baseUrl = config.baseUrl;
    if (config.apiKey !== undefined) next.apiKey = config.apiKey;
    this.writeProviderSettings(provider, next);
    this.syncActiveFieldsFromProvider();
  }

  /** Switch provider; each provider keeps its own name / URL / key. */
  selectProvider(provider: ModelProvider) {
    const next = this.normalizeProvider(provider);
    this.persistActiveFieldsToProvider();
    this.modelProvider.value = next;
    this.ensureProviderDefaults(next);
    this.syncActiveFieldsFromProvider();
  }

  /** @deprecated Use selectProvider. */
  applyProviderDefaults(provider: ModelProvider) {
    this.selectProvider(provider);
  }

  /** Persist edits from the Settings form into the current provider slot. */
  updateActiveApiKey(apiKey: string) {
    this.apiKey = apiKey;
    this.persistActiveFieldsToProvider();
  }

  updateActiveModelName(modelName: string) {
    this.modelName = modelName;
    this.persistActiveFieldsToProvider();
  }

  updateActiveBaseUrl(baseUrl: string) {
    this.modelBaseUrl = baseUrl;
    this.persistActiveFieldsToProvider();
  }

  @action setColorMode(colorMode: ColorMode) {
    this.colorMode = colorMode;
  }

  private async loadFromServer() {
    this.persistSuspended = true;
    try {
      let remote = await httpApi.getSettings();
      const hasRemoteProviders =
        remote.providerSettings &&
        Object.keys(remote.providerSettings).length > 0;

      if (!hasRemoteProviders) {
        const migrated = this.readLegacyBrowserSettings();
        if (migrated) {
          remote = await httpApi.putSettings(migrated);
          this.clearLegacyBrowserSettings();
        }
      } else {
        // Drop stale browser copies once file-backed settings exist.
        this.clearLegacyBrowserSettings();
      }

      this.applyRemoteSettings(remote);
    } catch (e) {
      console.warn("Failed to load settings from server; using defaults", e);
      const migrated = this.readLegacyBrowserSettings();
      if (migrated) {
        this.applyRemoteSettings(migrated);
        try {
          await httpApi.putSettings(migrated);
          this.clearLegacyBrowserSettings();
        } catch {
          // keep in-memory values
        }
      }
    } finally {
      this.persistSuspended = false;
    }
  }

  private applyRemoteSettings(remote: {
    modelProvider?: string;
    providerSettings?: Record<string, unknown>;
    responseLanguage?: string;
  }) {
    if (remote.modelProvider) {
      this.modelProvider.setSilent(
        this.normalizeProvider(remote.modelProvider as ModelProvider)
      );
    }
    if (remote.providerSettings) {
      this.providerSettings.setSilent(
        remote.providerSettings as ProviderSettingsMap
      );
    }
    if (
      remote.responseLanguage === ResponseLanguage.EN ||
      remote.responseLanguage === ResponseLanguage.ZH
    ) {
      this.responseLanguage.setSilent(remote.responseLanguage);
    }
    this.ensureUiProvider(true);
    this.syncActiveFieldsFromProvider();
    applyDocumentLanguage(this.responseLanguage.value);
  }

  private schedulePersist() {
    if (this.persistSuspended) return;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      void this.persistToServer();
    }, SAVE_DEBOUNCE_MS);
  }

  private async persistToServer() {
    if (this.persistSuspended) return;
    try {
      await httpApi.putSettings({
        modelProvider: this.modelProvider.value,
        providerSettings: this.providerSettings.value,
        responseLanguage: this.responseLanguage.value,
      });
    } catch (e) {
      console.warn("Failed to save settings to data/settings.json", e);
    }
  }

  private normalizeProvider(provider: ModelProvider): ModelProvider {
    if (UI_MODEL_PROVIDERS.includes(provider)) return provider;
    return ModelProvider.DEEPSEEK;
  }

  private ensureUiProvider(silent = false) {
    const current = this.modelProvider.value;
    const normalized = this.normalizeProvider(current);
    if (current !== normalized) {
      if (silent) this.modelProvider.setSilent(normalized);
      else this.modelProvider.value = normalized;
    }
    this.ensureProviderDefaults(normalized, silent);
  }

  private ensureProviderDefaults(provider: ModelProvider, silent = false) {
    const map = { ...this.providerSettings.value };
    if (!map[provider]) {
      map[provider] = defaultProviderSettings(provider);
      if (silent) this.providerSettings.setSilent(map);
      else this.providerSettings.value = map;
    }
  }

  private getProviderSettings(provider: ModelProvider): ProviderSettings {
    return (
      this.providerSettings.value[provider] ??
      defaultProviderSettings(provider)
    );
  }

  private writeProviderSettings(
    provider: ModelProvider,
    settings: ProviderSettings
  ) {
    this.providerSettings.value = {
      ...this.providerSettings.value,
      [provider]: settings,
    };
  }

  private persistActiveFieldsToProvider() {
    const provider = this.normalizeProvider(this.modelProvider.value);
    this.writeProviderSettings(provider, {
      modelName: this.modelName,
      baseUrl: this.modelBaseUrl,
      apiKey: this.apiKey,
    });
  }

  private syncActiveFieldsFromProvider() {
    const provider = this.normalizeProvider(this.modelProvider.value);
    const saved = this.getProviderSettings(provider);
    this.modelName = saved.modelName;
    this.modelBaseUrl = saved.baseUrl;
    this.apiKey = saved.apiKey;
  }

  /** One-time read of old browser-stored model settings. */
  private readLegacyBrowserSettings():
    | {
        modelProvider: ModelProvider;
        providerSettings: ProviderSettingsMap;
        responseLanguage: ResponseLanguage;
      }
    | undefined {
    const ls = this.sp.localStorageService;
    let provider = ls.getData<ModelProvider | undefined>(
      LEGACY_MODEL_PROVIDER_KEY,
      undefined
    );
    let map = ls.getData<ProviderSettingsMap | undefined>(
      LEGACY_PROVIDER_SETTINGS_KEY,
      undefined
    );
    const lang = ls.getData<ResponseLanguage | undefined>(
      LEGACY_RESPONSE_LANGUAGE_KEY,
      undefined
    );

    if (!map || Object.keys(map).length === 0) {
      const legacyKey = this.readLegacyString(LEGACY_API_KEY_LOCAL_STORAGE_KEY);
      const legacyName = this.readLegacyString(
        LEGACY_MODEL_NAME_LOCAL_STORAGE_KEY
      );
      const legacyBase = this.readLegacyString(
        LEGACY_MODEL_BASE_URL_LOCAL_STORAGE_KEY
      );
      if (legacyKey || legacyName || legacyBase) {
        let p = this.normalizeProvider(provider ?? ModelProvider.DEEPSEEK);
        if (provider === ModelProvider.GEMINI) {
          p = ModelProvider.DEEPSEEK;
        }
        const defaults = defaultProviderSettings(p);
        map = {
          [p]: {
            modelName: legacyName || defaults.modelName,
            baseUrl: legacyBase || defaults.baseUrl,
            apiKey: legacyKey || "",
          },
        };
        provider = p;
      }
    }

    if (!map || Object.keys(map).length === 0) return undefined;

    return {
      modelProvider: this.normalizeProvider(provider ?? ModelProvider.DEEPSEEK),
      providerSettings: map,
      responseLanguage:
        lang === ResponseLanguage.EN || lang === ResponseLanguage.ZH
          ? lang
          : ResponseLanguage.ZH,
    };
  }

  private clearLegacyBrowserSettings() {
    const ls = this.sp.localStorageService;
    for (const key of [
      LEGACY_MODEL_PROVIDER_KEY,
      LEGACY_PROVIDER_SETTINGS_KEY,
      LEGACY_RESPONSE_LANGUAGE_KEY,
      LEGACY_API_KEY_LOCAL_STORAGE_KEY,
      LEGACY_MODEL_NAME_LOCAL_STORAGE_KEY,
      LEGACY_MODEL_BASE_URL_LOCAL_STORAGE_KEY,
    ]) {
      ls.deleteData(key);
    }
  }

  private readLegacyString(key: string): string {
    try {
      const raw = localStorage.getItem(key);
      if (raw == null) return "";
      return JSON.parse(raw) as string;
    } catch {
      return "";
    }
  }
}
