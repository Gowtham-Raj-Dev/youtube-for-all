/** YouTube counts the commas between tags and adds quotes around tags with spaces (limit 500). */
export function tagsLength(tags: string[]) {
  return tags.reduce((n, t) => n + t.length + (t.includes(" ") ? 2 : 0), 0) + Math.max(0, tags.length - 1);
}

export function parseTags(s: string) {
  return [...new Set(s.split(",").map((t) => t.trim().replace(/^#/, "")).filter(Boolean))];
}
