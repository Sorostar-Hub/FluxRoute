/**
 * StatusBadge — colored pill showing an intent's lifecycle status.
 */

import type { IntentStatus } from '@fluxroute/sdk';

const STATUS_STYLES: Record<IntentStatus, string> = {
  Open: 'bg-blue-100 text-blue-700',
  Pending: 'bg-yellow-100 text-yellow-700',
  Filled: 'bg-green-100 text-green-700',
  Cancelled: 'bg-gray-200 text-gray-700',
  Expired: 'bg-red-100 text-red-700',
};

export function StatusBadge({ status }: { status: IntentStatus }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  );
}
