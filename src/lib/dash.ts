/**
 * Every client gets their own dash at <slug>.<DASH_DOMAIN>, e.g. sushi-panda.dash.octopos.uz. The
 * domain comes from VITE_DASH_DOMAIN so staging can point somewhere else.
 */
export let DASH_DOMAIN = import.meta.env.VITE_DASH_DOMAIN || "dash.octopos.uz";

export function dashUrl(slug: string) {
  return `https://${slug}.${DASH_DOMAIN}`;
}

/** 3–40 lowercase letters, digits and dashes, not starting or ending with a dash: a valid subdomain. */
export let SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$/;

// Uzbek and Russian Cyrillic to the Latin a subdomain allows, so "Кафе Анор" becomes "kafe-anor"
// instead of nothing.
let CYRILLIC: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  ғ: "g",
  д: "d",
  е: "e",
  ё: "yo",
  ж: "j",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  қ: "q",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ў: "o",
  ф: "f",
  х: "x",
  ҳ: "h",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "sh",
  ъ: "",
  ы: "i",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
};

/** "Rayhon Milliy Taomlar" → "rayhon-milliy-taomlar"; "O'qtepa" → "oqtepa"; "Кафе Анор" → "kafe-anor". */
export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[Ѐ-ӿ]/g, (ch) => CYRILLIC[ch] ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’‘`ʻʼ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
}
