/**
 * Pulls out the numbers a bullet claims: percentages, money, counts with units, plain figures.
 * The checker later requires that any number in a tailored line appears in this list for the
 * bullets it cites, so this is deliberately generous: it's better to list a number than miss one.
 */
const PATTERNS: RegExp[] = [
  /[$€£₱¥]\s?\d[\d,]*(?:\.\d+)?\s?(?:[kKmMbB]|million|billion|thousand)?\+?/g,
  /\d[\d,]*(?:\.\d+)?\s?%/g,
  /\d+(?:\.\d+)?\s?[xX×](?![a-zA-Z])/g,
  /\d[\d,]*(?:\.\d+)?\s?(?:[kKmMbB]|million|billion|thousand)\+?(?![a-zA-Z])/g,
  /\d[\d,]*(?:\.\d+)?\+?/g,
];

export function extractMetrics(text: string): string[] {
  const found: { index: number; value: string }[] = [];
  let remaining = text;
  for (const pattern of PATTERNS) {
    for (const match of remaining.matchAll(pattern)) {
      found.push({ index: match.index, value: match[0].trim() });
      // Blank out what matched so a shorter pattern doesn't report the same digits again.
      remaining =
        remaining.slice(0, match.index) +
        ' '.repeat(match[0].length) +
        remaining.slice(match.index + match[0].length);
    }
  }
  return found
    .sort((a, b) => a.index - b.index)
    .map((item) => item.value)
    .filter((value, position, all) => all.indexOf(value) === position);
}
