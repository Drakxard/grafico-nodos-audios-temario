export interface AppConfig {
  folderName?: string;
}

const KEY = 'appConfig';

export function loadConfig(): AppConfig {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveConfig(cfg: AppConfig) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(cfg));
}
