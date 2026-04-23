const RESPONSABLE_AREA_ROLE_ALIASES = new Set([
  'RESPONSABLEAREA',
  'RESPONSABLE DE AREA',
  'RESPONSABLE_AREA',
  'RESPONSABLEDEAREA',
  'RESPONSABLE DE ÁREA',
  'RESPONSABLE_ÁREA',
]);

function normalizeRoleName(roleName: string | null | undefined) {
  return (roleName ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_\s]+/g, ' ')
    .trim()
    .toUpperCase();
}

export function isResponsibleAreaRoleName(roleName: string | null | undefined) {
  const normalized = normalizeRoleName(roleName);

  return RESPONSABLE_AREA_ROLE_ALIASES.has(normalized);
}
