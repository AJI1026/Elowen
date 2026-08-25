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
  DEFAULT_BASE_URLS,
  DEFAULT_MODEL_CONFIG,
  DEFAULT_MODEL_NAMES,
  ModelConfig,
  ModelProvider,
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
const API_KEY_LOCAL_STORAGE_KEY = "userApiKey";
const MODEL_PROVIDER_LOCAL_STORAGE_KEY = "userModelProvider";
const MODEL_NAME_LOCAL_STORAGE_KEY = "userModelName";
const MODEL_BASE_URL_LOCAL_STORAGE_KEY = "userModelBaseUrl";

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
    this.apiKey = this.sp.localStorageService.makeLocalStorageHelper(
      API_KEY_LOCAL_STORAGE_KEY,
      ""
    );
    this.modelProvider = this.sp.localStorageService.makeLocalStorageHelper(
      MODEL_PROVIDER_LOCAL_STORAGE_KEY,
      ModelProvider.GEMINI
    );
    this.modelName = this.sp.localStorageService.makeLocalStorageHelper(
      MODEL_NAME_LOCAL_STORAGE_KEY,
      DEFAULT_MODEL_CONFIG.modelName
    );
    this.modelBaseUrl = this.sp.localStorageService.makeLocalStorageHelper(
      MODEL_BASE_URL_LOCAL_STORAGE_KEY,
      ""
    );
  }

  @observable colorMode: ColorMode = ColorMode.DEFAULT;

  readonly isTosConfirmed: LocalStorageHelper<boolean>;
  readonly isTutorialConfirmed: LocalStorageHelper<boolean>;
  readonly apiKey: LocalStorageHelper<string>;
  readonly modelProvider: LocalStorageHelper<ModelProvider>;
  readonly modelName: LocalStorageHelper<string>;
  readonly modelBaseUrl: LocalStorageHelper<string>;

  /** Returns the full model config for the current settings. */
  getModelConfig(): ModelConfig {
    return {
      provider: this.modelProvider.value,
      modelName: this.modelName.value,
      baseUrl: this.modelBaseUrl.value,
      apiKey: this.apiKey.value,
    };
  }

  /** Applies a model config to the stored settings. */
  setModelConfig(config: Partial<ModelConfig>) {
    if (config.provider !== undefined) {
      this.modelProvider.value = config.provider;
    }
    if (config.modelName !== undefined) {
      this.modelName.value = config.modelName;
    }
    if (config.baseUrl !== undefined) {
      this.modelBaseUrl.value = config.baseUrl;
    }
    if (config.apiKey !== undefined) {
      this.apiKey.value = config.apiKey;
    }
  }

  /** Pre-fill model name/base URL when switching provider (if user hasn't set). */
  applyProviderDefaults(provider: ModelProvider) {
    this.modelProvider.value = provider;
    const defaultName = DEFAULT_MODEL_NAMES[provider];
    const defaultBaseUrl = DEFAULT_BASE_URLS[provider];
    if (defaultName) {
      this.modelName.value = defaultName;
    }
    if (defaultBaseUrl !== undefined) {
      this.modelBaseUrl.value = defaultBaseUrl;
    }
  }

  @action setColorMode(colorMode: ColorMode) {
    this.colorMode = colorMode;
  }
}
