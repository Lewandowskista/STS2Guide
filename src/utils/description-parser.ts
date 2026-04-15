// Strip description markup from Spire Codex description text
// e.g. {D}12{X} -> 12, [Strength] -> Strength
export function cleanDescription(raw: string): string {
  if (!raw) return ''
  return raw
    .replace(/\{[A-Z*]\}/g, '')     // {D}, {X}, etc.
    .replace(/\[([^\]]+)\]/g, '$1') // [Keyword] -> Keyword
    .replace(/NL/g, '\n')
    .replace(/\s+/g, ' ')
    .trim()
}

export function descriptionToLines(raw: string): string[] {
  return cleanDescription(raw).split('\n').map(l => l.trim()).filter(Boolean)
}
