import { formatGhs } from '../../lib/format'
import { useSettings } from '../../hooks/useSettings'

/** How to pay by mobile money. The number/network/name are admin-editable settings. */
export function PaymentInstructions({ amount }: { amount: number }) {
  const { text } = useSettings()
  return (
    <div className="rounded-lg border border-brand-gray-200 bg-brand-gray-50 p-4 text-sm">
      <h3 className="font-semibold text-brand-gray-900">How to pay</h3>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-brand-gray-700">
        <li>
          Send <strong>{formatGhs(amount)}</strong> by {text('payment_network', 'mobile money')} to{' '}
          <strong>{text('payment_number', '—')}</strong>
          {text('payment_account_name') && <> ({text('payment_account_name')})</>}.
        </li>
        <li>Copy the transaction reference from the confirmation message.</li>
        <li>Paste it on your order page. We confirm payment, then your items are yours.</li>
      </ol>
      <p className="mt-2 text-xs text-brand-gray-500">
        Your items are held for 24 hours after you place the order.
      </p>
    </div>
  )
}
