/**
 * Intent event handlers (placeholder for additional processing logic).
 *
 * In a full implementation these would decode the event payload and upsert
 * the full intent record. Kept lightweight here — the processor handles
 * basic persistence directly.
 */

export function decodeIntentCreated(_value: string): Record<string, unknown> {
  // Placeholder: production decodes the ScVal payload from the event value.
  return {};
}
