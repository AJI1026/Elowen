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

import { action, makeObservable, observable } from "mobx";
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

import {
  LocalStorageHelper,
  LocalStorageService,
} from "./local_storage.service";

interface ServiceProvider {
  localStorageService: LocalStorageService;
}

const TOS_CONFIRMED_LOCAL_STORAGE_KEY = "tosConfirmed";
const TUTORIAL_CONFIRMED_LOCAL_STORAGE_KEY = "tutorialConfirmed";
const MODEL_PROVIDER_LOCAL_STORAGE_KEY = "userModelProvider";
const PROVIDER_SETTINGS_LOCAL_STORAGE_KEY = "userProviderSettings";
const RESPONSE_LANGUAGE_LOCAL_STORAGE_KEY = "userResponseLanguage";

// Legacy single-slot keys (migrated once into per-provider map).
const LEGACY_API_KEY_LOCAL_STORAGE_KEY = "userApiKey";
const LEGACY_MODEL_NAME_LOCAL_STORAGE_KEY = "userModelName";
const LEGACY_MODEL_BASE_URL_LOCAL_STORAGE_KEY = "userModelBaseUrl";

/**
 * Settings service.
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
    this.modelProvider = this.sp.localStorageService.makeLocalStorageHelper(
      MODEL_PROVIDER_LOCAL_STORAGE_KEY,
      ModelProvider.DEEPSEEK
    );
    this.providerSettings =
      this.sp.localStorageService.makeLocalStorageHelper<ProviderSettingsMap>(
        PROVIDER_SETTINGS_LOCAL_STORAGE_KEY,
        {}
      );
    this.responseLanguage = this.sp.localStorageService.makeLocalStorageHelper(
      RESPONSE_LANGUAGE_LOCAL_STORAGE_KEY,
      ResponseLanguage.ZH
    );

    this.migrateLegacySettings();
    this.ensureUiProvider();
    this.syncActiveFieldsFromProvider();
  }

  @observable colorMode: ColorMode = ColorMode.DEFAULT;

  /** Active fields bound by the Settings UI (synced with current provider). */
  @observable apiKey = "";
  @observable modelName = DEFAULT_MODEL_CONFIG.modelName;
  @observable modelBaseUrl = DEFAULT_MODEL_CONFIG.baseUrl;

  readonly isTosConfirmed: LocalStorageHelper<boolean>;
  readonly isTutorialConfirmed: LocalStorageHelper<boolean>;
  readonly modelProvider: LocalStorageHelper<ModelProvider>;
  readonly providerSettings: LocalStorageHelper<ProviderSettingsMap>;
  readonly responseLanguage: LocalStorageHelper<ResponseLanguage>;

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

  private normalizeProvider(provider: ModelProvider): ModelProvider {
    if (UI_MODEL_PROVIDERS.includes(provider)) return provider;
    return ModelProvider.DEEPSEEK;
  }

  private ensureUiProvider() {
    const current = this.modelProvider.value;
    const normalized = this.normalizeProvider(current);
    if (current !== normalized) {
      this.modelProvider.value = normalized;
    }
    this.ensureProviderDefaults(normalized);
  }

  private ensureProviderDefaults(provider: ModelProvider) {
    const map = { ...this.providerSettings.value };
    if (!map[provider]) {
      map[provider] = defaultProviderSettings(provider);
      this.providerSettings.value = map;
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

  /** One-time migrate from shared key/name/url into per-provider map. */
  private migrateLegacySettings() {
    if (Object.keys(this.providerSettings.value).length > 0) return;

    const legacyKey = this.readLegacyString(LEGACY_API_KEY_LOCAL_STORAGE_KEY);
    const legacyName = this.readLegacyString(LEGACY_MODEL_NAME_LOCAL_STORAGE_KEY);
    const legacyBase = this.readLegacyString(
      LEGACY_MODEL_BASE_URL_LOCAL_STORAGE_KEY
    );
    if (!legacyKey && !legacyName && !legacyBase) return;

    let provider = this.normalizeProvider(this.modelProvider.value);
    // Old default was Gemini; treat leftover gemini as DeepSeek slot.
    if (this.modelProvider.value === ModelProvider.GEMINI) {
      provider = ModelProvider.DEEPSEEK;
      this.modelProvider.value = provider;
    }

    const defaults = defaultProviderSettings(provider);
    this.writeProviderSettings(provider, {
      modelName: legacyName || defaults.modelName,
      baseUrl: legacyBase || defaults.baseUrl,
      apiKey: legacyKey || "",
    });
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
