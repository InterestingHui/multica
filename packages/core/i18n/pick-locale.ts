import { match } from "@formatjs/intl-localematcher";
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  type LocaleAdapter,
  type SupportedLocale,
} from "./types";

export function matchLocale(candidates: string[]): SupportedLocale {
  if (candidates.length === 0) return DEFAULT_LOCALE;
  try {
    return match(
      candidates,
      SUPPORTED_LOCALES,
      DEFAULT_LOCALE,
    ) as SupportedLocale;
  } catch {
    return DEFAULT_LOCALE;
  }
}

export function pickLocale(adapter: LocaleAdapter): SupportedLocale {
  const choice = adapter.getUserChoice();
  if (choice) return matchLocale([choice]);
  // No explicit user preference — use DEFAULT_LOCALE instead of browser
  // Accept-Language. The user can explicitly choose a locale in Settings,
  // which is persisted to both the adapter and user.language in the DB.
  return DEFAULT_LOCALE;
}
