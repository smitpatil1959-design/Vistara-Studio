export function displayValue(value: unknown, fallback = 'Not available'): string {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    const values = value.map((item) => displayValue(item, '')).filter(Boolean);
    return values.length ? values.join(', ') : fallback;
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if ('value' in record) return displayValue(record.value, fallback);
    if ('claim' in record) return displayValue(record.claim, fallback);
    if ('text' in record) return displayValue(record.text, fallback);
    if ('name' in record) return displayValue(record.name, fallback);
  }
  return fallback;
}

export function isStructuredValue(value: unknown): value is {
  basis?: string;
  value?: unknown;
  evidence?: unknown[];
  confidence?: number;
} {
  return !!value && typeof value === 'object' && ('value' in value || 'basis' in value || 'confidence' in value);
}
