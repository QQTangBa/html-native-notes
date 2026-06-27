export type Locale = 'en' | 'zh';
export type ThemeMode = 'dark' | 'light';

export interface AppCopy {
  preferences: {
    language: string;
    theme: string;
    english: string;
    chinese: string;
    darkTheme: string;
    lightTheme: string;
  };
  notes: {
    ariaLabel: string;
    eyebrow: string;
    title: string;
    titleLabel: string;
    titlePlaceholder: string;
    create: string;
    save: string;
    duplicate: string;
    delete: string;
    empty: string;
    savedNotes: string;
    actions: string;
  };
  settings: {
    ariaLabel: string;
    configured: string;
    notConfigured: string;
    keyStored: string;
    noKey: string;
    tokens: string;
  };
  status: {
    ready: string;
    editing: (title: string) => string;
  };
  vault: {
    ariaLabel: string;
    sidebarLabel: string;
    eyebrow: string;
    title: string;
    search: string;
    searchPlaceholder: string;
    tree: string;
    openFolder: (path: string) => string;
    tags: string;
    sources: string;
    library: string;
    assets: string;
    cardView: string;
    listView: string;
    clearFilters: string;
    clear: string;
    generate: string;
    rendering: string;
    readOnlyPreview: string;
    editableDraft: string;
    editPreview: string;
    edit: string;
  };
}

export const appCopy: Record<Locale, AppCopy> = {
  en: {
    preferences: {
      language: 'Language',
      theme: 'Theme',
      english: 'English',
      chinese: '中文',
      darkTheme: 'Dark theme',
      lightTheme: 'Light theme',
    },
    notes: {
      ariaLabel: 'Note library',
      eyebrow: 'Library',
      title: 'HTML Notes',
      titleLabel: 'Note title',
      titlePlaceholder: 'New HTML note',
      create: 'Create note',
      save: 'Save',
      duplicate: 'Copy',
      delete: 'Delete',
      empty: 'No notes yet. Create an HTML file to begin.',
      savedNotes: 'Saved notes',
      actions: 'Note actions',
    },
    settings: {
      ariaLabel: 'AI settings status',
      configured: 'AI configured',
      notConfigured: 'AI not configured',
      keyStored: 'key stored',
      noKey: 'no key',
      tokens: 'tokens',
    },
    status: {
      ready: 'Ready',
      editing: (title) => `Editing ${title}`,
    },
    vault: {
      ariaLabel: 'Vault home',
      sidebarLabel: 'Vault folders and filters',
      eyebrow: 'HTML Vault',
      title: 'Vault',
      search: 'Search Vault',
      searchPlaceholder: 'Search title, tag, source...',
      tree: 'Vault tree',
      openFolder: (path) => `Open folder ${path}`,
      tags: 'Tags',
      sources: 'Sources',
      library: 'Library',
      assets: 'assets',
      cardView: 'Card view',
      listView: 'List view',
      clearFilters: 'Clear filters',
      clear: 'Clear',
      generate: 'Generate',
      rendering: 'Rendering',
      readOnlyPreview: 'Read-only preview',
      editableDraft: 'Editable draft',
      editPreview: 'Edit preview HTML',
      edit: 'Edit',
    },
  },
  zh: {
    preferences: {
      language: '语言',
      theme: '主题',
      english: 'English',
      chinese: '中文',
      darkTheme: '深色主题',
      lightTheme: '浅色主题',
    },
    notes: {
      ariaLabel: '笔记库',
      eyebrow: '笔记库',
      title: 'HTML 笔记',
      titleLabel: '笔记标题',
      titlePlaceholder: '新 HTML 笔记',
      create: '创建笔记',
      save: '保存',
      duplicate: '复制',
      delete: '删除',
      empty: '还没有笔记。创建一个 HTML 文件开始。',
      savedNotes: '已保存笔记',
      actions: '笔记操作',
    },
    settings: {
      ariaLabel: 'AI 配置状态',
      configured: 'AI 已配置',
      notConfigured: 'AI 未配置',
      keyStored: '已保存密钥',
      noKey: '未配置密钥',
      tokens: 'tokens',
    },
    status: {
      ready: 'Ready',
      editing: (title) => `正在编辑 ${title}`,
    },
    vault: {
      ariaLabel: '笔记库首页',
      sidebarLabel: '笔记库目录与筛选',
      eyebrow: 'HTML 笔记库',
      title: '笔记库',
      search: '搜索笔记库',
      searchPlaceholder: '搜索标题、标签、来源...',
      tree: '笔记库目录树',
      openFolder: (path) => `打开文件夹 ${path}`,
      tags: '标签',
      sources: '来源',
      library: '资产库',
      assets: '资产',
      cardView: '卡片视图',
      listView: '列表视图',
      clearFilters: '清除筛选',
      clear: '清除',
      generate: '生成',
      rendering: '生成中',
      readOnlyPreview: '只读预览',
      editableDraft: '可编辑草稿',
      editPreview: '编辑预览 HTML',
      edit: '编辑',
    },
  },
};

function getStorage(): Storage | undefined {
  if (typeof window === 'undefined' || !window.localStorage) {
    return undefined;
  }

  return window.localStorage;
}

export function detectInitialLocale(): Locale {
  const stored = getStorage()?.getItem('html-native-notes.locale');
  if (stored === 'en' || stored === 'zh') {
    return stored;
  }

  return 'en';
}

export function detectInitialTheme(): ThemeMode {
  const stored = getStorage()?.getItem('html-native-notes.theme');
  if (stored === 'dark' || stored === 'light') {
    return stored;
  }

  return 'dark';
}

export function persistPreference(key: 'locale' | 'theme', value: Locale | ThemeMode): void {
  getStorage()?.setItem(`html-native-notes.${key}`, value);
}
