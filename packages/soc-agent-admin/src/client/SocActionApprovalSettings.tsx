export interface SocAction {
  name: string
  group: string
  label: string
  kind?: 'read' | 'mutation' | 'ui-confirmed'
}

export function validCatalog(value: unknown): SocAction[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  return value.flatMap(item => {
    if (!item || typeof item !== 'object') return []
    const candidate = item as Record<string, unknown>
    if (typeof candidate.name !== 'string' || typeof candidate.group !== 'string' || typeof candidate.label !== 'string') return []
    if (candidate.name.length === 0 || seen.has(candidate.name)) return []
    seen.add(candidate.name)
    const kind = candidate.kind === 'read' || candidate.kind === 'mutation' || candidate.kind === 'ui-confirmed'
      ? candidate.kind
      : undefined
    return [{
      name: candidate.name,
      group: candidate.group,
      label: candidate.label,
      ...(kind === undefined ? {} : { kind }),
    }]
  })
}
