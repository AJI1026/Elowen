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

import { ResponseLanguage } from "./model_config";
import { SIDEBAR_TABS } from "./constants";

/** UI chrome strings. LLM response language reuses the same setting. */
const EN = {
  "sidebar.ask": "Ask",
  "sidebar.notes": "Notes",
  "sidebar.outline": "Outline",
  "sidebar.concepts": "Concepts",

  "menu.explainText": "Explain text",
  "menu.explainImage": "Explain image",
  "menu.translate": "Translate",
  "menu.askElowen": "Ask Elowen...",
  "menu.mindmap": "Logic map",
  "menu.highlight": "Highlight",
  "menu.note": "Note",
  "menu.addNotePlaceholder": "Add a note...",
  "menu.askPlaceholder": "Ask Elowen",

  "ask.placeholder": "Ask Elowen...",
  "ask.sendTitle": "Ask Elowen",
  "ask.paperMindmapTitle": "Paper logic map",
  "ask.paperMindmapQuery": "Paper logic map",
  "ask.paragraphMindmapQuery": "Paragraph logic map",
  "ask.errorResponse": "Error: Could not get response from Elowen.",

  "lang.toggleTitle": "UI & response language",
  "lang.enTitle": "English UI & answers",
  "lang.zhTitle": "Chinese UI & answers",

  "answer.expand": "Show all",
  "answer.collapse": "Collapse",
  "answer.delete": "Delete",
  "answer.explainImage": "Explain image",
  "answer.explainText": "Explain text",
  "answer.explainHighlight": 'Explain "{highlight}"',
  "answer.translateText": "Translate",
  "answer.translateHighlight": 'Translate "{highlight}"',
  "answer.imageLabel": "Image",
  "answer.imageTitle": "The image this answer is about",
  "answer.references": "{count} references",
  "answer.paperMindmap": "Paper logic map",
  "answer.paragraphMindmap": "Paragraph logic map",
  "mindmap.openDrawio": "Edit in draw.io",
  "mindmap.downloadDrawio": "Download .drawio",
  "mindmap.drawioBlocked":
    "Could not open draw.io. Allow pop-ups, or download the .drawio file.",

  "notes.empty":
    "Select text and use Highlight or Note to annotate this paper.",
  "notes.goTo": "Go to",
  "notes.delete": "Delete",
  "notes.save": "Save",
  "notes.addPlaceholder": "Add a note...",

  "header.moreOptions": "More options",
  "header.home": "Elowen home",
  "header.history": "View Elowen history",
  "header.feedback": "Send feedback",
  "header.tutorial": "Tutorial",
  "header.settings": "Settings",
  "header.importPaper": "Import paper",
  "header.settingsTitle": "Settings",

  "home.myCollection": "My collection",
  "home.importTitle": "Import paper",
  "home.importPlaceholder": "Paste your arXiv paper link here",
  "home.loadingNew": "Loading new paper...",
  "home.loadingNamed": "Loading {title} ({id})",
  "home.empty": "No papers available",
  "home.statusLoading": "Loading",
  "home.statusSummarizing": "Summarizing",
  "home.snackAlreadyLoaded": "Paper already loaded.",
  "home.snackNotFound": "Error: Document not found.",
  "home.snackLoaded": "Document loaded.",
  "home.pageNotFound": "Page not found",

  "settings.model": "Model",
  "settings.modelHelp":
    "Optional: Configure the LLM used for Ask Elowen and other in-paper interactions. Importing a paper still uses the server model—not the API key you enter here.",
  "settings.providerDeepSeek": "DeepSeek",
  "settings.providerCustom": "Custom",
  "settings.modelName": "Model name",
  "settings.baseUrl": "Base URL",
  "settings.apiKey": "API key",
  "settings.apiKeyPlaceholder": "Paste API key here",
  "settings.about": "About Elowen",
  "settings.aboutIntro":
    "Elowen is an AI reading companion for research papers. Import an arXiv paper to get paragraph guides, ask questions, explain selections, build logic maps, and keep your own highlights and notes—all in one place.",
  "settings.aboutFeatures":
    "Use the sidebar to ask questions, browse concepts, and review annotations. Switch the UI and answer language anytime with EN / 中.",
  "settings.historyTitle": "Reading History ({count})",
  "settings.historyEmpty": "No papers yet",
  "settings.clearHistory": "Clear entire reading history",
  "settings.clearHistoryConfirm":
    'Are you sure you want to clear history? This will remove all items from "My Collection."',
  "settings.removePaperConfirm":
    'Are you sure you want to remove this paper from your reading history? This will also remove it from "My Collection."',

  "content.collapseSummaries": "Collapse into summaries",
  "content.mixedState": "Mixed state",
  "content.expandPaper": "Expand full paper",
  "content.seeMore": "See more",
  "content.showParagraphGuide": "Show paragraph guide",
  "content.hideParagraphGuide": "Hide paragraph guide",
  "content.expandKeyPoints": "Expand key points",
  "content.collapseKeyPoints": "Collapse key points",

  "wiki.label": "Wikipedia",
  "wiki.loading": "Loading encyclopedia summary...",
  "wiki.open": "Open full article",
  "wiki.search": 'Search “{name}” on Wikipedia',
  "concept.loadFailed": "Could not load definition.",
  "translate.loadFailed": "Could not load translation.",

  "tutorial.title": "Tip: Get started with Elowen",
  "tutorial.intro":
    "Click a word to translate it, or select a passage for more actions:",
  "tutorial.captionSelect": "Select text → Explain / Ask / Logic map",
  "tutorial.captionImage": "Click a figure → Explain image",
  "tutorial.tipExplain": "Explain: plain-language definition + Wikipedia",
  "tutorial.tipTranslate": "Click a word: translation popup in the UI language",
  "tutorial.tipAsk": "Ask: question about the selection or whole paper",
  "tutorial.tipMindmap": "Logic map: nested outline you can open in draw.io",
  "tutorial.tipNotes": "Highlight / Note: save annotations in the Notes tab",
  "tutorial.tipGuide":
    "Right-side cards: paragraph guides; click concepts for definitions",
  "tutorial.gotIt": "Got it!",
  "tutorial.dontShowAgain": "Don't show again",

  "common.cancel": "Cancel",
  "common.confirm": "Confirm",
  "common.send": "Send",
  "nav.backHome": "Back to Elowen home",
  "arxiv.open": "Open in arXiv",
  "arxiv.openPaper": "Open paper in arXiv",

  "loading.importing": "Importing document...",
  "loading.importHint":
    "This may take a few minutes. Feel free to browse other papers and come back to this link.",

  "reader.loadingDocument": "Loading document",
  "reader.loadingSummaries": "Loading summaries...",
  "reader.errorTitle": "Something went wrong...",
  "reader.importFailed": 'Could not import: "{title}"',
  "reader.snackLoadError": "Error loading document: {id}",
  "reader.snackNotFound": "Document {id} not found.",
  "reader.snackLoadErrorDetail": "Error loading document: {message}",
  "reader.snackPersonalSummaryError":
    "Error: Could not generate personal summary.",
  "ask.errorApiKey": "Error: Your API key may be incorrect",
  "ask.errorQuota":
    "Model quota exceeded. Add your own API key in Home > Settings",

  "home.snackInvalidArxiv": "Error: Invalid arXiv URL or ID",
  "home.snackError": "Error: {message}",
  "home.snackImportFailed": "Could not import this paper. Please try again later.",
  "home.snackImportMissingApiKey":
    "Import failed: add your API key in Settings (Home → Settings), then try again.",
  "home.snackImportQuota":
    "Import failed: model quota exceeded. Check your API key or try again later.",
  "home.snackImportTimeout": "Import timed out. Please try again.",
  "home.snackImportInvalidResponse":
    "Import failed: the model returned an invalid response. Please try again.",

  "doc.abstract": "Abstract",
  "doc.references": "References",
  "doc.openReference": "Open reference",
  "doc.footnotes": "Footnotes",
  "doc.published": "Published: {date}",

  "feedback.title": "User Feedback",
  "feedback.bodyBefore":
    "If you're experiencing an issue and/or have suggestions, we'd love to hear from you! You're also welcome to",
  "feedback.githubLink": "submit feature requests on Github",
  "feedback.bodyAfter": ".",
  "feedback.placeholder": "Add feedback here",
  "feedback.send": "Send",
  "feedback.snackSuccess": "Feedback sent. Thank you!",
  "feedback.snackError": "Error: Could not send feedback.",

  "history.dialogTitle": "Reading History",
  "history.dialogExplanation":
    "The following papers are included as context for the model when generating personalized paper-level summaries:",

  "settings.removePaperTitle": "Remove paper",
  "settings.clearHistoryTitle": "Clear history",

  "tos.welcomeTitle": "Welcome to Elowen",
  "tos.acknowledge": "Acknowledge",
  "tos.p1":
    "Elowen is a research experiment that uses DeepSeek or a custom API to annotate and answer questions about arXiv papers.",
  "tos.p2":
    'All queries to the model API (DeepSeek or your custom endpoint), including freeform text sent through Elowen\'s "smart search" feature, will be logged anonymously, i.e., only the exact text you send—not other information such as location, browser, or device—will be stored. Please do not enter any sensitive or personal information into Elowen.',
  "tos.p3":
    'Your search history (including papers you click on and queries you make in "smart search") is kept in local app data on your device and can be cleared at any time on the Settings page.',
  "tos.p5Before": "Finally, the Elowen code is",
  "tos.p5Link": "available on GitHub",
  "tos.p5After": ".",

  "tooltip.noContent": "No content to display.",
  "image.clickToAsk": "Click to ask question",
  "image.loadError": "Error loading image",
  "answer.clickToView": "Click to view",
} as const;

