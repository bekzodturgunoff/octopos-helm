import {config} from "./config.ts";
import type {Lang} from "./i18n.ts";

/** Telegram's HTML mode: only these three need escaping. Everything from the API goes through it. */
export function esc(value: string | number | undefined | null) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

let LOCALE: Record<Lang, string> = {uz: "uz-Latn-UZ", ru: "ru-RU", en: "en-GB"};

/** "12 Nov", or "12 Nov, 14:30" with the time. Always Tashkent time: that is where the team is. */
export function date(at: string | undefined, lang: Lang, withTime = false) {
  if (!at) return "";
  return new Date(at).toLocaleString(LOCALE[lang], {timeZone: "Asia/Tashkent", day: "numeric", month: "short", ...(withTime ? {hour: "2-digit", minute: "2-digit"} : {})});
}

export function helmURL(path: string) {
  return `${config.appURL}${path}`;
}

export function dashURL(slug: string) {
  return `https://${slug}.${config.dashDomain}`;
}

let WORDS: Record<Lang, Record<string, string>> = {
  en: {
    onboarding: "Onboarding",
    active: "Active",
    suspended: "Suspended",
    churned: "Left",
    trialing: "Trial",
    pastDue: "Past due",
    canceled: "Canceled",
    scheduledCancel: "Cancels at period end",
    expired: "Expired",
    pending: "Pending",
    good: "🟢 Good",
    watch: "🟡 Watch",
    atRisk: "🔴 At risk",
  },
  uz: {
    onboarding: "Ulanmoqda",
    active: "Faol",
    suspended: "To'xtatilgan",
    churned: "Ketgan",
    trialing: "Sinov",
    pastDue: "Muddati o'tgan",
    canceled: "Bekor qilingan",
    scheduledCancel: "Davr oxirida bekor bo'ladi",
    expired: "Muddati tugagan",
    pending: "Kutilmoqda",
    good: "🟢 Yaxshi",
    watch: "🟡 Kuzatish",
    atRisk: "🔴 Xavf ostida",
  },
  ru: {
    onboarding: "Подключение",
    active: "Активен",
    suspended: "Приостановлен",
    churned: "Ушёл",
    trialing: "Пробный",
    pastDue: "Просрочен",
    canceled: "Отменён",
    scheduledCancel: "Отмена в конце периода",
    expired: "Истёк",
    pending: "Ожидает",
    good: "🟢 Хорошо",
    watch: "🟡 Под наблюдением",
    atRisk: "🔴 Под угрозой",
  },
};

export function word(value: string, lang: Lang) {
  return WORDS[lang][value] ?? value;
}
