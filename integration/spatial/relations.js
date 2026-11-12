/* Relation des objets de la carte : aucun accès aux fichiers Windows. */
(function (root) {
  'use strict';
  function listNames(items) {
    if (!items.length) return 'aucun pour le moment';
    const labels = items.slice(0, 5).map(item => String(item.name || 'Sans nom'));
    return labels.join(', ') + (items.length > 5 ? ` et ${items.length - 5} autre(s)` : '');
  }
  function describe(item, nodes) {
    if (!item || !Array.isArray(nodes)) return '';
    const parent = nodes.find(node => node.id === item.parentId);
    const inside = nodes.filter(node => node.parentId === item.id);
    const neighbours = item.parentId ? nodes.filter(node => node.id !== item.id && node.parentId === item.parentId) : [];
    const references = new Set(Array.isArray(item.links) ? item.links : []);
    const linked = nodes.filter(node => node.id !== item.id && (references.has(node.id) || (Array.isArray(node.links) && node.links.includes(item.id))));
    const lines = [`Situé dans : ${parent ? parent.name : 'espace principal'}`];
    if (item.kind === 'folder' || item.kind === 'root') {
      lines.push(`À l’intérieur : ${listNames(inside)}`);
      if (!inside.length && item.scaleShell) lines.push('Des objets de démonstration pourront être créés en explorant cet espace.');
    }
    lines.push(`À côté : ${listNames(neighbours)}`);
    lines.push(`Liens dans la carte : ${listNames(linked)}`);
    if (item.generatedScope || item.scaleShell) lines.push('Espace généré : aucun lien automatique avec un vrai dossier ou programme Windows.');
    return lines.join('\n');
  }
  root.OrbitRelations = {describe};
  if (typeof module !== 'undefined') module.exports = root.OrbitRelations;
})(typeof window !== 'undefined' ? window : globalThis);