type MessageKey = keyof typeof EN;

const ZH: Record<MessageKey, string> = {
  "sidebar.ask": "提问",
  "sidebar.notes": "笔记",
  "sidebar.outline": "大纲",
  "sidebar.concepts": "概念",

  "menu.explainText": "解释文本",
  "menu.explainImage": "解释图片",
  "menu.translate": "翻译",
  "menu.askElowen": "问 Elowen...",
  "menu.mindmap": "逻辑导图",
  "menu.highlight": "高亮",
  "menu.note": "笔记",
  "menu.addNotePlaceholder": "添加笔记...",
  "menu.askPlaceholder": "问 Elowen",

  "ask.placeholder": "问 Elowen...",
  "ask.sendTitle": "发送提问",
  "ask.paperMindmapTitle": "论文逻辑导图",
  "ask.paperMindmapQuery": "论文逻辑导图",
  "ask.paragraphMindmapQuery": "段落逻辑导图",
  "ask.errorResponse": "出错了：无法从 Elowen 获取回答。",

  "lang.toggleTitle": "界面与回答语言",
  "lang.enTitle": "英文界面与回答",
  "lang.zhTitle": "中文界面与回答",

  "answer.expand": "展开全部",
  "answer.collapse": "收起",
  "answer.delete": "删除",
  "answer.explainImage": "解释图片",
  "answer.explainText": "解释文本",
  "answer.explainHighlight": "解释「{highlight}」",
  "answer.translateText": "翻译",
  "answer.translateHighlight": "翻译「{highlight}」",
  "answer.imageLabel": "图片",
  "answer.imageTitle": "该回答对应的图片",
  "answer.references": "{count} 处引用",
  "answer.paperMindmap": "论文逻辑导图",
  "answer.paragraphMindmap": "段落逻辑导图",
  "mindmap.openDrawio": "在 draw.io 中编辑",
  "mindmap.downloadDrawio": "下载 .drawio",
  "mindmap.drawioBlocked":
    "无法打开 draw.io，请允许弹窗，或先下载 .drawio 文件。",

  "notes.empty": "选中文本后，可用「高亮」或「笔记」进行批注。",
  "notes.goTo": "跳转",
  "notes.delete": "删除",
  "notes.save": "保存",
  "notes.addPlaceholder": "添加笔记...",

  "header.moreOptions": "更多选项",
  "header.home": "返回 Elowen 首页",
  "header.history": "查看阅读历史",
  "header.feedback": "发送反馈",
  "header.tutorial": "使用教程",
  "header.settings": "设置",
  "header.importPaper": "导入论文",
  "header.settingsTitle": "设置",

  "home.myCollection": "我的收藏",
  "home.importTitle": "导入论文",
  "home.importPlaceholder": "粘贴 arXiv 论文链接",
  "home.loadingNew": "正在加载新论文…",
  "home.loadingNamed": "正在加载 {title}（{id}）",
  "home.empty": "暂无论文",
  "home.statusLoading": "加载中",
  "home.statusSummarizing": "生成导读中",
  "home.snackAlreadyLoaded": "论文已加载。",
  "home.snackNotFound": "错误：未找到文档。",
  "home.snackLoaded": "文档已加载。",
  "home.pageNotFound": "页面不存在",

  "settings.model": "模型",
  "settings.modelHelp":
    "可选：配置论文内「问 Elowen」等交互使用的大模型。导入论文会用服务端配置的模型，不会使用你在此填写的 API Key。",
  "settings.providerDeepSeek": "DeepSeek",
  "settings.providerCustom": "自配模型",
  "settings.modelName": "模型名称",
  "settings.baseUrl": "Base URL",
  "settings.apiKey": "API Key",
  "settings.apiKeyPlaceholder": "在此粘贴 API Key",
  "settings.about": "关于 Elowen",
  "settings.aboutIntro":
    "Elowen 是面向科研论文的 AI 阅读助手。导入 arXiv 论文后，可获得段落导读、划词解释、提问回答、逻辑导图，以及高亮与笔记，帮助你更快理解论文。",
  "settings.aboutFeatures":
    "侧栏可提问、浏览概念、查看批注；随时用 EN / 中 切换界面与回答语言。",
  "settings.historyTitle": "阅读历史（{count}）",
  "settings.historyEmpty": "暂无论文",
  "settings.clearHistory": "清空全部阅读历史",
  "settings.clearHistoryConfirm":
    "确定清空阅读历史吗？这也会从「我的收藏」中移除全部论文。",
  "settings.removePaperConfirm":
    "确定从阅读历史中移除这篇论文吗？这也会从「我的收藏」中移除。",

  "content.collapseSummaries": "收起为导读",
  "content.mixedState": "部分展开",
  "content.expandPaper": "展开全文",
  "content.seeMore": "查看更多",
  "content.showParagraphGuide": "显示段落导读",
  "content.hideParagraphGuide": "隐藏段落导读",
  "content.expandKeyPoints": "展开要点",
  "content.collapseKeyPoints": "收起要点",

  "wiki.label": "维基百科",
  "wiki.loading": "正在加载百科摘要…",
  "wiki.open": "打开完整条目",
  "wiki.search": "在维基百科搜索「{name}」",
  "concept.loadFailed": "无法加载定义。",
  "translate.loadFailed": "无法加载翻译。",

  "tutorial.title": "提示：开始使用 Elowen",
  "tutorial.intro": "点击单词即可翻译；划选一段文字会出现操作菜单：",
  "tutorial.captionSelect": "划词 → 解释 / 提问 / 逻辑导图",
  "tutorial.captionImage": "点图 → 解释图片",
  "tutorial.tipExplain": "解释：通俗释义，并附维基百科摘要",
  "tutorial.tipTranslate": "点击单词：在选区旁弹出译文，语言与界面一致",
  "tutorial.tipAsk": "提问：针对选中内容或全文提问",
  "tutorial.tipMindmap": "逻辑导图：层级大纲，可在 draw.io 中编辑",
  "tutorial.tipNotes": "高亮 / 笔记：保存在「笔记」页",
  "tutorial.tipGuide": "右侧卡片是段落导读；点击概念可看释义",
  "tutorial.gotIt": "知道了",
  "tutorial.dontShowAgain": "不再显示",

  "common.cancel": "取消",
  "common.confirm": "确定",
  "common.send": "发送",
  "nav.backHome": "返回 Elowen 首页",
  "arxiv.open": "在 arXiv 打开",
  "arxiv.openPaper": "在 arXiv 打开论文",

  "loading.importing": "正在导入文档…",
  "loading.importHint":
    "可能需要几分钟。你可以先浏览其他论文，稍后再回来打开此链接。",

  "reader.loadingDocument": "正在加载文档",
  "reader.loadingSummaries": "正在加载导读…",
  "reader.errorTitle": "出了点问题…",
  "reader.importFailed": "无法导入：「{title}」",
  "reader.snackLoadError": "加载文档失败：{id}",
  "reader.snackNotFound": "未找到文档 {id}。",
  "reader.snackLoadErrorDetail": "加载文档失败：{message}",
  "reader.snackPersonalSummaryError": "出错了：无法生成个性化摘要。",
  "ask.errorApiKey": "出错了：API Key 可能不正确",
  "ask.errorQuota": "模型配额已用尽。请在首页 > 设置中添加你自己的 API Key",

  "home.snackInvalidArxiv": "错误：无效的 arXiv 链接或 ID",
  "home.snackError": "错误：{message}",
  "home.snackImportFailed": "导入失败，请稍后重试。",
  "home.snackImportMissingApiKey":
    "导入失败：请先在「设置」中填写 API Key，然后再试。",
  "home.snackImportQuota":
    "导入失败：模型配额已用尽，请检查 API Key 或稍后再试。",
  "home.snackImportTimeout": "导入超时，请重试。",
  "home.snackImportInvalidResponse":
    "导入失败：模型返回异常，请重试。",

  "doc.abstract": "摘要",
  "doc.references": "参考文献",
  "doc.openReference": "打开外部文献",
  "doc.footnotes": "脚注",
  "doc.published": "发表于：{date}",

  "feedback.title": "用户反馈",
  "feedback.bodyBefore":
    "如果你遇到问题或有建议，欢迎告诉我们！你也可以",
  "feedback.githubLink": "在 GitHub 提交功能请求",
  "feedback.bodyAfter": "。",
  "feedback.placeholder": "在此填写反馈",
  "feedback.send": "发送",
  "feedback.snackSuccess": "反馈已发送，谢谢！",
  "feedback.snackError": "出错了：无法发送反馈。",

  "history.dialogTitle": "阅读历史",
  "history.dialogExplanation":
    "生成个性化论文摘要时，会将以下论文作为上下文提供给模型：",

  "settings.removePaperTitle": "移除论文",
  "settings.clearHistoryTitle": "清空历史",

  "tos.welcomeTitle": "欢迎使用 Elowen",
  "tos.acknowledge": "我已知晓",
  "tos.p1":
    "Elowen 是一个研究型实验产品，使用 DeepSeek 或自定义 API 为 arXiv 论文添加标注并回答问题。",
  "tos.p2":
    "所有发往模型 API（DeepSeek 或你配置的自定义接口）的请求（包括通过 Elowen「智能搜索」发送的自由文本）都会被匿名记录，即仅保存你发送的原文，不会保存位置、浏览器或设备等信息。请勿在 Elowen 中输入敏感或个人信息。",
  "tos.p3":
    "你的搜索历史（包括点击的论文与「智能搜索」查询）保存在本机应用数据中，可随时在设置页清除。",
  "tos.p5Before": "最后，Elowen 的代码已",
  "tos.p5Link": "在 GitHub 开源",
  "tos.p5After": "。",

  "tooltip.noContent": "暂无内容可显示。",
  "image.clickToAsk": "点击提问",
  "image.loadError": "图片加载失败",
  "answer.clickToView": "点击查看",
};

