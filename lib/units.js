const FAMILY = { g: ['mass', 1], kg: ['mass', 1000], ml: ['vol', 1], l: ['vol', 1000], un: ['unit', 1] };
// Converte qty de "from" para "to". Retorna null se as unidades forem incompativeis.
export function convert(qty, from, to) {
  const a = FAMILY[from], b = FAMILY[to];
  if (!a || !b || a[0] !== b[0]) return null;
  return (qty * a[1]) / b[1];
}
