export const categoricalPalette = [
  '#0f766e',
  '#d75a4a',
  '#4d8b57',
  '#7c5c9b',
  '#b8860b',
  '#2f6f9f',
  '#c45f88',
  '#5b7f2a',
  '#8c6b4f',
  '#3f7d72',
  '#9d4f3a',
  '#5969a8',
];

export function colorFor(label: string): string {
  let hash = 0;
  for (let index = 0; index < label.length; index += 1) {
    hash = (hash * 31 + label.charCodeAt(index)) % 9973;
  }
  return categoricalPalette[Math.abs(hash) % categoricalPalette.length];
}
