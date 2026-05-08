interface TagColor {
  bg: string;
  text: string;
  border: string;
  darkBg: string;
  darkText: string;
  darkBorder: string;
}

const TAG_PALETTE: TagColor[] = [
  { bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-100", darkBg: "dark:bg-blue-900/30", darkText: "dark:text-blue-400", darkBorder: "dark:border-blue-800" },
  { bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-100", darkBg: "dark:bg-emerald-900/30", darkText: "dark:text-emerald-400", darkBorder: "dark:border-emerald-800" },
  { bg: "bg-violet-50", text: "text-violet-600", border: "border-violet-100", darkBg: "dark:bg-violet-900/30", darkText: "dark:text-violet-400", darkBorder: "dark:border-violet-800" },
  { bg: "bg-amber-50", text: "text-amber-600", border: "border-amber-100", darkBg: "dark:bg-amber-900/30", darkText: "dark:text-amber-400", darkBorder: "dark:border-amber-800" },
  { bg: "bg-rose-50", text: "text-rose-600", border: "border-rose-100", darkBg: "dark:bg-rose-900/30", darkText: "dark:text-rose-400", darkBorder: "dark:border-rose-800" },
  { bg: "bg-cyan-50", text: "text-cyan-600", border: "border-cyan-100", darkBg: "dark:bg-cyan-900/30", darkText: "dark:text-cyan-400", darkBorder: "dark:border-cyan-800" },
  { bg: "bg-orange-50", text: "text-orange-600", border: "border-orange-100", darkBg: "dark:bg-orange-900/30", darkText: "dark:text-orange-400", darkBorder: "dark:border-orange-800" },
  { bg: "bg-teal-50", text: "text-teal-600", border: "border-teal-100", darkBg: "dark:bg-teal-900/30", darkText: "dark:text-teal-400", darkBorder: "dark:border-teal-800" },
  { bg: "bg-fuchsia-50", text: "text-fuchsia-600", border: "border-fuchsia-100", darkBg: "dark:bg-fuchsia-900/30", darkText: "dark:text-fuchsia-400", darkBorder: "dark:border-fuchsia-800" },
  { bg: "bg-lime-50", text: "text-lime-600", border: "border-lime-100", darkBg: "dark:bg-lime-900/30", darkText: "dark:text-lime-400", darkBorder: "dark:border-lime-800" },
];

function hashString(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function getTagColor(tag: string): TagColor {
  return TAG_PALETTE[hashString(tag) % TAG_PALETTE.length];
}

export const TAG_COLORS = TAG_PALETTE;
