const TAG_PALETTE = [
  { bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-100" },
  { bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-100" },
  { bg: "bg-violet-50", text: "text-violet-600", border: "border-violet-100" },
  { bg: "bg-amber-50", text: "text-amber-600", border: "border-amber-100" },
  { bg: "bg-rose-50", text: "text-rose-600", border: "border-rose-100" },
  { bg: "bg-cyan-50", text: "text-cyan-600", border: "border-cyan-100" },
  { bg: "bg-orange-50", text: "text-orange-600", border: "border-orange-100" },
  { bg: "bg-teal-50", text: "text-teal-600", border: "border-teal-100" },
  { bg: "bg-fuchsia-50", text: "text-fuchsia-600", border: "border-fuchsia-100" },
  { bg: "bg-lime-50", text: "text-lime-600", border: "border-lime-100" },
];

function hashString(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function getTagColor(tag: string) {
  return TAG_PALETTE[hashString(tag) % TAG_PALETTE.length];
}

export const TAG_COLORS = TAG_PALETTE;
