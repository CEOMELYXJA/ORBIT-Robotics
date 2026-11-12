const assert = require('node:assert/strict');
const {describe} = require('../spatial/relations.js');
const nodes = [
  {id:'garden',name:'Jardin',kind:'folder'},
  {id:'carbon',name:'Carbone',kind:'folder',parentId:'garden',scaleShell:true,generatedScope:true},
  {id:'leaf',name:'Feuille',kind:'folder',parentId:'carbon'},
  {id:'river',name:'Rivière',kind:'folder',parentId:'garden'},
  {id:'app',name:'Outil',kind:'app',parentId:'garden',links:['carbon']}
];
const text = describe(nodes[1],nodes);
assert.match(text,/Situé dans : Jardin/);
assert.match(text,/À l’intérieur : Feuille/);
assert.match(text,/À côté : Rivière, Outil/);
assert.match(text,/Liens dans la carte : Outil/);
assert.match(text,/aucun lien automatique avec un vrai dossier/);
assert.match(describe({id:'empty',kind:'folder',scaleShell:true},[]),/À l’intérieur : aucun pour le moment/);
console.log('Relations : parent, contenu, voisins et liens distingués.');
