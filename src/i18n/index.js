import {NativeModules, Platform} from 'react-native';
import en from './locales/en.json';
import tr from './locales/tr.json';
import es from './locales/es.json';
import de from './locales/de.json';
import fr from './locales/fr.json';
import pt from './locales/pt.json';
import ptBR from './locales/pt-BR.json';
import ar from './locales/ar.json';
import ru from './locales/ru.json';
import zhHans from './locales/zh-Hans.json';
import zhHant from './locales/zh-Hant.json';
import ja from './locales/ja.json';
import ko from './locales/ko.json';
import hi from './locales/hi.json';
import it from './locales/it.json';
import nl from './locales/nl.json';
import pl from './locales/pl.json';
import id from './locales/id.json';
import uk from './locales/uk.json';
import vi from './locales/vi.json';
import th from './locales/th.json';
import sv from './locales/sv.json';
import he from './locales/he.json';

const PACKS = {
  en,
  tr,
  es,
  de,
  fr,
  pt,
  'pt-BR': ptBR,
  ar,
  ru,
  'zh-Hans': zhHans,
  'zh-Hant': zhHant,
  zh: zhHans,
  ja,
  ko,
  hi,
  it,
  nl,
  pl,
  id,
  uk,
  vi,
  th,
  sv,
  he,
};

const RTL_LOCALES = new Set(['ar', 'he']);

export const SUPPORTED_LOCALES = Object.keys(PACKS).filter((k) => k !== 'zh');

export const isRtlLocale = (locale) => RTL_LOCALES.has(normalizeLocale(locale));

export const detectDeviceLocale = () => {
  try {
    const locales =
      Platform.OS === 'ios'
        ? NativeModules.SettingsManager?.settings?.AppleLocale ||
          NativeModules.SettingsManager?.settings?.AppleLanguages?.[0]
        : NativeModules.I18nManager?.localeIdentifier;
    if (locales) {
      return String(locales).replace('_', '-');
    }
    if (typeof Intl !== 'undefined') {
      return Intl.DateTimeFormat().resolvedOptions().locale;
    }
  } catch (_e) {
    // ignore
  }
  return 'en';
};

export const normalizeLocale = (locale) => {
  if (!locale || locale === 'auto') {
    return normalizeLocale(detectDeviceLocale());
  }
  const raw = String(locale).replace('_', '-');
  if (PACKS[raw]) {
    return raw;
  }
  const base = raw.split('-')[0];
  if (base === 'zh') {
    if (/Hant|TW|HK|MO/i.test(raw)) {
      return 'zh-Hant';
    }
    return 'zh-Hans';
  }
  if (base === 'pt' && /BR/i.test(raw)) {
    return 'pt-BR';
  }
  if (PACKS[base]) {
    return base;
  }
  return 'en';
};

export const formatLabel = (template, vars = {}) => {
  if (!template) {
    return '';
  }
  return String(template).replace(/\{(\w+)\}/g, (_, key) =>
    vars[key] === undefined || vars[key] === null ? '' : String(vars[key]),
  );
};

export const resolveLabels = (locale = 'auto', overrides = {}) => {
  const code = normalizeLocale(locale);
  return {
    ...PACKS.en,
    ...(PACKS[code] || {}),
    ...(overrides || {}),
  };
};

export default resolveLabels;
