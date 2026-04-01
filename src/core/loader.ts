import type { DeriveChange, DeriveOptionLoadResolved } from '../types.js'

export async function loadChangeContent(
  absPath: string,
  changeType: DeriveChange['type'],
  timestamp: DeriveChange['timestamp'],
  load: DeriveOptionLoadResolved
): Promise<DeriveChange> {
  const baseChange: DeriveChange = {
    type: changeType,
    path: absPath,
    timestamp
  }
  const result = await load(absPath)
  if (!result || typeof result !== 'object' || !('content' in result)) return baseChange
  return { ...baseChange, content: result.content }
}
