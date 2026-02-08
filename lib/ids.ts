export function makeId(prefix: string): string {
  // Kept outside React components to satisfy strict purity linting.
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

