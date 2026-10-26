export function isGoogleDark(): boolean {
  // Prefer the page's painted surface; a transparent body falls back to html/system.
  for (const element of [document.body, document.documentElement]) {
    if (!element) continue;
    const color = getComputedStyle(element).backgroundColor;
    const match = color.match(/rgba?\(\s*(\d+)[, ]+\s*(\d+)[, ]+\s*(\d+)(?:\s*[,/]\s*([\d.]+))?/);
    if (match && (!match[4] || Number(match[4]) > 0.5))
      return (
        0.2126 * Number(match[1]) + 0.7152 * Number(match[2]) + 0.0722 * Number(match[3]) < 140
      );
  }
  return matchMedia('(prefers-color-scheme: dark)').matches;
}
