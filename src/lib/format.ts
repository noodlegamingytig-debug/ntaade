const formatter = new Intl.NumberFormat('en-GH', {
  style: 'currency',
  currency: 'GHS',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatGhs(amount: number): string {
  return formatter.format(amount)
}

export function percentOff(basePrice: number, currentPrice: number): number {
  if (basePrice <= 0) return 0
  return Math.round(((basePrice - currentPrice) / basePrice) * 100)
}