const SIDEBAR_TAB_KEYS: Record<string, MessageKey> = {
  [SIDEBAR_TABS.ANSWERS]: "sidebar.ask",
  [SIDEBAR_TABS.ANNOTATIONS]: "sidebar.notes",
  [SIDEBAR_TABS.TOC]: "sidebar.outline",
  [SIDEBAR_TABS.CONCEPTS]: "sidebar.concepts",
};

export type I18nKey = MessageKey;

export function t(
  key: MessageKey,
  lang: ResponseLanguage,
  vars?: Record<string, string | number>
): string {
  const table = lang === ResponseLanguage.EN ? EN : ZH;
  let text = table[key] ?? EN[key] ?? key;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
}

/** Map raw import / loading errors to a short, localized snackbar message. */
export function friendlyImportErrorMessage(
  lang: ResponseLanguage,
  opts: { loadingStatus?: string; errorText?: string | null }
): string {
  const status = opts.loadingStatus ?? "";
  const err = (opts.errorText ?? "").toLowerCase();

  if (
    status === "ERROR_DOCUMENT_LOAD_QUOTA_EXCEEDED" ||
    status === "ERROR_SUMMARIZING_QUOTA_EXCEEDED" ||
    err.includes("quota") ||
    err.includes("resource_exhausted")
  ) {
    return t("home.snackImportQuota", lang);
  }
  if (status === "TIMEOUT" || err.includes("timeout")) {
    return t("home.snackImportTimeout", lang);
  }
  if (
    status === "ERROR_DOCUMENT_LOAD_INVALID_RESPONSE" ||
    status === "ERROR_SUMMARIZING_INVALID_RESPONSE" ||
    err.includes("invalid response") ||
    err.includes("empty or invalid")
  ) {
    return t("home.snackImportInvalidResponse", lang);
  }
  if (
    err.includes("api_key") ||
    err.includes("api key") ||
    err.includes("missing key") ||
    err.includes("default_api_key")
  ) {
    return t("home.snackImportMissingApiKey", lang);
  }
  return t("home.snackImportFailed", lang);
}

export function sidebarTabLabel(
  tabId: string,
  lang: ResponseLanguage
): string {
  const key = SIDEBAR_TAB_KEYS[tabId];
  return key ? t(key, lang) : tabId;
}

/** Keep the document language attribute in sync with the UI language. */
export function applyDocumentLanguage(lang: ResponseLanguage) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = lang === ResponseLanguage.EN ? "en" : "zh-CN";
}
