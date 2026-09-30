function formatMeasurementKey(key: string): string {
  const withoutUnit = key.replace(/_in$/, '')
  const spaced = withoutUnit.replace(/_/g, ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

function formatMeasurementValue(key: string, value: number | string): string {
  if (key.endsWith('_in') && typeof value === 'number') {
    return `${value} in`
  }
  return String(value)
}

export function Measurements({ data }: { data: Record<string, number | string> }) {
  const entries = Object.entries(data)
  if (entries.length === 0) return null

  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
      {entries.map(([key, value]) => (
        <div key={key} className="flex justify-between gap-2 border-b border-brand-gray-100 py-1">
          <dt className="text-brand-gray-500">{formatMeasurementKey(key)}</dt>
          <dd className="font-medium text-brand-gray-900">{formatMeasurementValue(key, value)}</dd>
        </div>
      ))}
    </dl>
  )
}
