/* Diagnostics locaux de l'espace ; pas de caméra, de fichiers personnels ni de réseau. */
(function (root) {
  'use strict';
  const agents = [
    {id:'scene', name:'Scène spatiale', run:c=>({status:c.sceneReady?'OK':'À vérifier', detail:c.sceneReady?`Scène chargée : ${c.nodes.length} objets dans la carte.`:'La scène ne semble pas initialisée.'})},
    {id:'structure', name:'Structure des projets', run:c=>{const ids=new Set(c.nodes.map(n=>n.id)); const broken=c.nodes.filter(n=>n.parentId&&!ids.has(n.parentId)); return {status:broken.length?'À vérifier':'OK',detail:`${broken.length} lien(s) vers un parent absent dans la carte.`};}},
    {id:'quality', name:'Qualité des objets', run:c=>{const ids=c.nodes.map(n=>n.id), duplicates=ids.length-new Set(ids).size; return {status:duplicates?'À vérifier':'OK',detail:`${duplicates} identifiant(s) d’objet en double.`};}},
    {id:'pointer', name:'Pointeur', run:c=>({status:c.pointerSeen?'OK':'À vérifier',detail:c.pointerSeen?'Un mouvement du pointeur a été reçu dans l’espace.':'Bouge le pointeur dans l’espace puis relance ce contrôle.'})},
    {id:'hands', name:'Suivi des mains', run:c=>({status:'À vérifier',detail:'Le suivi utilise la fenêtre ORBIT séparée ; ce contrôle ne peut pas confirmer la caméra ni la reconnaissance des mains.'})},
    {id:'privacy', name:'Confidentialité', run:c=>({status:c.networkBlocked?'OK':'À vérifier',detail:c.networkBlocked?'La page bloque les connexions réseau par sa politique locale.':'La protection réseau de la page n’a pas été détectée.'})},
    {id:'safety', name:'Précision et sécurité', run:c=>({status:c.handMode?'OK':'À vérifier',detail:c.handMode?'Mode main activé : les planètes ne peuvent pas être déplacées par inadvertance.':'Mode main désactivé : le déplacement des planètes est permis.'})},
    {id:'tasks', name:'Tâches', run:c=>{const tasks=c.nodes.filter(n=>n.kind==='task'); return {status:'OK',detail:`${tasks.length} tâche(s) dans la carte ; les tâches de cet espace sont suivies localement.`};}}
  ];
  function runAgent(id, context) {
    const agent=agents.find(a=>a.id===id);
    if (!agent) throw new Error('Outil introuvable');
    try { return agent.run(context); }
    catch { return {status:'Erreur',detail:'Ce contrôle n’a pas pu être exécuté.'}; }
  }
  root.OrbitAgents={agents,runAgent};
  if (typeof module !== 'undefined') module.exports=root.OrbitAgents;
})(typeof window !== 'undefined' ? window : globalThis);

