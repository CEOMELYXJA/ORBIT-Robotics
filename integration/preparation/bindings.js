/* Association future à des applications connues : aucune action Windows ici. */
(function (root) {
  'use strict';
  const supported = Object.freeze(['calculatrice', 'bloc_notes']);
  function makeBinding(nodeId, applicationId) {
    if (typeof nodeId !== 'string' || !nodeId.trim() || nodeId.length > 128) throw new Error('Objet spatial invalide.');
    if (!supported.includes(applicationId)) throw new Error('Application non prise en charge.');
    return Object.freeze({ nodeId, applicationId });
  }
  root.OrbitPreparedBindings = { supported, makeBinding };
  if (typeof module !== 'undefined') module.exports = root.OrbitPreparedBindings;
})(typeof window !== 'undefined' ? window : globalThis);

