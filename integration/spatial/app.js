(() => {
  'use strict';

  const STORAGE_KEY = 'orbit-spatial-demo-v1';
  const DB_NAME = 'winmap-local-handles-v1';
  const DB_STORE = 'directories';
  const MAX_IMPORTED_NODES = 220;
  const MAX_IMPORTED_DEPTH = 5;
  const MAX_NATIVE_WINDOWS = 32;
  const MAX_FILE_PREVIEW_BYTES = 512 * 1024;
  const MAX_IMAGE_PREVIEW_BYTES = 24 * 1024 * 1024;
  const TEXT_PREVIEW_EXTENSIONS = new Set(['txt', 'md', 'csv', 'tsv', 'json', 'xml', 'yaml', 'yml', 'ini', 'log', 'html', 'css', 'js', 'ts', 'py', 'cs', 'ps1', 'sh']);
  const IMAGE_PREVIEW_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif', 'image/bmp']);
  const FIELDS = {
    magnetic: { label: 'Magnétisme', cap: 'CHAMP MAGNÉTIQUE', color: '#81d8c4' },
    gravity: { label: 'Gravité', cap: 'PUITS GRAVITATIONNEL', color: '#f2bc7c' },
    electric: { label: 'Charge', cap: 'FLUX ÉLECTRIQUE', color: '#a99bff' }
  };
  const FIELD_EXPLANATIONS = {
    magnetic: 'Magnétisme : les lignes montrent les liens entre objets. C’est une analogie visuelle, pas une force réelle.',
    gravity: 'Gravité : les espaces riches en objets creusent davantage la scène. C’est une métaphore visuelle, pas une vraie force.',
    electric: 'Charge : les signes et courants indiquent des polarités fictives. Les fichiers n’ont pas de charge électrique.'
  };
  const SPACE_MENU_VIEWS = {
    main: {
      coreName: 'Espace', coreHint: 'Glisser le fond pour tourner · cliquer pour fermer', coreColor: '#b9e3d8',
      items: [
        { action: 'explore', name: 'Explorer', hint: 'Recherche · dossiers connectés', glyph: '⌕', color: '#b6a5ff' },
        { action: 'settings', name: 'Réglages', hint: 'Champs physiques · mouvement', glyph: '⌘', color: '#c2a8ef' },
        { action: 'walk', name: 'Mode veille', hint: 'Vue intérieure · W A S D', glyph: '◉', color: '#e7c581' },
        { action: 'zoom-out', name: 'Écosystème extérieur', hint: 'Remonter d’un niveau', glyph: '↶', color: '#91bfe5' },
        { action: 'home', name: 'Le Bureau', hint: 'Retour direct au noyau', glyph: '⌂', color: '#ecc17c' },
        { action: 'create', name: 'Créer ici', hint: 'Dossier · app · widget · tâche', glyph: '＋', color: '#d7a8dc' },
        { action: 'windows', name: 'Fenêtres ouvertes', hint: 'Instantané local temporaire', glyph: '▣', color: '#83bfd0', nativeOnly: true },
        { action: 'close', name: 'Fermer Winmap', hint: 'Quitter cette fenêtre', glyph: '×', color: '#c1a6a1', nativeOnly: true }
      ]
    },
    explore: {
      coreName: 'Explorer', coreHint: 'Glisser le fond pour tourner · cliquer pour revenir', coreColor: '#b6a5ff',
      items: [
        { action: 'search', name: 'Recherche', hint: 'Nom · chemin · extension', glyph: '⌕', color: '#b6a5ff' },
        { action: 'connect', name: 'Dossiers locaux', hint: 'Choisir une racine sur cet appareil', glyph: '◈', color: '#8bd8c5' }
      ]
    },
    settings: {
      coreName: 'Réglages', coreHint: 'Glisser le fond pour tourner · cliquer pour revenir', coreColor: '#c2a8ef',
      items: [
        { action: 'field-magnetic', name: 'Magnétisme', hint: 'Lignes de liens entre objets', glyph: '⌁', color: '#81d8c4' },
        { action: 'field-gravity', name: 'Gravité', hint: 'Les espaces riches courbent la scène', glyph: '◎', color: '#f2bc7c' },
        { action: 'field-electric', name: 'Charge', hint: 'Polarités fictives et courants', glyph: 'ϟ', color: '#a99bff' },
        { action: 'motion', name: 'Rythme', hint: 'Cliquer pour passer de calme à vivant', glyph: '∿', color: '#85d7c4' }
      ]
    },
    fields: {
      coreName: 'Retour', coreHint: 'Revenir à Espace · glisser le fond pour tourner', coreColor: '#91cdbd',
      items: [
        { action: 'field-magnetic', name: 'Magnétisme', hint: 'Liens entre dossiers et applications', glyph: '⌁', color: '#81d8c4' },
        { action: 'field-gravity', name: 'Gravité', hint: 'Courbure des espaces riches en objets', glyph: '◎', color: '#f2bc7c' },
        { action: 'field-electric', name: 'Charge', hint: 'Polarités fictives et flux électriques', glyph: 'ϟ', color: '#a99bff' }
      ]
    },
    create: {
      coreName: 'Retour', coreHint: 'Revenir à Espace · glisser le fond pour tourner', coreColor: '#d4b7dc',
      items: [
        { action: 'create-folder', name: 'Dossier', hint: 'Un nouvel espace orbital', glyph: '◈', color: '#8bd8c5' },
        { action: 'create-app', name: 'Application', hint: 'Un atome d’application', glyph: '⌘', color: '#91b9eb' },
        { action: 'create-widget', name: 'Widget', hint: 'Un outil local', glyph: '◷', color: '#e2c781' },
        { action: 'create-task', name: 'Tâche', hint: 'Suivi manuel enregistré', glyph: '◴', color: '#e7bb82' },
        { action: 'create-file', name: 'Atome libre', hint: 'Un repère spatial local', glyph: '·', color: '#c5b9a0' }
      ]
    }
  };

  const sampleNodes = [
    { id: 'environment', name: 'Écosystème', kind: 'folder', glyph: '◉', color: '#b6c3a1', radius: .48, mass: 4.2, charge: 1, parentId: null, orbit: 0, phase: 0, speed: 0, lift: 0, scaleShell: true, generatedScope: true, scaleDepth: 1 },
    { id: 'root', name: 'Bureau', kind: 'root', glyph: '◉', color: '#edbd75', radius: .58, mass: 3.2, charge: 1, parentId: 'environment', orbit: 4.0, phase: .25, speed: .018, lift: 0 },
    { id: 'memory-world', name: 'Mémoire', kind: 'folder', glyph: '◈', color: '#87d4c2', radius: .33, mass: 1.5, charge: 1, parentId: 'environment', orbit: 4.55, phase: 2.02, speed: -.014, inclination: .24, scaleShell: true, generatedScope: true, scaleDepth: 2 },
    { id: 'studio-world', name: 'Création', kind: 'folder', glyph: '◈', color: '#c59ee7', radius: .34, mass: 1.7, charge: -1, parentId: 'environment', orbit: 4.7, phase: 4.12, speed: .012, inclination: -.32, scaleShell: true, generatedScope: true, scaleDepth: 2 },
    { id: 'network-world', name: 'Réseau', kind: 'folder', glyph: '◈', color: '#87b9e7', radius: .31, mass: 1.3, charge: 1, parentId: 'environment', orbit: 4.85, phase: 5.53, speed: -.016, inclination: .41, scaleShell: true, generatedScope: true, scaleDepth: 2 },
    { id: 'documents', name: 'Documents', kind: 'folder', glyph: '◈', color: '#87d4c2', radius: .36, mass: 1.8, charge: 1, parentId: 'root', orbit: 4.4, phase: .15, speed: .075, inclination: .11, lift: .05 },
    { id: 'projects', name: 'Projets', kind: 'folder', glyph: '◈', color: '#91baf5', radius: .39, mass: 2.2, charge: 1, parentId: 'root', orbit: 4.6, phase: 1.42, speed: -.055, inclination: .52, lift: .08 },
    { id: 'images', name: 'Images', kind: 'folder', glyph: '◈', color: '#db9fc9', radius: .34, mass: 1.5, charge: -1, parentId: 'root', orbit: 4.3, phase: 3.34, speed: .061, inclination: -.24, lift: -.08 },
    { id: 'downloads', name: 'Téléchargements', kind: 'folder', glyph: '◈', color: '#e9a77c', radius: .32, mass: 1.1, charge: -1, parentId: 'root', orbit: 4.8, phase: 4.78, speed: -.081, inclination: -.48, lift: -.03 },

    { id: 'edge', name: 'Navigateur', kind: 'app', glyph: '◉', color: '#76cce3', radius: .25, mass: .6, charge: -1, parentId: 'root', orbit: 2.55, phase: .65, speed: .11, inclination: -.36, running: true, links: ['documents', 'projects'] },
    { id: 'vscode', name: 'Atelier code', kind: 'app', glyph: '⌘', color: '#83aef1', radius: .27, mass: .7, charge: 1, parentId: 'projects', orbit: 1.78, phase: .62, speed: -.09, inclination: .45, running: true, links: ['projects', 'documents'] },
    { id: 'photos', name: 'Photothèque', kind: 'app', glyph: '▧', color: '#e8a5cf', radius: .25, mass: .55, charge: -1, parentId: 'images', orbit: 1.72, phase: 2.5, speed: .095, inclination: -.2, running: false, links: ['images'] },
    { id: 'blender', name: 'Atelier 3D', kind: 'app', glyph: '◒', color: '#eab17f', radius: .25, mass: .6, charge: 1, parentId: 'projects', orbit: 2.02, phase: 3.26, speed: -.07, inclination: .22, running: false, links: ['projects', 'images'] },
    { id: 'notes-app', name: 'Bloc-notes', kind: 'app', glyph: '≡', color: '#e5cd8c', radius: .22, mass: .45, charge: -1, parentId: 'documents', orbit: 1.8, phase: 5.35, speed: .08, inclination: .36, running: false, links: ['documents'] },

    { id: 'clock-widget', name: 'Horloge', kind: 'widget', widgetType: 'clock', glyph: '◷', color: '#e6c990', radius: .25, mass: .3, charge: 1, parentId: 'root', orbit: 5.5, phase: .8, speed: -.04, inclination: .16 },
    { id: 'focus-widget', name: 'Foyer', kind: 'widget', widgetType: 'focus', glyph: '◌', color: '#b2a5fa', radius: .25, mass: .3, charge: -1, parentId: 'root', orbit: 5.75, phase: 2.83, speed: .037, inclination: -.31 },
    { id: 'field-widget', name: 'Résonance', kind: 'widget', widgetType: 'field', glyph: '⌁', color: '#83d0bb', radius: .24, mass: .25, charge: 1, parentId: 'root', orbit: 5.25, phase: 2.32, speed: -.044, inclination: .74 },
    { id: 'map-task', name: 'Cartographier un espace', kind: 'task', glyph: '◴', color: '#e7bb82', radius: .24, mass: .34, charge: 1, parentId: 'root', orbit: 6.3, phase: 4.96, speed: .018, inclination: .18, taskStatus: 'queued', taskProgress: 0 },

    { id: 'notes', name: 'Notes', kind: 'folder', glyph: '◈', color: '#81d8c4', radius: .26, mass: .8, charge: 1, parentId: 'documents', orbit: 1.06, phase: .2, speed: .11, inclination: .5 },
    { id: 'archives', name: 'Archives', kind: 'folder', glyph: '◈', color: '#85c7b5', radius: .24, mass: .7, charge: -1, parentId: 'documents', orbit: 1.2, phase: 2.12, speed: -.08, inclination: -.35 },
    { id: 'bookmarks', name: 'Références', kind: 'folder', glyph: '◈', color: '#93cfc0', radius: .23, mass: .6, charge: 1, parentId: 'documents', orbit: 1.08, phase: 4.42, speed: .075, inclination: .2 },
    { id: 'note-idea', name: 'Idées-en-orbite.md', kind: 'file', glyph: '·', extension: 'MD', size: 18240, color: '#badcd3', radius: .115, mass: .08, charge: -1, parentId: 'documents', orbit: 1.38, phase: 5.5, speed: -.13, inclination: .64 },
    { id: 'note-map', name: 'Structure-du-Bureau.pdf', kind: 'file', glyph: '·', extension: 'PDF', size: 684000, color: '#edbe8b', radius: .12, mass: .12, charge: 1, parentId: 'documents', orbit: 1.48, phase: 3.25, speed: .06, inclination: -.6 },
    { id: 'notes-plan', name: 'À explorer.txt', kind: 'file', glyph: '·', extension: 'TXT', size: 4200, color: '#d8d6a4', radius: .105, mass: .06, charge: 1, parentId: 'notes', orbit: .59, phase: 1.08, speed: .14, inclination: .25 },
    { id: 'archive-old', name: 'Anciennes idées.zip', kind: 'file', glyph: '·', extension: 'ZIP', size: 2400000, color: '#dfb78f', radius: .12, mass: .1, charge: -1, parentId: 'archives', orbit: .58, phase: 3.3, speed: -.1, inclination: -.42 },

    { id: 'winmap', name: 'Winmap', kind: 'folder', glyph: '◈', color: '#91baf5', radius: .27, mass: .9, charge: 1, parentId: 'projects', orbit: 1.12, phase: .26, speed: .11, inclination: -.25 },
    { id: 'atelier', name: 'Atelier 3D', kind: 'folder', glyph: '◈', color: '#d7a4e5', radius: .24, mass: .75, charge: -1, parentId: 'projects', orbit: 1.21, phase: 2.15, speed: -.078, inclination: .5 },
    { id: 'experiments', name: 'Expériences', kind: 'folder', glyph: '◈', color: '#85c9d5', radius: .23, mass: .7, charge: 1, parentId: 'projects', orbit: 1.1, phase: 4.3, speed: .09, inclination: -.42 },
    { id: 'readme', name: 'README.md', kind: 'file', glyph: '·', extension: 'MD', size: 8150, color: '#b8d2eb', radius: .11, mass: .07, charge: -1, parentId: 'projects', orbit: 1.44, phase: 5.5, speed: .12, inclination: .55 },
    { id: 'wireframes', name: 'Maquettes', kind: 'folder', glyph: '◈', color: '#a7bdf0', radius: .2, mass: .45, charge: -1, parentId: 'winmap', orbit: .54, phase: .5, speed: .13, inclination: .48 },
    { id: 'source', name: 'Source', kind: 'folder', glyph: '◈', color: '#83b6e8', radius: .2, mass: .45, charge: 1, parentId: 'winmap', orbit: .64, phase: 2.5, speed: -.1, inclination: -.3 },
    { id: 'prototype-file', name: 'Prototype.html', kind: 'file', glyph: '·', extension: 'HTML', size: 36800, color: '#a2c8ee', radius: .11, mass: .08, charge: 1, parentId: 'winmap', orbit: .7, phase: 4.5, speed: .08, inclination: .4 },
    { id: 'scene-01', name: 'Scène-initiale.blend', kind: 'file', glyph: '·', extension: 'BLEND', size: 18700000, color: '#e8b97e', radius: .12, mass: .12, charge: 1, parentId: 'atelier', orbit: .52, phase: 1.1, speed: -.12, inclination: -.4 },

    { id: 'references', name: 'Références', kind: 'folder', glyph: '◈', color: '#db9fc9', radius: .23, mass: .7, charge: -1, parentId: 'images', orbit: 1.03, phase: .35, speed: -.1, inclination: .3 },
    { id: 'textures', name: 'Textures', kind: 'folder', glyph: '◈', color: '#ca9cc3', radius: .22, mass: .65, charge: 1, parentId: 'images', orbit: 1.12, phase: 2.55, speed: .087, inclination: -.5 },
    { id: 'renders', name: 'Rendus', kind: 'folder', glyph: '◈', color: '#e3aecf', radius: .21, mass: .6, charge: -1, parentId: 'images', orbit: 1.18, phase: 4.65, speed: -.08, inclination: .24 },
    { id: 'render-blue', name: 'Nébuleuse-bleue.png', kind: 'file', glyph: '·', extension: 'PNG', size: 2500000, color: '#b7c8ef', radius: .12, mass: .1, charge: 1, parentId: 'renders', orbit: .52, phase: 1.4, speed: .11, inclination: -.55 },

    { id: 'sort-later', name: 'À classer', kind: 'folder', glyph: '◈', color: '#e9a77c', radius: .22, mass: .6, charge: 1, parentId: 'downloads', orbit: .92, phase: .45, speed: .115, inclination: -.32 },
    { id: 'sample-model', name: 'Système-atomique.glb', kind: 'file', glyph: '·', extension: 'GLB', size: 13700000, color: '#d5b0ec', radius: .12, mass: .12, charge: -1, parentId: 'downloads', orbit: 1.2, phase: 2.3, speed: -.08, inclination: .57 },
    { id: 'sample-photo', name: 'Matière-vivante.jpg', kind: 'file', glyph: '·', extension: 'JPG', size: 3430000, color: '#eab695', radius: .11, mass: .09, charge: 1, parentId: 'downloads', orbit: 1.31, phase: 4.25, speed: .13, inclination: -.42 },
    { id: 'quick-note', name: 'Sans-titre.txt', kind: 'file', glyph: '·', extension: 'TXT', size: 860, color: '#d8d6a4', radius: .1, mass: .06, charge: -1, parentId: 'sort-later', orbit: .52, phase: 3.5, speed: -.09, inclination: .3 }
  ];

  const rootState = {
    version: 2,
    nodes: sampleNodes,
    focusId: 'root',
    selectedId: '',
    field: 'magnetic',
    motion: .085,
    camera: { yaw: -.24, pitch: .25, distance: 13.3 },
    timer: { remaining: 25 * 60, running: false, endsAt: 0 },
    connectedRoots: []
  };
  const el = id => document.getElementById(id);
  const canvas = el('space'), nodeLayer = el('nodeLayer');
  const inspector = el('objectInspector'), toastEl = el('toast');
  let state = loadState();
  let engine;
  let nodeIndex = new Map();
  let childIndex = new Map();
  let appsByLink = new Map();
  let generatedPeersByLevel = new Map();
  let sphericalMenuView = 'main';
  let sphericalMenuNodes = [];
  let sphericalMenuNodeIndex = new Map();
  let sphericalMenuRestoreDistance = null;
  let sphericalMenuTriggerId = 'menuButton';
  let labelNodes = new Map();
  let renderedLabelIds = new Set();
  const atomParts = new WeakMap();
  let positions = new Map();
  let visible = [];
  let gesture = null;
  let handMode = true;
  let pointerSeen = false;
  let cameraYawGoal = null, cameraPitchGoal = null;
  let pendingMove = null;
  let pendingExternalDrop = null;
  let externalDropTargetId = '';
  let filePreviewObjectUrl = '';
  let filePreviewGeneration = 0;
  let nativeWindowRequestSequence = 0;
  let nativeWindowLatestRequestId = '';
  let searchIndex = 0;
  let currentQuery = '';
  let createParentId = '';
  let renderedField = '';
  let renderedStatusKey = '';
  let lastCoordinateUpdate = 0;
  let toastTimer = 0;
  let lastSaveClock = 0;
  let cameraSaveTimer = 0;
  let lastFrameTime = 0;
  let frameTimer = 0;
  let animationFramePending = false;
  let animationFrameId = 0;
  let lastShellZoomAt = 0;
  let walkMode = false;
  const walkKeys = new Set();
  let dbPromise = null;
  const rootHandles = new Map();
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const clockTimeFormatter = new Intl.DateTimeFormat('fr-CA', { hour: '2-digit', minute: '2-digit' });
  const clockDateFormatter = new Intl.DateTimeFormat('fr-CA', { weekday: 'short', day: 'numeric', month: 'short' });

  function copy(value) { return JSON.parse(JSON.stringify(value)); }
  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved?.version === 2 && Array.isArray(saved.nodes)) {
        const nodes = [], ids = new Set();
        for (const item of saved.nodes) {
          if (!item || typeof item.id !== 'string' || !item.id || typeof item.name !== 'string' || !item.name || !item.kind || ids.has(item.id)) continue;
          ids.add(item.id); nodes.push(item);
        }
        if (!ids.has('environment')) {
          for (const item of copy(sampleNodes.filter(n => ['environment', 'memory-world', 'studio-world', 'network-world'].includes(n.id)))) {
            if (!ids.has(item.id)) { ids.add(item.id); nodes.push(item); }
          }
          const bureau = nodes.find(n => n.id === 'root');
          if (bureau) { bureau.parentId = 'environment'; bureau.orbit = 4; bureau.phase = .25; }
        }
        for (const item of nodes) {
          if (item.parentId && !ids.has(item.parentId)) item.parentId = item.id === 'root' && ids.has('environment') ? 'environment' : 'root';
          if (!(item.peerLevel === true && item.kind === 'folder' && item.generatedScope && Number(item.scaleDepth) >= 6)) delete item.peerLevel;
          if (item.kind === 'task') {
            item.taskStatus = ['queued', 'running', 'paused', 'completed'].includes(item.taskStatus) ? item.taskStatus : 'queued';
            item.taskProgress = Number.isFinite(Number(item.taskProgress)) ? Math.max(0, Math.min(100, Math.round(Number(item.taskProgress)))) : 0;
            if (item.taskStatus === 'completed') item.taskProgress = 100;
            else if (item.taskProgress === 100) item.taskStatus = 'completed';
          }
        }
        const restored = {
          ...copy(rootState), ...saved, nodes,
          timer: { ...rootState.timer, ...(saved.timer && typeof saved.timer === 'object' ? saved.timer : {}) },
          camera: { ...rootState.camera, ...(saved.camera && typeof saved.camera === 'object' ? saved.camera : {}) },
          connectedRoots: Array.isArray(saved.connectedRoots) ? saved.connectedRoots.filter(root => root && typeof root.id === 'string' && typeof root.name === 'string') : []
        };
        const focused = nodes.find(item => item.id === restored.focusId);
        if (!focused || !['root', 'folder'].includes(focused.kind)) restored.focusId = 'root';
        if (!ids.has(restored.selectedId)) restored.selectedId = '';
        if (!FIELDS[restored.field]) restored.field = rootState.field;
        if (![0, .085, .16].includes(restored.motion)) restored.motion = rootState.motion;
        for (const key of ['yaw', 'pitch', 'distance']) if (typeof restored.camera[key] !== 'number' || !Number.isFinite(restored.camera[key])) restored.camera[key] = rootState.camera[key];
        restored.camera.pitch = Math.max(-1.08, Math.min(1.08, restored.camera.pitch));
        restored.camera.distance = Math.max(6.2, Math.min(25, restored.camera.distance));
        if (typeof restored.timer.remaining !== 'number' || !Number.isFinite(restored.timer.remaining)) restored.timer.remaining = rootState.timer.remaining;
        restored.timer.remaining = Math.max(0, Math.min(25 * 60, restored.timer.remaining));
        restored.timer.running = restored.timer.running === true;
        if (typeof restored.timer.endsAt !== 'number' || !Number.isFinite(restored.timer.endsAt)) restored.timer.endsAt = 0;
        return restored;
      }
    } catch { /* Le navigateur n’autorise pas le stockage sur cette origine. */ }
    return copy(rootState);
  }
  function saveState() {
    const badge = el('saveStatus');
    try {
      if (engine) state.camera = { yaw: engine.camera.yaw, pitch: engine.camera.pitch, distance: engine.camera.distanceGoal };
      const selectedNode = node(state.selectedId);
      const storedState = { ...state, nodes: state.nodes.filter(item => !item.ephemeral), selectedId: selectedNode?.ephemeral ? '' : state.selectedId };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(storedState));
      badge.classList.remove('saving'); badge.innerHTML = '<i></i>ÉTAT LOCAL';
    } catch {
      badge.classList.add('saving'); badge.innerHTML = '<i></i>SESSION';
    }
  }
  function scheduleCameraSave() {
    clearTimeout(cameraSaveTimer);
    cameraSaveTimer = setTimeout(saveState, 450);
  }
  function rebuildIndex() {
    nodeIndex = new Map(state.nodes.map(n => [n.id, n]));
    if (!nodeIndex.has('root')) state.nodes.unshift(copy(sampleNodes.find(n => n.id === 'root')));
    nodeIndex = new Map(state.nodes.map(n => [n.id, n]));
    if (!nodeIndex.has('environment')) {
      state.nodes.unshift(copy(sampleNodes.find(n => n.id === 'environment')));
      const bureau = state.nodes.find(n => n.id === 'root'); if (bureau) bureau.parentId = 'environment';
    }
    const focused = nodeIndex.get(state.focusId);
    if (!focused || !['root', 'folder'].includes(focused.kind)) state.focusId = 'root';
    nodeIndex = new Map(state.nodes.map(n => [n.id, n]));
    if (!nodeIndex.has(state.selectedId)) state.selectedId = '';
    childIndex = new Map();
    appsByLink = new Map();
    generatedPeersByLevel = new Map();
    for (const item of state.nodes) {
      if (item.parentId) {
        let children = childIndex.get(item.parentId);
        if (!children) childIndex.set(item.parentId, children = []);
        children.push(item);
      }
      if (item.kind === 'app') for (const linkId of item.links || []) {
        let apps = appsByLink.get(linkId);
        if (!apps) appsByLink.set(linkId, apps = []);
        apps.push(item);
      }
      if (item.kind === 'folder' && item.generatedScope && item.parentId && Number(item.scaleDepth) >= 5) {
        const key = `${item.parentId}\u0000${item.scaleDepth}`;
        let peers = generatedPeersByLevel.get(key);
        if (!peers) generatedPeersByLevel.set(key, peers = []);
        peers.push(item);
      }
    }
  }
  function node(id) { return nodeIndex.get(id); }
  function childrenOf(id) { return childIndex.get(id) || []; }
  function descendantsOf(id) {
    const found = new Set([id]), queue = [id];
    for (let i = 0; i < queue.length; i++) for (const child of childrenOf(queue[i])) {
      if (found.has(child.id)) continue;
      found.add(child.id); queue.push(child.id);
    }
    return found;
  }
  function kindLabel(n) { return ({ root: 'NOYAU DU BUREAU', folder: 'ATOME · DOSSIER', file: 'ÉLECTRON · FICHIER', app: 'APPLICATION EN ORBITE', widget: 'WIDGET VIVANT', task: 'TÂCHE · SUIVI LOCAL' })[n?.kind] || 'ATOME'; }
  function glyphFor(n) { return n.glyph || ({ folder: '◈', file: '·', app: '⌘', widget: '◷', task: '◴', root: '◉' })[n.kind] || '◌'; }
  function taskProgress(task) { const value = Number(task?.taskProgress); return Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : 0; }
  function taskStatusText(task) { return ({ queued: 'À VENIR', running: 'EN COURS', paused: 'EN PAUSE', completed: 'TERMINÉE' })[task?.taskStatus] || 'À VENIR'; }
  function toggleTask(task) {
    if (!task || task.kind !== 'task') return false;
    if (task.taskStatus === 'completed') { task.taskProgress = 0; task.taskStatus = 'running'; }
    else task.taskStatus = task.taskStatus === 'running' ? 'paused' : 'running';
    return true;
  }
  function advanceTask(task) {
    if (!task || task.kind !== 'task' || task.taskStatus !== 'running') return false;
    task.taskProgress = Math.min(100, taskProgress(task) + 10);
    if (task.taskProgress >= 100) { task.taskProgress = 100; task.taskStatus = 'completed'; }
    return true;
  }
  function esc(text) { return String(text ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]); }
  function slugId(prefix) { return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`; }
  function stableNumber(text) { let h = 2166136261; for (const c of text) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967295; }
  function addScalePattern(parent) {
    const vocabularies = [
      ['Matière', 'Mémoire', 'Énergie', 'Réseau', 'Forme', 'Trace'],
      ['Atelier', 'Archives', 'Courant', 'Noyau', 'Signal', 'Jardin'],
      ['Particule', 'Cellule', 'Structure', 'Mouvement', 'Onde', 'Écho'],
      ['Carbone', 'Lumière', 'Tissu', 'Champ', 'Racine', 'Essaim']
    ];
    const colors = ['#88cfbd', '#a99bff', '#e8b68c', '#8cbbe4', '#db9fc9', '#b7c797'];
    const depth = Math.max(1, Number(parent.scaleDepth) || 1), words = vocabularies[(depth - 1) % vocabularies.length];
    const sharedPeerLevel = depth >= 5, aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
    const peerOrbit = Math.max(2.4, Math.min(5.2, aspect * 3.1));
    const peerPhase = stableNumber(`${parent.id}:peer-phase`) * Math.PI * 2;
    const shift = Math.floor(stableNumber(`${parent.id}:${parent.name}`) * words.length), folderIds = [];
    for (let i = 0; i < 3; i++) {
      const id = slugId('scale-folder'), name = words[(shift + i) % words.length]; folderIds.push(id);
      state.nodes.push({ id, name, kind: 'folder', glyph: '◈', color: colors[(shift + i) % colors.length], radius: .25 + i * .025, mass: .55 + i * .12, charge: i % 2 ? -1 : 1, parentId: parent.id, orbit: sharedPeerLevel ? peerOrbit : 1.05 + i * .54, phase: sharedPeerLevel ? peerPhase + i * Math.PI * 2 / 3 : stableNumber(`${id}:phase`) * Math.PI * 2, speed: sharedPeerLevel ? .012 : (i % 2 ? -1 : 1) * .026, inclination: sharedPeerLevel ? 0 : (i - 1) * .3, peerLevel: sharedPeerLevel, scaleShell: true, scaleDepth: depth + 1, generatedScope: true });
    }
    state.nodes.push(
      { id: slugId('scale-app'), name: 'Moteur de liens', kind: 'app', glyph: '⌘', color: colors[(shift + 3) % colors.length], radius: .23, mass: .42, charge: 1, parentId: parent.id, orbit: 2.6, phase: stableNumber(`${parent.id}:app`) * Math.PI * 2, speed: .018, inclination: .15, running: false, links: folderIds, generatedScope: true },
      { id: slugId('scale-file'), name: `${words[(shift + 3) % words.length].toLowerCase()}-${depth}.dat`, kind: 'file', glyph: '·', extension: 'DAT', size: 0, color: '#d5d9c3', radius: .11, mass: .06, charge: depth % 2 ? 1 : -1, parentId: parent.id, orbit: 3.15, phase: stableNumber(`${parent.id}:file`) * Math.PI * 2, speed: -.021, inclination: -.24, generatedScope: true },
      { id: slugId('scale-widget'), name: 'Résonance locale', kind: 'widget', widgetType: 'field', glyph: '⌁', color: '#8dcdbd', radius: .22, mass: .22, charge: -1, parentId: parent.id, orbit: 3.75, phase: stableNumber(`${parent.id}:widget`) * Math.PI * 2, speed: .014, inclination: .34, generatedScope: true }
    );
    rebuildIndex();
  }
  function ensureScaleChildren(parent) {
    if (parent?.scaleShell && childrenOf(parent.id).length === 0) addScalePattern(parent);
  }
  function createOuterShell(current) {
    const depth = (Number(current.scaleDepth) || 1) + 1;
    const names = ['Écosystème', 'Constellation', 'Tissu vivant', 'Champ d’idées', 'Univers local', 'Matière en mouvement'];
    const shell = { id: slugId('outer-shell'), name: `${names[(depth - 1) % names.length]} · ${depth}`, kind: 'folder', glyph: '◉', color: '#b8c8a8', radius: .53, mass: 4 + depth * .12, charge: 1, parentId: null, orbit: 0, phase: 0, speed: 0, scaleShell: true, scaleDepth: depth, generatedScope: true };
    current.parentId = shell.id; current.orbit = 3.55; current.phase = .3; current.inclination = .2;
    state.nodes.push(shell); rebuildIndex(); addScalePattern(shell);
    return shell;
  }
  function nextImportedOrbit(parentId, id, kind, counts) {
    const index = counts.get(parentId) || 0; counts.set(parentId, index + 1);
    const slot = index % 9, ring = Math.floor(index / 9);
    return {
      orbit: (kind === 'folder' ? 1.02 : .82) + ring * .46 + (slot % 3) * .18,
      phase: (stableNumber(`${parentId}:phase`) * Math.PI * 2 + index * 2.399963229728653) % (Math.PI * 2),
      speed: (index % 2 ? -1 : 1) * (.05 + stableNumber(`${id}:rate`) * .04),
      inclination: ((slot % 5) - 2) * .13 + (stableNumber(`${parentId}:tilt`) - .5) * .16
    };
  }
  function sizeLabel(bytes) {
    if (bytes == null) return 'TAILLE NON LUE';
    if (bytes < 1024) return `${bytes} O`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KO`;
    return `${(bytes / 1048576).toFixed(1)} MO`;
  }
  function showToast(text, duration = 2400) {
    toastEl.textContent = text; toastEl.classList.add('visible'); clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('visible'), duration);
  }
  function setSaveBusy(text = 'ÉCRITURE') { el('saveStatus').classList.add('saving'); el('saveStatus').innerHTML = `<i></i>${esc(text)}`; }
  function spaceMenuOpen() { return !el('spaceMenu').classList.contains('hidden'); }
  function setSphericalMenuView(view) {
    sphericalMenuView = SPACE_MENU_VIEWS[view] ? view : 'main';
    const definition = SPACE_MENU_VIEWS[sphericalMenuView];
    const entries = definition.items.filter(item => !item.nativeOnly || typeof window.chrome?.webview?.postMessage === 'function');
    const core = {
      id: `menu-${sphericalMenuView}-core`, name: definition.coreName, kind: 'menu', glyph: sphericalMenuView === 'main' ? '◉' : '↶',
      color: definition.coreColor, radius: .72, mass: .3, charge: 1,
      menuAction: sphericalMenuView === 'main' ? 'menu-close' : 'menu-main', menuHint: definition.coreHint, menuCore: true
    };
    sphericalMenuNodes = [core, ...entries.map((entry, index) => ({
      id: `menu-${sphericalMenuView}-${entry.action}`, name: entry.action === 'motion' ? `Mouvement · ${state.motion === 0 ? 'repos' : state.motion < .12 ? 'calme' : 'vivant'}` : entry.name,
      kind: 'menu', glyph: entry.glyph, color: entry.color, radius: .4, mass: .2, charge: index % 2 ? -1 : 1,
      menuAction: entry.action, menuHint: entry.hint
    }))];
    sphericalMenuNodeIndex = new Map(sphericalMenuNodes.map(item => [item.id, item]));
    if (spaceMenuOpen()) { wakeFrame(); focusSphericalMenuCore(); }
  }
  function focusSphericalMenuCore() {
    const core = sphericalMenuNodes.find(item => item.menuCore);
    if (!core || !spaceMenuOpen()) return;
    const id = core.id;
    requestAnimationFrame(() => {
      if (spaceMenuOpen() && sphericalMenuNodeIndex.has(id)) labelNodes.get(id)?.focus({ preventScroll: true });
    });
  }
  function openSpaceMenu(view = 'main', triggerId = 'menuButton') {
    if (walkMode) exitWalkMode(false);
    if (!spaceMenuOpen()) { sphericalMenuRestoreDistance = engine.camera.distanceGoal; inspector.classList.add('hidden'); }
    sphericalMenuTriggerId = triggerId === 'settingsButton' ? 'settingsButton' : 'menuButton';
    setSphericalMenuView(view);
    el('spaceMenu').classList.remove('hidden'); el('universe').classList.add('is-menu-open');
    el('menuButton').setAttribute('aria-expanded', String(sphericalMenuTriggerId === 'menuButton'));
    el('settingsButton').setAttribute('aria-expanded', String(sphericalMenuTriggerId === 'settingsButton'));
    el(sphericalMenuTriggerId).setAttribute('aria-label', sphericalMenuTriggerId === 'settingsButton' ? 'Fermer la sphère des réglages' : 'Fermer la sphère de commande');
    const focus = node(state.focusId) || node('root'), target = worldPosition(focus.id, performance.now() / 1000, new Map());
    engine.camera.mode = 'orbit'; engine.camera.targetGoal = [...target]; engine.camera.distanceGoal = 14.5;
    wakeFrame();
    focusSphericalMenuCore();
  }
  function closeSpaceMenu({ restoreCamera = true, focusTrigger = false } = {}) {
    const wasOpen = spaceMenuOpen();
    const returnTriggerId = sphericalMenuTriggerId;
    el('spaceMenu').classList.add('hidden'); el('universe').classList.remove('is-menu-open');
    createParentId = ''; el('menuButton').setAttribute('aria-expanded', 'false'); el('settingsButton').setAttribute('aria-expanded', 'false');
    el('menuButton').setAttribute('aria-label', 'Ouvrir le menu sphérique de l’espace');
    el('settingsButton').setAttribute('aria-label', 'Ouvrir les réglages sphériques en 3D');
    sphericalMenuNodes = []; sphericalMenuNodeIndex.clear();
    if (wasOpen && focusTrigger) requestAnimationFrame(() => el(returnTriggerId)?.focus({ preventScroll: true }));
    sphericalMenuTriggerId = 'menuButton';
    if (wasOpen && restoreCamera && sphericalMenuRestoreDistance != null && !walkMode) {
      engine.camera.distanceGoal = sphericalMenuRestoreDistance;
      scheduleCameraSave();
    }
    sphericalMenuRestoreDistance = null;
    wakeFrame();
  }
  function toggleSphericalMenu(view, triggerId) {
    if (!spaceMenuOpen()) { openSpaceMenu(view, triggerId); return; }
    if (sphericalMenuTriggerId === triggerId) { closeSpaceMenu(); return; }
    openSpaceMenu(view, triggerId);
  }
  function sphericalMenuRadius() {
    const distance = Math.max(6, engine.camera.distanceGoal), halfHeight = distance * Math.tan(engine.camera.fov * Math.PI / 360);
    const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
    return Math.max(1.35, Math.min(3.35, halfHeight * .53, halfHeight * aspect * .43));
  }
  function sphericalMenuPosition(index, count, center, radius, seconds, spin = .028) {
    if (!count) return [...center];
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    const latitude = Math.acos(1 - 2 * (index + .5) / count), longitude = index * goldenAngle + seconds * spin;
    const planar = Math.sin(latitude) * radius;
    return [center[0] + Math.cos(longitude) * planar, center[1] + Math.cos(latitude) * radius, center[2] + Math.sin(longitude) * planar];
  }
  function activateSphericalMenuAction(action, { keyboard = false } = {}) {
    if (action === 'menu-close') { closeSpaceMenu({ focusTrigger: keyboard }); return; }
    if (action === 'menu-main') { setSphericalMenuView('main'); return; }
    if (action === 'explore') { setSphericalMenuView('explore'); return; }
    if (action === 'settings') { setSphericalMenuView('settings'); return; }
    if (action === 'fields') { setSphericalMenuView('fields'); return; }
    if (action === 'create') { createParentId = state.focusId; setSphericalMenuView('create'); return; }
    if (action === 'search') { closeSpaceMenu(); showSearch(); return; }
    if (action === 'connect') { closeSpaceMenu(); el('connectDialog').showModal(); return; }
    if (action === 'walk') { closeSpaceMenu({ restoreCamera: false }); enterWalkMode(); return; }
    if (action === 'zoom-out') { closeSpaceMenu({ restoreCamera: false }); zoomOutScope(); return; }
    if (action === 'home') { closeSpaceMenu({ restoreCamera: false }); goRoot(); return; }
    if (action === 'windows') { requestNativeWindows(); return; }
    if (action === 'close') { const webview = window.chrome?.webview; closeSpaceMenu({ restoreCamera: false }); webview?.postMessage?.('close'); return; }
    if (action === 'motion') {
      const options = [.085, .16, 0], current = options.findIndex(value => Math.abs(value - state.motion) < .01);
      state.motion = options[(current + 1) % options.length];
      const movement = sphericalMenuNodes.find(item => item.menuAction === 'motion');
      if (movement) movement.name = `Mouvement · ${state.motion === 0 ? 'repos' : state.motion < .12 ? 'calme' : 'vivant'}`;
      saveState(); showToast(state.motion === 0 ? 'Les orbites se reposent.' : state.motion < .12 ? 'Mouvement calme.' : 'Mouvement vivant.'); return;
    }
    if (action?.startsWith('field-')) {
      const field = action.slice('field-'.length);
      if (!FIELDS[field]) return;
      state.field = field; saveState(); closeSpaceMenu(); showToast(FIELD_EXPLANATIONS[field], 4200); return;
    }
    if (action?.startsWith('create-')) {
      const kind = action.slice('create-'.length), parentId = createParentId || state.focusId;
      closeSpaceMenu(); openCreate(kind, parentId); return;
    }
  }

  function worldPosition(id, seconds, cache = new Map()) {
    if (cache.has(id)) return cache.get(id);
    const chain = [], seen = new Set();
    let current = node(id), base = [0, 0, 0];
    while (current) {
      if (cache.has(current.id)) { base = cache.get(current.id); break; }
      if (gesture?.id === current.id && gesture.world) { base = gesture.world; cache.set(current.id, base); break; }
      if (seen.has(current.id)) { base = [0, 0, 0]; break; }
      seen.add(current.id);
      if (!current.parentId) { cache.set(current.id, base); break; }
      chain.push(current);
      current = node(current.parentId);
    }
    const motion = reduceMotion.matches ? 0 : state.motion;
    for (let i = chain.length - 1; i >= 0; i--) {
      const item = chain[i], angle = (item.phase || 0) + seconds * (item.speed || 0) * motion;
      const r = Math.max(.25, Number(item.orbit) || .8), tilt = Number(item.inclination) || 0;
      const x = Math.cos(angle) * r, z = Math.sin(angle) * r;
      const verticalWave = item.peerLevel ? 0 : Math.sin(angle * .68 + (item.phase || 0)) * r * .1;
      const offset = [x, verticalWave + (Number(item.lift) || 0) + z * Math.sin(tilt), z * Math.cos(tilt)];
      base = [base[0] + offset[0], base[1] + offset[1], base[2] + offset[2]];
      cache.set(item.id, base);
    }
    return cache.get(id) || base;
  }
  function sameLevelEcosystems(focus) {
    if (!focus?.generatedScope || !focus.parentId || Number(focus.scaleDepth) < 5) return [];
    return generatedPeersByLevel.get(`${focus.parentId}\u0000${focus.scaleDepth}`) || [];
  }
  function cameraAnchor(focus) {
    const peers = sameLevelEcosystems(focus);
    return peers.length > 1 ? node(focus.parentId) || focus : focus;
  }
  function visibleNodes() {
    const focus = node(state.focusId) || node('root');
    const visible = new Map([[focus.id, focus]]);
    const add = item => { if (item) visible.set(item.id, item); };
    const peers = sameLevelEcosystems(focus), peerView = peers.length > 1;
    if (peerView) { add(node(focus.parentId)); peers.forEach(add); }
    const direct = childrenOf(focus.id);
    direct.forEach(add);
    const apps = new Map();
    for (const scope of peerView ? peers : [focus]) for (const app of appsByLink.get(scope.id) || []) apps.set(app.id, app);
    for (const item of direct) if (item.kind === 'app') apps.set(item.id, item);
    for (const app of apps.values()) {
      add(app);
      for (const linkId of app.links || []) add(node(linkId));
    }
    return [...visible.values()];
  }
  function kindSize(n, childCount = childrenOf(n.id).length) {
    if (n.kind === 'root') return 72;
    if (n.kind === 'folder') return 43 + Math.min(9, childCount * 1.1);
    if (n.kind === 'app') return 36;
    if (n.kind === 'widget') return 34;
    if (n.kind === 'task') return 32;
    if (n.kind === 'menu') {
      const compact = canvas.clientWidth <= 760;
      return n.menuCore ? (compact ? 66 : 78) : (compact ? 50 : 58);
    }
    return 23;
  }
  function screenPosition(id) {
    const p = positions.get(id); return p && engine ? engine.project(p) : null;
  }

  function makeAtomElement(n) {
    let value;
    if (n.kind === 'widget') {
      value = document.createElement('article'); value.className = 'atom-label kind-widget';
      value.innerHTML = `<div class="widget-card" style="--atom-color:${esc(n.color)}"><div class="widget-top"><i></i><span>${esc(n.name.toUpperCase())}</span></div><div class="widget-value" data-widget-value="${esc(n.id)}"></div><div class="widget-sub" data-widget-sub="${esc(n.id)}"></div><button data-widget-action="${n.widgetType === 'focus' ? 'timer' : 'inspect'}" data-widget-id="${esc(n.id)}">${n.widgetType === 'focus' ? 'DÉMARRER' : 'OUVRIR'}</button></div>`;
    } else {
      value = document.createElement('button'); value.type = 'button';
      value.className = `atom-label kind-${esc(n.kind)}${n.menuCore ? ' menu-core' : ''}${n.kind === 'root' ? ' root-atom' : ''}`;
      value.innerHTML = `<span class="atom-cap" style="--atom-color:${esc(n.color)}">${esc(glyphFor(n))}</span><span class="atom-name">${esc(n.name)}</span><span class="atom-meta">${esc(atomMeta(n))}</span>`;
    }
    value.dataset.nodeId = n.id;
    atomParts.set(value, {
      cap: value.querySelector('.atom-cap'),
      name: value.querySelector('.atom-name'),
      meta: value.querySelector('.atom-meta'),
      widgetCard: value.querySelector('.widget-card'),
      widgetName: value.querySelector('.widget-top span'),
      widgetValue: value.querySelector('.widget-value'),
      widgetSub: value.querySelector('.widget-sub'),
      widgetButton: value.querySelector('[data-widget-id]')
    });
    value.addEventListener('click', event => {
      if (n.kind === 'menu') { event.stopPropagation(); activateSphericalMenuAction(n.menuAction, { keyboard: event.detail === 0 }); return; }
      onAtomClick(event, n.id);
    });
    value.addEventListener('dblclick', event => { if (n.kind !== 'menu') { event.preventDefault(); enterNode(n.id); } });
    value.addEventListener('pointerdown', event => { if (n.kind === 'menu') { event.stopPropagation(); return; } onAtomPointerDown(event, n.id); });
    return value;
  }
  function atomMeta(n, childCount = childrenOf(n.id).length) {
    if (n.kind === 'folder' || n.kind === 'root') return `${childCount} LIENS · ${n.charge > 0 ? '+' : '−'}`;
    if (n.kind === 'file') return `${n.extension || 'FICHIER'} · ${n.charge > 0 ? '+' : '−'}`;
    if (n.kind === 'app') return `${n.running ? 'ACTIVE' : 'EN VEILLE'} · ${n.links?.length || 0} LIENS`;
    if (n.kind === 'task') return `${taskProgress(n)}% · ${taskStatusText(n)}`;
    if (n.kind === 'menu') return n.menuHint || 'CHOISIR CETTE SPHÈRE';
    return 'EN RÉSONANCE';
  }
  function ensureAtom(n) {
    let atom = labelNodes.get(n.id);
    if (!atom || (n.kind === 'widget') !== atom.classList.contains('kind-widget')) {
      atom?.remove(); atom = makeAtomElement(n); labelNodes.set(n.id, atom); nodeLayer.append(atom);
    }
    return atom;
  }
  function sphericalMenuPointIsBehind(point, center, eye, radius) {
    const ex = eye[0] - center[0], ey = eye[1] - center[1], ez = eye[2] - center[2];
    const scale = 1 / (Math.sqrt(ex * ex + ey * ey + ez * ez) * Math.max(.001, radius));
    return ((point[0] - center[0]) * ex + (point[1] - center[1]) * ey + (point[2] - center[2]) * ez) * scale < -.045;
  }
  function renderLabels(seconds, visibleItems, menuSphere = null) {
    visible = visibleItems;
    const menuEye = menuSphere ? engine.matrices?.eye : null;
    const alive = new Set(visible.map(n => n.id));
    for (const id of renderedLabelIds) if (!alive.has(id)) {
      labelNodes.get(id)?.remove();
      labelNodes.delete(id);
    }
    renderedLabelIds = alive;
    const childCounts = new Map(visible.map(n => [n.id, childrenOf(n.id).length]));
    const focus = node(state.focusId) || node('root');
    for (const n of visible) {
      const atom = ensureAtom(n), p = screenPosition(n.id);
      const parts = atomParts.get(atom) || {};
      atom.classList.remove('hidden');
      if (menuSphere && n.id === state.focusId) { atom.classList.add('hidden'); continue; }
      const selected = String(state.selectedId === n.id);
      if (atom.dataset.renderedSelected !== selected) {
        atom.classList.toggle('selected', selected === 'true');
        atom.dataset.renderedSelected = selected;
      }
      if (n.kind === 'menu') {
        atom.classList.toggle('active', n.menuAction === `field-${state.field}`);
        atom.title = `${n.name} · ${n.menuHint || ''}`;
        atom.setAttribute('aria-label', `${n.name}. ${n.menuHint || ''}`.trim());
        let behind = false;
        const point = positions.get(n.id);
        if (menuSphere && menuEye && point) behind = sphericalMenuPointIsBehind(point, menuSphere.center, menuEye, menuSphere.radius);
        atom.classList.toggle('behind-menu-sphere', behind);
        atom.setAttribute('aria-hidden', String(behind));
        atom.tabIndex = behind ? -1 : 0;
        if (behind) { atom.style.opacity = '0'; continue; }
      }
      const color = n.color || '#81d8c4';
      if (atom.dataset.renderedColor !== color) {
        atom.style.setProperty('--atom-color', color);
        parts.cap?.style.setProperty('--atom-color', color);
        parts.widgetCard?.style.setProperty('--atom-color', color);
        atom.dataset.renderedColor = color;
      }
      const visibleName = n.kind === 'widget' ? n.name.toUpperCase() : n.name;
      const nameElement = n.kind === 'widget' ? parts.widgetName : parts.name;
      if (nameElement && nameElement.textContent !== visibleName) nameElement.textContent = visibleName;
      if (!p || p.x < -80 || p.x > canvas.clientWidth + 80 || p.y < -80 || p.y > canvas.clientHeight + 80) { atom.style.opacity = '.08'; continue; }
      atom.style.opacity = String(Math.min(1, Math.max(.48, 1.1 - p.depth * .022)));
      atom.style.left = `${p.x}px`; atom.style.top = `${p.y}px`;
      atom.style.zIndex = String(Math.round(200 - p.depth * 4));
      atom.style.transform = `translate(-50%, -50%) scale(${Math.max(.64, Math.min(1.18, 12 / p.depth))})`;
      const nodeSize = String(kindSize(n, childCounts.get(n.id) || 0));
      if (parts.cap && atom.dataset.renderedNodeSize !== nodeSize) {
        parts.cap.style.setProperty('--node-size', `${nodeSize}px`);
        atom.dataset.renderedNodeSize = nodeSize;
      }
      if (n.kind === 'task') {
        const progress = `${taskProgress(n)}%`;
        if (atom.dataset.renderedTaskProgress !== progress) { atom.style.setProperty('--task-progress', progress); atom.dataset.renderedTaskProgress = progress; }
      }
      if (parts.meta) { const text = atomMeta(n, childCounts.get(n.id) || 0); if (parts.meta.textContent !== text) parts.meta.textContent = text; }
      if (n.kind === 'widget') updateWidget(atom, n, seconds, parts);
    }
    renderStatus(focus);
  }
  function updateWidget(atom, n, seconds, parts) {
    const value = parts.widgetValue, sub = parts.widgetSub, button = parts.widgetButton;
    if (!value || !sub) return;
    if (n.widgetType === 'clock') {
      const minute = String(Math.floor(Date.now() / 60000));
      if (atom.dataset.widgetMinute !== minute) {
        atom.dataset.widgetMinute = minute;
        const now = new Date();
        value.textContent = clockTimeFormatter.format(now);
        sub.textContent = clockDateFormatter.format(now);
      }
    } else if (n.widgetType === 'focus') {
      const remaining = formatTime(timerRemaining()), caption = state.timer.running ? 'PÉRIODE DE CONCENTRATION' : 'MINUTERIE PERSONNELLE';
      if (value.textContent !== remaining) value.textContent = remaining;
      if (sub.textContent !== caption) sub.textContent = caption;
      const action = state.timer.running ? 'PAUSE' : 'DÉMARRER';
      if (button && button.textContent !== action) button.textContent = action;
    } else {
      const count = `${state.nodes.length} atomes`;
      if (value.textContent !== count) value.textContent = count;
      if (sub.textContent !== 'STRUCTURE LOCALE · SANS TÉLÉMÉTRIE') sub.textContent = 'STRUCTURE LOCALE · SANS TÉLÉMÉTRIE';
    }
  }
  function renderStatus(focus) {
    const total = Math.max(0, visible.filter(item => item.kind !== 'menu').length - 1);
    const peerCount = sameLevelEcosystems(focus).length;
    const statusKey = [focus.id, focus.name, total, peerCount, state.field, state.motion, reduceMotion.matches, walkMode, state.nodes.length].join('|');
    if (statusKey !== renderedStatusKey) {
      el('objectCount').textContent = `${String(total).padStart(2, '0')} OBJETS EN ORBITE`;
      const isRoot = focus.id === 'root';
      el('sceneTitle').textContent = isRoot ? 'Le Bureau' : focus.name;
      el('sceneSubtitle').textContent = peerCount > 1 ? `${peerCount} écosystèmes voisins · glisse pour tourner en 360°.` : focus.generatedScope ? 'Coquille conceptuelle · rien n’est écrit sur le disque.' : isRoot ? 'Un monde à manipuler.' : `${total} objets liés · glisse pour réorganiser.`;
      el('spaceCode').textContent = focus.scaleShell ? `ÉCHELLE ${String(focus.scaleDepth || 1).padStart(2, '0')}` : isRoot ? 'BUREAU · 00' : `ESPACE ${String(Math.max(1, state.nodes.indexOf(focus))).padStart(2, '0')}`;
      el('spaceMode').textContent = focus.generatedScope ? 'COQUILLE GÉNÉRATIVE' : focus.sourceRootId ? focus.readOnlyPreview ? 'APERÇU LOCAL' : 'DOSSIER CONNECTÉ' : 'ESPACE LOCAL';
      if (walkMode) el('walkTitle').textContent = `VEILLE · ${focus.name.toUpperCase()}`;
      renderedStatusKey = statusKey;
    }
    const read = node(state.selectedId) || focus, p = positions.get(read.id) || [0, 0, 0];
    const now = performance.now();
    if (now - lastCoordinateUpdate >= 120) {
      el('coordinateReadout').innerHTML = `X ${p[0].toFixed(2)}&nbsp;&nbsp; Y ${p[1].toFixed(2)}&nbsp;&nbsp; Z ${p[2].toFixed(2)}`;
      lastCoordinateUpdate = now;
    }
    updateBreadcrumb(focus);
  }
  function updateBreadcrumb(focus) {
    const path = [], seen = new Set(); let current = focus;
    while (current && !seen.has(current.id)) { seen.add(current.id); path.unshift(current); current = node(current.parentId); }
    const key = path.map(n => `${n.id}:${n.name}`).join('/');
    const breadcrumb = el('breadcrumb');
    if (breadcrumb.dataset.pathKey === key) return;
    breadcrumb.dataset.pathKey = key;
    breadcrumb.innerHTML = path.map((n, i) => `${i ? '<i>›</i>' : ''}<button class="${i === path.length - 1 ? 'current' : ''}" data-breadcrumb="${esc(n.id)}">${esc(n.name)}</button>`).join('');
  }

  function renderInspector(id) {
    const n = node(id);
    if (!n) { inspector.classList.add('hidden'); return; }
    inspector.classList.remove('hidden'); inspector.style.setProperty('--atom-color', n.color || '#81d8c4');
    el('inspectorClass').textContent = kindLabel(n);
    el('inspectorGlyph').textContent = glyphFor(n);
    el('inspectorName').textContent = n.name;
    const kids = childrenOf(n.id), parent = node(n.parentId);
    let description = '';
    if (n.scaleShell) description = `Coquille conceptuelle · ${kids.length} éléments liés · modèle local seulement`;
    else if (n.generatedScope) description = 'Objet de démonstration · aucune application ou fichier réel n’est ouvert';
    else if (n.kind === 'root' || n.kind === 'folder') description = `${n.sourceRootId ? 'Dossier local' : 'Dossier spatial'} · ${kids.length} éléments liés`;
    else if (n.kind === 'file') description = `${n.extension || 'Fichier'} · ${sizeLabel(n.size)}`;
    else if (n.kind === 'app') description = n.nativeWindowHandle ? `Fenêtre Windows ouverte · ${n.application || 'application locale'}` : n.nativeAppName ? `Application Windows liée · ${n.nativeAppName}` : `${n.running ? 'En activité' : 'En veille'} · représentation d’application`;
    else if (n.kind === 'task') description = `Tâche locale · ${taskStatusText(n).toLocaleLowerCase('fr-CA')} · progression manuelle, aucun processus externe`;
    else description = n.widgetType === 'focus' ? 'Minuterie active sur cet appareil' : 'Widget local, sans service distant';
    el('inspectorDescription').textContent = description;
    const chips = [];
    if (parent) chips.push(`DANS ${parent.name.toUpperCase()}`);
    if (n.kind === 'folder' || n.kind === 'root') chips.push(`${kids.length} ATOMES ENFANTS`);
    if (n.generatedScope) chips.push(n.scaleShell ? 'COQUILLE · AUCUN DOSSIER WINDOWS' : 'DÉMO · SANS ÉCRITURE DISQUE');
    if (n.kind === 'app' && n.links?.length) chips.push(`${n.links.length} LIAISONS`);
    if (n.nativeWindowHandle) chips.push('FENÊTRE TEMPORAIRE · NON ENREGISTRÉE');
    if (n.sourceRootId) chips.push(n.readOnlyPreview ? 'APERÇU · MODÈLE SEULEMENT' : 'ACCÈS LOCAL EXPLICITE');
    if (n.kind === 'file' && n.size != null) chips.push(sizeLabel(n.size));
    if (n.kind === 'task') { chips.push(`${taskProgress(n)}% TERMINÉ`); chips.push('SUIVI LOCAL · MANUEL'); }
    el('inspectorData').innerHTML = chips.map(x => `<span class="data-chip">${esc(x)}</span>`).join('');
    el('inspectorRelations').textContent = window.OrbitRelations.describe(n, state.nodes);
    el('inspectorActions').innerHTML = actionsFor(n).map(a => `<button data-action="${esc(a.action)}" class="${a.primary ? 'primary-action' : ''}" ${a.disabled ? 'disabled title="${esc(a.disabled)}"' : ''}><span>${esc(a.glyph || '↗')}</span>${esc(a.label)}</button>`).join('');
  }
  function actionsFor(n) {
    if (n.kind === 'root') return [{ action: 'enter', label: 'Explorer cet espace', glyph: '◎', primary: true }, { action: 'create', label: 'Ajouter un atome', glyph: '＋' }];
    if (n.kind === 'folder') {
      const actions = [{ action: 'enter', label: 'Explorer cet espace', glyph: '◎', primary: true }, { action: 'create', label: 'Créer ici', glyph: '＋' }];
      if (n.externalRoot && n.sourceRootId && !n.readOnlyPreview) actions.push({ action: 'refresh-root', label: 'Actualiser depuis le disque', glyph: '↻' });
      actions.push({ action: 'rename', label: 'Renommer', glyph: '✎', disabled: n.sourceRootId && !n.readOnlyPreview ? 'Le renommage réel sera confirmé dans une prochaine étape.' : '' });
      return actions;
    }
    if (n.kind === 'task') return [
      { action: 'toggle-task', label: n.taskStatus === 'running' ? 'Mettre en pause' : n.taskStatus === 'completed' ? 'Recommencer' : 'Démarrer la tâche', glyph: n.taskStatus === 'running' ? 'Ⅱ' : '▷', primary: true },
      { action: 'advance-task', label: 'Avancer de 10 %', glyph: '＋', disabled: n.taskStatus !== 'running' ? 'Démarre la tâche avant de modifier sa progression.' : '' },
      { action: 'rename', label: 'Renommer', glyph: '✎' }
    ];
    if (n.kind === 'app' && n.nativeWindowHandle) return [{ action: 'focus-window', label: 'Mettre la fenêtre au premier plan', glyph: '▣', primary: true }, { action: 'link-app', label: 'Lier au focus', glyph: '⌁' }];
    if (n.kind === 'app') return [
      { action: n.nativeAppName ? 'launch-app' : 'choose-app', label: n.nativeAppName ? `Ouvrir ${n.nativeAppName}` : 'Choisir une application', glyph: n.nativeAppName ? '▷' : '＋', primary: true },
      ...(n.nativeAppName ? [{ action: 'choose-app', label: 'Changer l’application', glyph: '↻' }] : []),
      { action: 'link-app', label: 'Lier au focus', glyph: '⌁' }
    ];
    if (n.kind === 'widget' && n.widgetType === 'focus') return [{ action: 'toggle-timer', label: state.timer.running ? 'Mettre en pause' : 'Démarrer le foyer', glyph: state.timer.running ? 'Ⅱ' : '▷', primary: true }, { action: 'reset-timer', label: 'Réinitialiser', glyph: '⟲' }];
    if (n.kind === 'widget') return [{ action: 'inspect-widget', label: 'Garder dans l’espace', glyph: '◉', primary: true }];
    if (n.kind === 'file') return [{ action: 'open-file', label: 'Ouvrir l’aperçu', glyph: '◉', primary: true }, { action: 'show-parent', label: 'Voir le dossier parent', glyph: '↖' }, { action: 'rename', label: 'Renommer', glyph: '✎', disabled: n.sourceRootId && !n.readOnlyPreview ? 'Les écritures réelles restent désactivées hors d’un déplacement confirmé.' : '' }];
    return [{ action: 'show-parent', label: 'Voir le dossier parent', glyph: '↖', primary: true }, { action: 'rename', label: 'Renommer', glyph: '✎', disabled: n.sourceRootId && !n.readOnlyPreview ? 'Les écritures réelles restent désactivées hors d’un déplacement confirmé.' : '' }];
  }

  function clearFilePreview() {
    filePreviewGeneration++;
    if (filePreviewObjectUrl) URL.revokeObjectURL(filePreviewObjectUrl);
    filePreviewObjectUrl = '';
    const image = el('filePreviewImage'); image.onload = null; image.onerror = null; image.removeAttribute('src'); image.classList.add('hidden');
    el('filePreviewText').textContent = ''; el('filePreviewText').classList.add('hidden');
  }
  async function openFilePreview(fileNode) {
    throw new Error('Les fichiers locaux ne sont pas accessibles dans cette version.');
    if (!fileNode || fileNode.kind !== 'file') return;
    const generation = ++filePreviewGeneration;
    if (filePreviewObjectUrl) URL.revokeObjectURL(filePreviewObjectUrl);
    filePreviewObjectUrl = '';
    const image = el('filePreviewImage'), text = el('filePreviewText'), stateText = el('filePreviewState'), dialog = el('filePreviewDialog');
    image.onload = null; image.onerror = null; image.removeAttribute('src'); image.classList.add('hidden');
    text.textContent = ''; text.classList.add('hidden'); stateText.classList.remove('hidden');
    el('filePreviewTitle').textContent = fileNode.name;
    el('filePreviewMeta').textContent = `${(fileNode.extension || 'FICHIER').toUpperCase()} · ${sizeLabel(fileNode.size)}`;
    stateText.textContent = 'Lecture locale en cours…';
    if (!dialog.open) dialog.showModal();
    const isCurrent = () => generation === filePreviewGeneration;
    if (!fileNode.sourceRootId || fileNode.readOnlyPreview) {
      stateText.textContent = 'Aucun fichier physique n’est associé à cet atome. Connecte le dossier original pour en lire le contenu.';
      return;
    }
    const rootHandle = rootHandles.get(fileNode.sourceRootId);
    if (!rootHandle || !fileNode.relativePath) {
      stateText.textContent = 'Le dossier n’est pas connecté dans cette session. Reconnecte-le pour ouvrir cet aperçu.';
      return;
    }
    try {
      let permission = typeof rootHandle.queryPermission === 'function' ? await rootHandle.queryPermission({ mode: 'read' }) : 'granted';
      if (!isCurrent()) return;
      if (permission !== 'granted') permission = typeof rootHandle.requestPermission === 'function' ? await rootHandle.requestPermission({ mode: 'read' }) : 'denied';
      if (!isCurrent()) return;
      if (permission !== 'granted') { stateText.textContent = 'Permission de lecture refusée. Le disque n’a pas été modifié.'; return; }
      const resolved = await resolvePath(rootHandle, fileNode.relativePath);
      if (!isCurrent()) return;
      if (resolved.entry.kind !== 'file') { stateText.textContent = 'Cet élément n’est plus un fichier. Actualise le dossier connecté.'; return; }
      const file = await resolved.entry.getFile();
      if (!isCurrent()) return;
      const extension = String(fileNode.name).split('.').pop().toLowerCase();
      el('filePreviewMeta').textContent = `${(file.type || fileNode.extension || 'FICHIER').toUpperCase()} · ${sizeLabel(file.size)}`;
      if (TEXT_PREVIEW_EXTENSIONS.has(extension)) {
        const preview = await file.slice(0, MAX_FILE_PREVIEW_BYTES).text();
        if (!isCurrent()) return;
        text.textContent = preview;
        text.classList.remove('hidden'); stateText.classList.toggle('hidden', file.size <= MAX_FILE_PREVIEW_BYTES);
        stateText.textContent = `Aperçu texte en lecture seule${file.size > MAX_FILE_PREVIEW_BYTES ? ' · contenu limité aux 512 premiers KO' : ''}.`;
        return;
      }
      if (IMAGE_PREVIEW_TYPES.has(file.type) && file.size <= MAX_IMAGE_PREVIEW_BYTES) {
        const objectUrl = URL.createObjectURL(file);
        if (!isCurrent()) { URL.revokeObjectURL(objectUrl); return; }
        filePreviewObjectUrl = objectUrl;
        image.onload = () => { if (isCurrent()) stateText.classList.add('hidden'); };
        image.onerror = () => { if (isCurrent()) { image.classList.add('hidden'); stateText.classList.remove('hidden'); stateText.textContent = 'Le navigateur n’a pas pu décoder cette image.'; } };
        image.src = objectUrl; image.classList.remove('hidden');
        return;
      }
      stateText.textContent = file.size > MAX_IMAGE_PREVIEW_BYTES
        ? 'Fichier trop volumineux pour l’aperçu local.'
        : 'Aperçu intégré disponible pour les images et petits fichiers texte. Le contenu de cet autre format reste intact.';
    } catch (error) {
      console.error(error);
      if (isCurrent()) stateText.textContent = error?.name === 'NotFoundError'
        ? 'Ce fichier n’existe plus à cet emplacement. Actualise le dossier connecté.'
        : 'Impossible de lire ce fichier avec la permission actuelle.';
    }
  }
  function onNativeWindowMessage(event) {
    const message = event.data;
    if (!message || typeof message !== 'object') return;
    if (message.type === 'registered-apps') {
      const registered = new Map();
      for (const item of (Array.isArray(message.apps) ? message.apps : []).slice(0, 256)) {
        const id = String(item?.nodeId || ''), app = node(id);
        const name = String(item?.name || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 64);
        if (app?.kind !== 'app' || app.nativeWindowHandle || !name) continue;
        app.nativeAppName = name; registered.set(id, name);
      }
      for (const app of state.nodes) if (app.kind === 'app' && !app.nativeWindowHandle && !registered.has(app.id)) delete app.nativeAppName;
      if (state.selectedId && node(state.selectedId)?.kind === 'app') renderInspector(state.selectedId);
      saveState();
      return;
    }
    if (message.type === 'app-choice-result') {
      const app = node(String(message.nodeId || ''));
      if (app?.kind !== 'app' || app.nativeWindowHandle) return;
      if (message.success) {
        app.nativeAppName = String(message.name || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 64);
        if (!app.nativeAppName) return;
        saveState(); renderInspector(app.id); showToast(`« ${app.name} » est maintenant lié à « ${app.nativeAppName} ».`);
      } else if (!message.cancelled) showToast('Le programme n’a pas pu être associé.');
      return;
    }
    if (message.type === 'app-launch-result') {
      if (message.success) showToast(`« ${String(message.name || 'Application').slice(0, 64)} » a été lancé dans Windows.`, 3200);
      else if (!message.cancelled) showToast('Windows n’a pas pu lancer ce programme. Vérifie son emplacement ou associe un autre exécutable.');
      return;
    }
    if (message.type === 'windows') {
      if (message.requestId !== nativeWindowLatestRequestId) return;
      const activeWindows = Array.isArray(message.windows) ? message.windows.slice(0, MAX_NATIVE_WINDOWS * 2) : [];
      const previousSelectedId = state.selectedId;
      state.nodes = state.nodes.filter(item => !item.ephemeral);
      const focus = node(state.focusId) || node('root'), handles = new Set(), palette = ['#83c7d8', '#a99bff', '#e0a97e', '#91b9ec', '#d69fc7', '#a8c497'];
      let added = 0;
      for (const item of activeWindows) {
        const handle = String(item?.windowHandle ?? '');
        if (!/^\d+$/.test(handle) || handles.has(handle)) continue;
        const application = String(item.application || 'Application Windows').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 64);
        const title = String(item.title || application).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 96);
        if (!title) continue;
        handles.add(handle);
        const id = `native-window-${handle}`, phase = stableNumber(handle) * Math.PI * 2;
        state.nodes.push({ id, name: title, kind: 'app', glyph: '▣', color: palette[Math.floor(stableNumber(application) * palette.length)], radius: .25, mass: .58, charge: added % 2 ? -1 : 1, parentId: 'root', orbit: 2.5 + (added % 8) * .34, phase, speed: added % 2 ? -.048 : .048, inclination: ((added % 5) - 2) * .16, running: true, links: [focus.id], nativeWindowHandle: handle, nativeProcessId: Number.isInteger(Number(item.processId)) ? Number(item.processId) : 0, application, ephemeral: true });
        added++;
        if (added >= MAX_NATIVE_WINDOWS) break;
      }
      rebuildIndex();
      if (previousSelectedId && node(previousSelectedId)) renderInspector(previousSelectedId);
      else { state.selectedId = ''; inspector.classList.add('hidden'); }
      saveState();
      showToast(`${added} fenêtre${added === 1 ? '' : 's'} d’application ajoutée${added === 1 ? '' : 's'} à l’espace courant. Les titres restent en mémoire vive seulement.`, 3800);
      return;
    }
    if (message.type === 'focus-result') showToast(message.success ? 'La fenêtre Windows est au premier plan.' : 'Windows n’a pas pu remettre cette fenêtre au premier plan. Actualise la liste.');
  }
  function requestNativeWindows() {
    const webview = window.chrome?.webview;
    if (!webview || typeof webview.postMessage !== 'function') { showToast('La lecture des fenêtres est disponible dans l’hôte Windows natif.'); return; }
    nativeWindowLatestRequestId = `windows-${++nativeWindowRequestSequence}`;
    webview.postMessage({ type: 'list-windows', requestId: nativeWindowLatestRequestId });
    showToast('Lecture locale des fenêtres Windows…');
  }
  function requestNativeWindowFocus(appNode) {
    const webview = window.chrome?.webview;
    if (!appNode?.nativeWindowHandle || !webview || typeof webview.postMessage !== 'function') { showToast('Cette fenêtre Windows n’est plus disponible. Actualise la liste.'); return; }
    webview.postMessage({ type: 'focus-window', windowHandle: appNode.nativeWindowHandle });
  }
  function requestNativeAppChoice(appNode) {
    const webview = window.chrome?.webview;
    if (!appNode || appNode.kind !== 'app' || appNode.nativeWindowHandle) return;
    if (!webview || typeof webview.postMessage !== 'function') { showToast('Associer une application Windows est disponible dans l’hôte natif.'); return; }
    webview.postMessage({ type: 'choose-app', nodeId: appNode.id });
    showToast('Choisis le fichier .exe de cette application Windows.');
  }
  function requestNativeAppLaunch(appNode) {
    const webview = window.chrome?.webview;
    if (!appNode || appNode.kind !== 'app' || appNode.nativeWindowHandle) return;
    if (!appNode.nativeAppName) { requestNativeAppChoice(appNode); return; }
    if (!webview || typeof webview.postMessage !== 'function') { showToast('Le lancement d’applications Windows est disponible dans l’hôte natif.'); return; }
    webview.postMessage({ type: 'launch-app', nodeId: appNode.id });
  }

  function createNode(kind, name, color, parentId = state.focusId) {
    const parent = node(parentId) || node(state.focusId) || node('root');
    const index = childrenOf(parent.id).length;
    const id = slugId(kind);
    const shapes = {
      folder: { glyph: '◈', radius: .26, mass: .7, orbit: .95, charge: index % 2 ? -1 : 1 },
      file: { glyph: '·', radius: .11, mass: .08, orbit: 1.3, charge: index % 2 ? 1 : -1 },
      app: { glyph: '⌘', radius: .24, mass: .55, orbit: 2.9, charge: 1, running: false, links: [] },
      widget: { glyph: '◷', radius: .23, mass: .25, orbit: 5.55, charge: -1, widgetType: state.nodes.some(x => x.widgetType === 'focus') ? 'field' : 'focus' },
      task: { glyph: '◴', radius: .24, mass: .34, orbit: 2.8, charge: 1, taskStatus: 'queued', taskProgress: 0 }
    };
    const shape = shapes[kind] || shapes.file;
    const item = { id, name, kind, color, parentId: parent.kind === 'folder' || parent.kind === 'root' ? parent.id : 'root', phase: ((index * 2.399) % (Math.PI * 2)), speed: (index % 2 ? -1 : 1) * (.065 + Math.random() * .035), inclination: (Math.random() - .5) * .65, size: 0, ...shape };
    if (kind === 'app') item.appType = 'application représentée';
    if (kind === 'file') { item.extension = name.includes('.') ? name.split('.').pop().toUpperCase().slice(0, 5) : 'OBJ'; item.size = 0; }
    state.nodes.push(item); rebuildIndex(); state.selectedId = id; saveState(); renderInspector(id); showToast(`« ${name} » rejoint l’orbite.`);
  }
  function enterNode(id) {
    const n = node(id); if (!n || !['root', 'folder'].includes(n.kind)) return;
    if (walkMode) exitWalkMode(false);
    ensureScaleChildren(n);
    rebuildIndex();
    state.focusId = n.id; state.selectedId = n.id;
    const anchor = cameraAnchor(n), pos = worldPosition(anchor.id, performance.now() / 1000, new Map());
    engine.camera.mode = 'orbit'; engine.camera.targetGoal = [...pos]; engine.camera.distanceGoal = scopeDistance(n);
    saveState(); renderInspector(n.id);
  }
  function scopeDistance(n) { if (sameLevelEcosystems(n).length > 1) return 15.5; return n?.id === 'root' ? 13.3 : n?.id === 'environment' || n?.generatedScope && n.parentId == null ? 15.5 : 8.2; }
  function goRoot() { enterNode('root'); engine.camera.distanceGoal = 13.3; saveState(); }
  function selectNode(id) { if (!node(id)) return; state.selectedId = id; renderInspector(id); }
  function zoomOutScope() {
    const focus = node(state.focusId) || node('root'); if (!focus) return;
    if (walkMode) exitWalkMode(false);
    if (focus.parentId) enterNode(focus.parentId);
    else { const outer = createOuterShell(focus); enterNode(outer.id); }
    showToast(`Tu remontes vers « ${node(state.focusId)?.name || 'l’espace'} ».`);
  }
  function activateNode(id) {
    const n = node(id); if (!n) return;
    if (walkMode) exitWalkMode(false);
    selectNode(id);
  }
  function enterWalkMode() {
    const focus = node(state.focusId) || node('root'); if (!focus || !engine) return;
    walkMode = true; walkKeys.clear();
    engine.camera.mode = 'walk'; engine.camera.position = [...(positions.get(focus.id) || worldPosition(focus.id, performance.now() / 1000, new Map()))];
    engine.camera.pitch = Math.max(-.85, Math.min(.85, engine.camera.pitch));
    closeSpaceMenu();
    el('walkHud').classList.remove('hidden'); el('universe').classList.add('is-walking');
    renderStatus(focus); showToast(`Mode veille : tu explores depuis l’intérieur de « ${focus.name} ».`);
  }
  function exitWalkMode(notify = true) {
    if (!walkMode) return;
    walkMode = false; walkKeys.clear(); engine.camera.mode = 'orbit';
    const focus = node(state.focusId) || node('root'), position = positions.get(focus.id) || [0, 0, 0];
    const anchor = cameraAnchor(focus), target = positions.get(anchor?.id) || position;
    engine.camera.targetGoal = [...target]; engine.camera.distanceGoal = scopeDistance(focus);
    el('walkHud').classList.add('hidden'); el('universe').classList.remove('is-walking');
    scheduleCameraSave(); if (notify) showToast('Retour à la vue orbitale.');
  }
  function updateWalkMovement(deltaSeconds) {
    if (!walkMode || !walkKeys.size) return;
    const basis = engine.cameraBasis(), speed = 3.2 * Math.min(.06, deltaSeconds);
    let x = 0, y = 0, z = 0;
    if (walkKeys.has('w')) { x += basis.forward[0]; y += basis.forward[1]; z += basis.forward[2]; }
    if (walkKeys.has('s')) { x -= basis.forward[0]; y -= basis.forward[1]; z -= basis.forward[2]; }
    if (walkKeys.has('d')) { x += basis.right[0]; z += basis.right[2]; }
    if (walkKeys.has('a')) { x -= basis.right[0]; z -= basis.right[2]; }
    if (walkKeys.has('e')) y += 1;
    if (walkKeys.has('q')) y -= 1;
    const length = Math.hypot(x, y, z) || 1, camera = engine.camera;
    camera.position[0] += x / length * speed; camera.position[1] += y / length * speed; camera.position[2] += z / length * speed;
  }
  function canDrop(source, target) {
    return source && target && source.id !== target.id && ['root', 'folder'].includes(target.kind) && !descendantsOf(source.id).has(target.id) && source.parentId !== target.id;
  }
  function prepareMove(sourceId, targetId) {
    const source = node(sourceId), target = node(targetId); if (!canDrop(source, target)) return false;
    pendingExternalDrop = null;
    const real = Boolean(source.sourceRootId && source.sourceRootId === target.sourceRootId && !source.readOnlyPreview && source.relativePath && rootHandles.has(source.sourceRootId));
    pendingMove = { sourceId, targetId, real, newName: '' };
    el('moveSourceGlyph').textContent = glyphFor(source); el('moveTargetGlyph').textContent = glyphFor(target);
    el('moveTitle').textContent = `Déplacer « ${source.name} » ?`;
    el('moveDescription').textContent = `De ${node(source.parentId)?.name || 'Bureau'} vers ${target.name}. Les positions et les liens seront recalculés.`;
    el('moveModeNote').innerHTML = real
      ? '<span>◉</span><div><strong>Déplacement réel sur le disque</strong><small>Cette confirmation déclenche la demande d’accès en écriture. Winmap copie et vérifie avant de retirer la source; si la copie échoue, l’original reste en place.</small></div>'
      : `<span>◌</span><div><strong>Réorganisation de l’espace</strong><small>${source.sourceRootId ? 'Aucun handle d’écriture n’est disponible pour cette source.' : 'Le disque n’est pas modifié dans cette démonstration.'} Seule la hiérarchie de Winmap changera.</small></div>`;
    el('confirmMoveButton').innerHTML = real ? 'DÉPLACER SUR LE DISQUE <span>↗</span>' : 'CONFIRMER LE LIEN <span>↗</span>';
    el('moveDialog').showModal(); return true;
  }
  function moveInModel(sourceId, targetId) {
    const source = node(sourceId), target = node(targetId); if (!canDrop(source, target)) return false;
    source.parentId = target.id;
    delete source.peerLevel;
    const siblings = childrenOf(target.id).filter(n => n.id !== source.id).length;
    source.orbit = Math.max(.65, Math.min(1.55, .76 + siblings * .075));
    source.phase = ((siblings + 1) * 2.399) % (Math.PI * 2);
    source.speed = (siblings % 2 ? -1 : 1) * .085;
    source.inclination = ((siblings % 4) - 1.5) * .18;
    rebuildIndex(); saveState();
    showToast(`« ${source.name} » résonne maintenant dans « ${target.name} ».`);
    return true;
  }
  async function confirmMove() {
    if (pendingExternalDrop) {
      const externalDrop = pendingExternalDrop; pendingExternalDrop = null; pendingMove = null;
      el('moveDialog').close();
      await copyExternalDropToDestination(externalDrop);
      return;
    }
    const move = pendingMove; if (!move) return;
    const source = node(move.sourceId), target = node(move.targetId);
    if (!source || !target) { el('moveDialog').close(); return; }
    el('moveDialog').close(); pendingMove = null;
    if (!move.real) { moveInModel(source.id, target.id); return; }
    setSaveBusy('TRANSFERT');
    try {
      await moveOnDisk(source, target);
    } catch (error) {
      console.error(error);
      try { await refreshImportedRoot(source.sourceRootId); saveState(); } catch (refreshError) { console.error(refreshError); }
      showToast(error?.message || 'Le déplacement n’a pas abouti; la source est conservée et une copie partielle peut rester à destination.', 5000);
      el('saveStatus').classList.remove('saving'); el('saveStatus').innerHTML = '<i></i>ÉTAT LOCAL';
      return;
    }
    try {
      await refreshImportedRoot(source.sourceRootId);
      saveState();
      showToast(`Déplacement réel terminé : « ${source.name} » est dans « ${target.name} ».`, 3600);
    } catch (error) {
      console.error(error);
      el('saveStatus').classList.remove('saving'); el('saveStatus').innerHTML = '<i></i>ÉTAT LOCAL';
      showToast('Le déplacement est terminé sur le disque, mais la carte n’a pas pu être actualisée. Reconnecte le dossier pour la synchroniser.', 5200);
    }
  }
  async function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(DB_STORE)) request.result.createObjectStore(DB_STORE); };
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    return dbPromise;
  }
  async function storeRootHandle(id, handle) {
    const db = await openDb();
    await new Promise((resolve, reject) => { const tx = db.transaction(DB_STORE, 'readwrite'); tx.objectStore(DB_STORE).put(handle, id); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
  }
  async function retrieveRootHandle(id) {
    const db = await openDb();
    return new Promise((resolve, reject) => { const tx = db.transaction(DB_STORE, 'readonly'), req = tx.objectStore(DB_STORE).get(id); req.onsuccess = () => resolve(req.result || null); req.onerror = () => reject(req.error); });
  }
  async function restoreConnectedHandles() {
    return; // Aucune restauration de dossiers réels dans ORBIT.
    let refreshed = false;
    for (const root of state.connectedRoots || []) {
      try {
        const handle = await retrieveRootHandle(root.id); if (!handle) continue;
        rootHandles.set(root.id, handle);
        if (typeof handle.queryPermission === 'function' && await handle.queryPermission({ mode: 'read' }) === 'granted') {
          await refreshImportedRoot(root.id); refreshed = true;
        }
      }
      catch { /* Les données locales restent visibles sans accès réautorisé. */ }
    }
    if (refreshed) saveState();
  }
  async function refreshConnectedRoot(rootId) {
    throw new Error('Les dossiers locaux ne sont pas accessibles dans cette version.');
    const handle = rootHandles.get(rootId) || await retrieveRootHandle(rootId);
    if (!handle) { showToast('Reconnecte ce dossier pour actualiser sa structure.'); return; }
    if (typeof handle.requestPermission !== 'function' || await handle.requestPermission({ mode: 'read' }) !== 'granted') {
      showToast('Permission de lecture refusée; la carte locale reste inchangée.'); return;
    }
    rootHandles.set(rootId, handle);
    await refreshImportedRoot(rootId); saveState();
    const count = state.nodes.filter(item => item.sourceRootId === rootId && item.id !== rootId).length;
    showToast(`« ${node(rootId)?.name || 'Dossier connecté'} » actualisé · ${count} éléments lus.`, 3200);
  }
  async function getDirectoryAt(rootHandle, relativePath) {
    let current = rootHandle;
    for (const part of (relativePath || '').split('/').filter(Boolean)) current = await current.getDirectoryHandle(part);
    return current;
  }
  async function resolvePath(rootHandle, relativePath) {
    const parts = (relativePath || '').split('/').filter(Boolean);
    if (!parts.length) return { entry: rootHandle, parent: null, name: rootHandle.name };
    const name = parts.pop(), parentPath = parts.join('/'), parent = await getDirectoryAt(rootHandle, parentPath);
    let entry;
    try { entry = await parent.getFileHandle(name); } catch (error) { if (error.name !== 'TypeMismatchError') throw error; entry = await parent.getDirectoryHandle(name); }
    return { entry, parent, name };
  }
  async function entryExists(directory, name) {
    try { await directory.getFileHandle(name); return true; } catch (error) { if (error.name !== 'NotFoundError' && error.name !== 'TypeMismatchError') throw error; }
    try { await directory.getDirectoryHandle(name); return true; } catch (error) { if (error.name !== 'NotFoundError' && error.name !== 'TypeMismatchError') throw error; }
    return false;
  }
  async function copyEntry(sourceHandle, destinationParent, newName, stats, depth = 0) {
    throw new Error('Les copies sur disque sont désactivées dans cette version.');
    if (depth > 24) throw new Error('Le dossier contient trop de niveaux imbriqués pour un déplacement sûr.');
    if (sourceHandle.kind === 'file') {
      const file = await sourceHandle.getFile(), target = await destinationParent.getFileHandle(newName, { create: true });
      const writable = await target.createWritable({ keepExistingData: false });
      try { await writable.write(file); await writable.close(); } catch (error) { try { await writable.abort(); } catch {} throw error; }
      stats.files++; stats.bytes += file.size;
      return;
    }
    const targetDirectory = await destinationParent.getDirectoryHandle(newName, { create: true });
    for await (const child of sourceHandle.values()) {
      if (await entryExists(targetDirectory, child.name)) throw new Error(`« ${child.name} » existe déjà dans la destination; rien n’a été remplacé.`);
      await copyEntry(child, targetDirectory, child.name, stats, depth + 1);
      if (stats.files % 20 === 0) { setSaveBusy(`${stats.files} FICHIERS`); await new Promise(resolve => requestAnimationFrame(resolve)); }
    }
  }
  async function sameFileContents(source, destination) {
    if (source.size !== destination.size) return false;
    const chunkSize = 1024 * 1024;
    for (let offset = 0; offset < source.size; offset += chunkSize) {
      const [a, b] = await Promise.all([source.slice(offset, offset + chunkSize).arrayBuffer(), destination.slice(offset, offset + chunkSize).arrayBuffer()]);
      const left = new Uint8Array(a), right = new Uint8Array(b);
      for (let i = 0; i < left.length; i++) if (left[i] !== right[i]) return false;
    }
    return true;
  }
  async function sameEntryTree(source, destination, depth = 0) {
    if (depth > 24 || source.kind !== destination.kind) return false;
    if (source.kind === 'file') return sameFileContents(await source.getFile(), await destination.getFile());
    const collect = async directory => {
      const entries = [];
      for await (const entry of directory.values()) entries.push(entry);
      return entries.sort((a, b) => a.name.localeCompare(b.name));
    };
    const [sourceEntries, destinationEntries] = await Promise.all([collect(source), collect(destination)]);
    if (sourceEntries.length !== destinationEntries.length) return false;
    for (let i = 0; i < sourceEntries.length; i++) {
      const sourceEntry = sourceEntries[i], destinationEntry = destinationEntries[i];
      if (sourceEntry.name !== destinationEntry.name || sourceEntry.kind !== destinationEntry.kind || !(await sameEntryTree(sourceEntry, destinationEntry, depth + 1))) return false;
    }
    return true;
  }
  async function moveOnDisk(source, target) {
    throw new Error('Les déplacements sur disque sont désactivés dans cette version.');
    const rootHandle = rootHandles.get(source.sourceRootId);
    if (!rootHandle) throw new Error('Il faut reconnecter le dossier racine pour autoriser ce déplacement.');
    const permission = await rootHandle.requestPermission({ mode: 'readwrite' });
    if (permission !== 'granted') throw new Error('Permission d’écriture refusée; aucun élément n’a été déplacé.');
    const src = await resolvePath(rootHandle, source.relativePath);
    const destination = await getDirectoryAt(rootHandle, target.relativePath || '');
    if (!src.parent) throw new Error('Le dossier racine connecté ne peut pas être déplacé à l’intérieur de lui-même.');
    if (source.kind === 'folder' && (target.relativePath === source.relativePath || target.relativePath.startsWith(`${source.relativePath}/`))) throw new Error('Un dossier ne peut pas entrer dans son propre sous-dossier.');
    if (await entryExists(destination, src.name)) throw new Error(`« ${src.name} » existe déjà dans « ${target.name} »; le contenu ne sera pas remplacé.`);
    const stats = { files: 0, bytes: 0 };
    try {
      setSaveBusy('COPIE DE SÉCURITÉ');
      await copyEntry(src.entry, destination, src.name, stats);
      setSaveBusy('VÉRIFICATION FINALE');
      const copiedEntry = src.entry.kind === 'file' ? await destination.getFileHandle(src.name) : await destination.getDirectoryHandle(src.name);
      if (!(await sameEntryTree(src.entry, copiedEntry))) throw new Error('La source ou la copie a changé pendant le transfert; la vérification complète a échoué.');
    } catch (error) {
      throw new Error(`${error?.message || 'La copie a échoué.'} L’original est conservé; une copie partielle peut rester dans la destination.`);
    }
    setSaveBusy('COPIE VÉRIFIÉE');
    try { await src.parent.removeEntry(src.name, { recursive: source.kind === 'folder' }); }
    catch { throw new Error(`La copie de « ${src.name} » est vérifiée, mais Windows n’a pas retiré la source. Les deux exemplaires sont conservés; reconnecte le dossier pour actualiser la carte.`); }
  }

  async function importDirectoryHandle(handle) {
    throw new Error('Les dossiers locaux ne sont pas accessibles dans cette version.');
    for (const connected of state.connectedRoots || []) {
      let previous = rootHandles.get(connected.id);
      if (!previous) { try { previous = await retrieveRootHandle(connected.id); } catch {} }
      if (!previous || typeof handle.isSameEntry !== 'function' || !await handle.isSameEntry(previous)) continue;
      const wrapper = node(connected.id);
      if (!wrapper || !['root', 'folder'].includes(wrapper.kind)) continue;
      rootHandles.set(connected.id, handle); await storeRootHandle(connected.id, handle);
      wrapper.name = handle.name; connected.name = handle.name;
      await refreshImportedRoot(connected.id);
      state.focusId = connected.id; state.selectedId = connected.id;
      engine.camera.targetGoal = worldPosition(connected.id, performance.now() / 1000); engine.camera.distanceGoal = scopeDistance(node(connected.id));
      saveState(); renderInspector(connected.id);
      showToast(`« ${handle.name} » était déjà relié; sa structure est actualisée.`, 3600);
      return;
    }
    const rootId = slugId('local');
    await storeRootHandle(rootId, handle); rootHandles.set(rootId, handle);
    const wrapper = { id: rootId, name: handle.name, kind: 'folder', glyph: '◈', color: '#7bd0bb', radius: .31, mass: 1.1, charge: 1, parentId: 'root', orbit: 4.9, phase: 5.85, speed: -.035, inclination: -.18, sourceRootId: rootId, relativePath: '', externalRoot: true, readOnlyPreview: false };
    state.nodes.push(wrapper); state.connectedRoots.push({ id: rootId, name: handle.name });
    const budget = { count: 0, truncated: false, orbitCounts: new Map() };
    await scanDirectory(handle, rootId, rootId, '', 0, budget);
    rebuildIndex(); state.focusId = rootId; state.selectedId = rootId; engine.camera.targetGoal = worldPosition(rootId, performance.now() / 1000); engine.camera.distanceGoal = 8.2;
    saveState(); renderInspector(rootId);
    showToast(budget.truncated ? `Structure lue · ${budget.count} objets montrés; le reste est hors aperçu.` : `« ${handle.name} » entre dans l’espace. Rien n’a été téléversé.`, 3600);
  }
  async function scanDirectory(handle, rootId, parentId, relativePath, depth, budget) {
    if (budget.count >= MAX_IMPORTED_NODES) { budget.truncated = true; return; }
    if (depth > MAX_IMPORTED_DEPTH) { budget.truncated = true; return; }
    let entries = [];
    try {
      const remaining = Math.max(0, MAX_IMPORTED_NODES - budget.count);
      for await (const item of handle.values()) { if (entries.length >= remaining) { budget.truncated = true; break; } entries.push(item); }
    }
    catch { budget.truncated = true; return; }
    entries.sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'directory' ? -1 : 1));
    for (const entry of entries) {
      if (budget.count >= MAX_IMPORTED_NODES) { budget.truncated = true; break; }
      if (['System Volume Information', '$RECYCLE.BIN', 'Recovery'].includes(entry.name)) continue;
      const path = relativePath ? `${relativePath}/${entry.name}` : entry.name;
      const id = `${rootId}::${path}`;
      const kind = entry.kind === 'directory' ? 'folder' : 'file';
      const orbital = nextImportedOrbit(parentId, id, kind, budget.orbitCounts);
      let metadata = {};
      if (entry.kind === 'file') { try { const file = await entry.getFile(); metadata = { size: file.size, lastModified: file.lastModified }; } catch {} }
      const item = {
        id, name: entry.name, kind, glyph: entry.kind === 'directory' ? '◈' : '·',
        color: entry.kind === 'directory' ? '#83d0bb' : fileColor(entry.name), radius: entry.kind === 'directory' ? .23 : .105,
        mass: entry.kind === 'directory' ? .5 : .06, charge: stableNumber(id) > .5 ? 1 : -1,
        parentId, sourceRootId: rootId, relativePath: path, readOnlyPreview: false,
        ...orbital,
        extension: entry.kind === 'file' && entry.name.includes('.') ? entry.name.split('.').pop().toUpperCase().slice(0, 5) : '', ...metadata
      };
      state.nodes.push(item); budget.count++;
      if (entry.kind === 'directory' && depth < MAX_IMPORTED_DEPTH) await scanDirectory(entry, rootId, id, path, depth + 1, budget);
      else if (entry.kind === 'directory' && depth >= MAX_IMPORTED_DEPTH) budget.truncated = true;
    }
  }
  function fileColor(name) {
    const ext = name.includes('.') ? name.split('.').pop().toLowerCase() : '';
    if (['png', 'jpg', 'jpeg', 'svg', 'webp', 'blend', 'glb'].includes(ext)) return '#d5a9d2';
    if (['txt', 'md', 'doc', 'docx', 'pdf'].includes(ext)) return '#8dc8d5';
    if (['js', 'ts', 'css', 'html', 'json', 'py', 'cs'].includes(ext)) return '#8eafea';
    if (['zip', '7z', 'rar'].includes(ext)) return '#e4b283';
    return '#b5cfc9';
  }
  async function importFromFallback(files) {
    throw new Error('Les dossiers locaux ne sont pas accessibles dans cette version.');
    if (!files?.length) return;
    const firstPath = files[0].webkitRelativePath || files[0].name, rootName = firstPath.split('/')[0] || 'Dossier importé', rootId = slugId('preview');
    state.nodes.push({ id: rootId, name: rootName, kind: 'folder', glyph: '◈', color: '#7bd0bb', radius: .31, mass: 1.1, charge: 1, parentId: 'root', orbit: 4.9, phase: 5.85, speed: -.035, inclination: -.18, sourceRootId: rootId, relativePath: '', externalRoot: true, readOnlyPreview: true });
    const folders = new Map([['', rootId]]), orbitCounts = new Map(); let count = 0, truncated = files.length > MAX_IMPORTED_NODES;
    fileLoop: for (const file of Array.from(files)) {
      if (count >= MAX_IMPORTED_NODES) { truncated = true; break; }
      const path = file.webkitRelativePath || `${rootName}/${file.name}`;
      const parts = path.split('/').filter(Boolean); if (parts[0] === rootName) parts.shift();
      const fileName = parts.pop(); let parentPath = '';
      if (parts.length > MAX_IMPORTED_DEPTH) { truncated = true; continue; }
      for (const part of parts) {
        parentPath = parentPath ? `${parentPath}/${part}` : part;
        if (!folders.has(parentPath)) {
          if (count >= MAX_IMPORTED_NODES) { truncated = true; break fileLoop; }
          const id = `${rootId}::${parentPath}`;
          const folderParent = folders.get(parentPath.split('/').slice(0, -1).join('/')) || rootId;
          const orbital = nextImportedOrbit(folderParent, id, 'folder', orbitCounts);
          state.nodes.push({ id, name: part, kind: 'folder', glyph: '◈', color: '#83d0bb', radius: .22, mass: .4, charge: 1, parentId: folderParent, sourceRootId: rootId, relativePath: parentPath, readOnlyPreview: true, ...orbital }); folders.set(parentPath, id); count++;
        }
      }
      if (count >= MAX_IMPORTED_NODES) { truncated = true; break; }
      const relative = parts.concat(fileName).join('/'), id = `${rootId}::${relative}`;
      const fileParent = folders.get(parentPath) || rootId;
      const orbital = nextImportedOrbit(fileParent, id, 'file', orbitCounts);
      state.nodes.push({ id, name: fileName, kind: 'file', glyph: '·', extension: fileName.includes('.') ? fileName.split('.').pop().toUpperCase().slice(0, 5) : 'OBJ', size: file.size, color: fileColor(fileName), radius: .105, mass: .06, charge: stableNumber(id) > .5 ? 1 : -1, parentId: fileParent, sourceRootId: rootId, relativePath: relative, readOnlyPreview: true, ...orbital }); count++;
    }
    state.connectedRoots.push({ id: rootId, name: rootName, preview: true }); rebuildIndex(); state.focusId = rootId; state.selectedId = rootId;
    engine.camera.targetGoal = worldPosition(rootId, performance.now() / 1000); engine.camera.distanceGoal = 8.2; saveState(); renderInspector(rootId);
    showToast(`Aperçu de « ${rootName} » · ${count} objets${truncated ? ' · aperçu limité à 220 objets et 5 niveaux' : ''} · aucune écriture sur le disque.`, 4200);
  }
  function canExternalDrop(target) {
    return Boolean(target && ['root', 'folder'].includes(target.kind) && target.sourceRootId && !target.readOnlyPreview && rootHandles.has(target.sourceRootId));
  }
  function findExternalDropTarget(clientX, clientY) {
    const rect = canvas.getBoundingClientRect(); let best = '', distance = 64;
    for (const target of visible) {
      if (!canExternalDrop(target)) continue;
      const point = engine.project(positions.get(target.id)); if (!point) continue;
      const nextDistance = Math.hypot(point.x + rect.left - clientX, point.y + rect.top - clientY);
      if (nextDistance < distance) { distance = nextDistance; best = target.id; }
    }
    return best;
  }
  function hasExternalFiles(dataTransfer) {
    if (!dataTransfer) return false;
    if (Array.from(dataTransfer.items || []).some(item => item.kind === 'file')) return true;
    return Array.from(dataTransfer.types || []).includes('Files') || Boolean(dataTransfer.files?.length);
  }
  function updateExternalDrop(event) {
    if (!hasExternalFiles(event.dataTransfer)) return;
    event.preventDefault();
    externalDropTargetId = findExternalDropTarget(event.clientX, event.clientY);
    for (const atom of nodeLayer.querySelectorAll('.atom-label')) atom.classList.toggle('drop-target', atom.dataset.nodeId === externalDropTargetId);
    el('dropPrompt').classList.remove('hidden');
    el('dropPromptText').textContent = externalDropTargetId
      ? `Relâcher pour copier dans « ${node(externalDropTargetId)?.name || 'ce dossier'} »`
      : 'Relâcher au-dessus d’un dossier Windows connecté';
    try { event.dataTransfer.dropEffect = externalDropTargetId ? 'copy' : 'none'; } catch {}
  }
  function clearExternalDrop() {
    externalDropTargetId = '';
    for (const atom of nodeLayer.querySelectorAll('.atom-label')) atom.classList.remove('drop-target');
    el('dropPrompt').classList.add('hidden');
  }
  function droppedEntryHandle(entry) {
    if (entry.isDirectory) {
      return {
        kind: 'directory', name: entry.name,
        async *values() {
          const reader = entry.createReader();
          while (true) {
            const batch = await new Promise((resolve, reject) => reader.readEntries(resolve, reject));
            if (!batch.length) break;
            for (const child of batch) yield droppedEntryHandle(child);
          }
        }
      };
    }
    return { kind: 'file', name: entry.name, getFile: () => new Promise((resolve, reject) => entry.file(resolve, reject)) };
  }
  function droppedFileHandle(file) { return { kind: 'file', name: file.name, getFile: async () => file }; }
  function collectExternalHandles(dataTransfer) {
    const items = Array.from(dataTransfer?.items || []).filter(item => item.kind === 'file').slice(0, 8);
    if (!items.length) return Promise.resolve(Array.from(dataTransfer?.files || []).slice(0, 8).map(droppedFileHandle));
    const records = items.map(item => {
      let handlePromise = null, legacyEntry = null, file = null;
      try { if (typeof item.getAsFileSystemHandle === 'function') handlePromise = item.getAsFileSystemHandle(); } catch {}
      try { if (typeof item.webkitGetAsEntry === 'function') legacyEntry = item.webkitGetAsEntry(); } catch {}
      try { file = item.getAsFile?.() || null; } catch {}
      return { handlePromise, legacyEntry, file };
    });
    return Promise.all(records.map(async record => {
      try { const handle = await record.handlePromise; if (handle) return handle; } catch {}
      if (record.legacyEntry) return droppedEntryHandle(record.legacyEntry);
      return record.file ? droppedFileHandle(record.file) : null;
    })).then(handles => handles.filter(Boolean));
  }
  async function finishExternalDrop(handlesPromise, targetId) {
    throw new Error('Les fichiers locaux ne sont pas accessibles dans cette version.');
    if (!targetId) { await handlesPromise; showToast('Connecte un dossier Windows, puis dépose l’élément sur ce dossier dans Winmap.'); return; }
    let handles;
    try { handles = await handlesPromise; }
    catch (error) { console.error(error); showToast('Windows n’a pas transmis cet élément. Essaie « Connecter un dossier ».'); return; }
    if (!handles.length) { showToast('Ce dépôt n’est pas lisible ici. Essaie de connecter le dossier depuis le menu Espace.'); return; }
    if (handles.some(handle => !handle.name || !['file', 'directory'].includes(handle.kind))) { showToast('Un des éléments déposés n’est pas un fichier ou un dossier pris en charge.'); return; }
    const target = node(targetId);
    if (!canExternalDrop(target)) { showToast('La destination doit être un dossier Windows connecté avec un accès local disponible.'); return; }
    const names = handles.map(handle => handle.name.toLocaleLowerCase('fr-CA'));
    if (new Set(names).size !== names.length) { showToast('Les éléments déposés portent des noms identiques; aucune copie n’a été lancée.'); return; }
    pendingMove = null;
    pendingExternalDrop = { handles, targetId };
    el('moveSourceGlyph').textContent = handles.length === 1 ? '⇣' : `${handles.length}`;
    el('moveTargetGlyph').textContent = glyphFor(target);
    el('moveTitle').textContent = handles.length === 1 ? `Copier « ${handles[0].name} » ?` : `Copier ${handles.length} éléments ?`;
    el('moveDescription').textContent = `Destination : ${target.name}. L’original Windows restera à sa place.`;
    el('moveModeNote').innerHTML = '<span>◉</span><div><strong>Copie vérifiée vers le disque</strong><small>Après ta confirmation, Winmap demandera l’accès en écriture, copiera puis vérifiera chaque élément. Les originaux restent intacts.</small></div>';
    el('confirmMoveButton').innerHTML = 'COPIER DANS CE DOSSIER <span>↗</span>';
    el('moveDialog').showModal();
  }
  async function copyExternalDropToDestination(request) {
    throw new Error('Les copies sur disque sont désactivées dans cette version.');
    const target = node(request.targetId);
    if (!canExternalDrop(target)) { showToast('La destination n’est plus disponible; aucune écriture n’a été faite.'); return; }
    const rootHandle = rootHandles.get(target.sourceRootId);
    try {
      if (typeof rootHandle.requestPermission !== 'function' || await rootHandle.requestPermission({ mode: 'readwrite' }) !== 'granted') {
        showToast('Permission d’écriture refusée; les éléments déposés et la destination n’ont pas changé.'); return;
      }
      const stats = { files: 0, bytes: 0 };
      setSaveBusy('COPIE DE WINDOWS');
      const destination = await getDirectoryAt(rootHandle, target.relativePath || '');
      for (const handle of request.handles) {
        if (await entryExists(destination, handle.name)) throw new Error(`« ${handle.name} » existe déjà dans « ${target.name} »; rien n’a été remplacé.`);
      }
      for (const handle of request.handles) await copyEntry(handle, destination, handle.name, stats);
      setSaveBusy('VÉRIFICATION FINALE');
      for (const handle of request.handles) {
        const copied = handle.kind === 'file' ? await destination.getFileHandle(handle.name) : await destination.getDirectoryHandle(handle.name);
        if (!(await sameEntryTree(handle, copied))) throw new Error(`La copie de « ${handle.name} » ne correspond pas à sa source.`);
      }
      await refreshImportedRoot(target.sourceRootId); saveState();
      showToast(`${request.handles.length} élément${request.handles.length === 1 ? '' : 's'} copié${request.handles.length === 1 ? '' : 's'} et vérifié${request.handles.length === 1 ? '' : 's'} dans « ${target.name} »; les originaux sont conservés.`, 4800);
    } catch (error) {
      console.error(error);
      try { await refreshImportedRoot(target.sourceRootId); saveState(); } catch (refreshError) { console.error(refreshError); }
      showToast(`${error?.message || 'La copie a échoué.'} Les originaux restent en place; une copie partielle peut rester dans la destination.`, 6000);
    } finally {
      el('saveStatus').classList.remove('saving'); el('saveStatus').innerHTML = '<i></i>ÉTAT LOCAL';
    }
  }
  async function refreshImportedRoot(rootId) {
    const wrapper = node(rootId), handle = rootHandles.get(rootId); if (!wrapper || !handle) return;
    const previousFocusId = state.focusId, previousSelectedId = state.selectedId;
    const inspectorWasOpen = !inspector.classList.contains('hidden');
    const previousDistance = engine.camera.distanceGoal;
    state.nodes = state.nodes.filter(n => n.id === 'root' || n.id === rootId || n.sourceRootId !== rootId);
    const budget = { count: 0, truncated: false, orbitCounts: new Map() };
    await scanDirectory(handle, rootId, rootId, '', 0, budget); rebuildIndex();
    const previousFocus = node(previousFocusId);
    state.focusId = previousFocus && ['root', 'folder'].includes(previousFocus.kind) ? previousFocusId : rootId;
    state.selectedId = node(previousSelectedId) ? previousSelectedId : '';
    if (inspectorWasOpen && state.selectedId) renderInspector(state.selectedId);
    else inspector.classList.add('hidden');
    engine.camera.targetGoal = worldPosition(state.focusId, performance.now() / 1000, new Map());
    engine.camera.distanceGoal = previousFocus ? previousDistance : scopeDistance(node(rootId));
  }

  function openCreate(kind, parentId = state.focusId) {
    const settings = { folder: ['◈', 'NOUVEAU DOSSIER', 'Nommer le dossier.'], file: ['·', 'NOUVEL ATOME LIBRE', 'Nommer le fichier.'], app: ['⌘', 'APPLICATION EN ORBITE', 'Nommer l’application.'], widget: ['◷', 'WIDGET VIVANT', 'Nommer le widget.'], task: ['◴', 'TÂCHE LOCALE', 'Nommer la tâche.'] }[kind];
    if (!settings) return;
    el('createGlyph').textContent = settings[0]; el('createKind').textContent = settings[1]; el('createTitle').textContent = settings[2];
    el('createName').value = ''; el('createDialog').dataset.kind = kind; el('createDialog').dataset.parentId = parentId; el('createDialog').showModal(); setTimeout(() => el('createName').focus(), 40);
  }
  function addToCurrent(name, color) {
    const kind = el('createDialog').dataset.kind;
    if (!name.trim()) return;
    const parentId = el('createDialog').dataset.parentId || state.focusId;
    if (parentId !== state.focusId) enterNode(parentId);
    createNode(kind, name.trim(), color, parentId);
  }
  function openRename(n) {
    if (!n || n.sourceRootId && !n.readOnlyPreview) { showToast('Le renommage réel des dossiers connectés n’est pas inclus dans cette étape.'); return; }
    el('renameDialog').dataset.nodeId = n.id; el('renameInput').value = n.name; el('renameDialog').showModal(); setTimeout(() => { el('renameInput').focus(); el('renameInput').select(); }, 40);
  }
  function showSearch() {
    closeSpaceMenu();
    el('searchDialog').showModal(); el('searchInput').value = ''; currentQuery = ''; searchIndex = 0; renderSearchResults(); setTimeout(() => el('searchInput').focus(), 30);
  }
  function searchFold(value) { return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr-CA'); }
  function nodePath(n) {
    const parts = [], seen = new Set([n.id]); let current = node(n.parentId);
    while (current && !seen.has(current.id)) { seen.add(current.id); parts.unshift(current.name); current = node(current.parentId); }
    return parts.join(' › ');
  }
  function searchMatches(query) {
    const key = searchFold(query);
    const matches = state.nodes.filter(n => !key || searchFold(`${n.name} ${n.extension || ''} ${nodePath(n)} ${n.relativePath || ''}`).includes(key));
    return { total: matches.length, results: matches.slice(0, 24) };
  }
  function renderSearchResults() {
    const { total, results } = searchMatches(el('searchInput').value);
    searchIndex = Math.min(searchIndex, Math.max(0, results.length - 1));
    el('searchResultCount').textContent = `${String(total).padStart(2, '0')} CORRESPONDANCE${total === 1 ? '' : 'S'}`;
    el('searchResults').innerHTML = results.length ? results.map((n, i) => `<button class="search-result ${i === searchIndex ? 'active' : ''}" data-search-id="${esc(n.id)}" style="--atom-color:${esc(n.color)}"><i class="result-glyph">${esc(glyphFor(n))}</i><span class="result-name">${esc(n.name)}</span><span class="result-path">${esc(nodePath(n) || 'Bureau')}</span></button>`).join('') : '<div class="no-results">Aucun atome ne résonne avec cette recherche.</div>';
  }
  function chooseSearch(id) {
    const n = node(id); if (!n) return;
    const focus = n.kind === 'folder' || n.kind === 'root' ? n.parentId || n.id : n.parentId || 'root';
    if (walkMode) exitWalkMode(false);
    ensureScaleChildren(node(focus)); rebuildIndex();
    state.focusId = focus; state.selectedId = n.id; const f = node(focus);
    const anchor = cameraAnchor(f); engine.camera.mode = 'orbit'; engine.camera.targetGoal = worldPosition(anchor.id, performance.now() / 1000, new Map()); engine.camera.distanceGoal = scopeDistance(f);
    el('searchDialog').close(); saveState(); renderInspector(n.id);
  }

  function onAtomClick(event, id) {
    const atom = labelNodes.get(id);
    if (atom?.dataset.suppressClick === '1') { delete atom.dataset.suppressClick; return; }
    if (gesture?.moved) { gesture = null; return; }
    if (event.detail > 1) return;
    if (event.target.closest('[data-widget-action]')) return;
    activateNode(id);
  }
  function onAtomPointerDown(event, id) {
    if (event.button !== 0 || event.target.closest('[data-widget-action]')) return;
    if (handMode) return; // Normal clicks still work; dragging an atom requires opting out.
    const n = node(id); if (!n || n.kind === 'root') return;
    event.preventDefault(); event.stopPropagation();
    const world = positions.get(id) || [0, 0, 0];
    gesture = { kind: 'atom', id, startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, moved: false, world: [...world], planePoint: [...world], targetId: '' };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }
  function onPointerMove(event) {
    if (!gesture) return;
    if (gesture.kind === 'camera') {
      const dx = event.clientX - gesture.lastX, dy = event.clientY - gesture.lastY;
      if (Math.abs(event.clientX - gesture.startX) + Math.abs(event.clientY - gesture.startY) > 3) gesture.moved = true;
      if (handMode) {
        if (cameraYawGoal === null) cameraYawGoal = engine.camera.yaw;
        if (cameraPitchGoal === null) cameraPitchGoal = engine.camera.pitch;
        cameraYawGoal -= dx * .003;
        cameraPitchGoal = Math.max(walkMode ? -.95 : -1.08, Math.min(walkMode ? .95 : 1.08, cameraPitchGoal + dy * .0022));
        wakeFrame();
      } else {
        engine.camera.yaw -= dx * .0045; engine.camera.pitch = Math.max(walkMode ? -.95 : -1.08, Math.min(walkMode ? .95 : 1.08, engine.camera.pitch + dy * .0033));
      }
      gesture.lastX = event.clientX; gesture.lastY = event.clientY; return;
    }
    const dx = event.clientX - gesture.startX, dy = event.clientY - gesture.startY;
    if (!gesture.moved && Math.hypot(dx, dy) > 5) gesture.moved = true;
    if (!gesture.moved) return;
    gesture.x = event.clientX; gesture.y = event.clientY;
    const rect = canvas.getBoundingClientRect();
    gesture.world = engine.rayPlane(event.clientX - rect.left, event.clientY - rect.top, gesture.planePoint);
    gesture.targetId = findDropTarget(gesture.id, event.clientX, event.clientY);
    for (const atom of nodeLayer.querySelectorAll('.atom-label')) atom.classList.toggle('drop-target', atom.dataset.nodeId === gesture.targetId);
    el('dropPrompt').classList.toggle('hidden', !gesture.targetId);
    if (gesture.targetId) el('dropPromptText').textContent = `Relâcher dans « ${node(gesture.targetId)?.name || 'dossier'} »`;
    const dragged = labelNodes.get(gesture.id); if (dragged) dragged.classList.add('is-dragging');
  }
  function findDropTarget(sourceId, clientX, clientY) {
    const rect = canvas.getBoundingClientRect(); let best = ''; let distance = 54;
    for (const n of visible) {
      if (!canDrop(node(sourceId), n)) continue;
      const p = engine.project(positions.get(n.id)); if (!p) continue;
      const d = Math.hypot(p.x + rect.left - clientX, p.y + rect.top - clientY);
      if (d < distance) { distance = d; best = n.id; }
    }
    return best;
  }
  function cancelGesture() {
    gesture = null;
    cameraYawGoal = null; cameraPitchGoal = null;
    el('dropPrompt').classList.add('hidden');
    for (const atom of nodeLayer.querySelectorAll('.atom-label')) atom.classList.remove('drop-target', 'is-dragging');
  }
  function onPointerUp(event) {
    if (!gesture) return;
    const current = gesture; gesture = null;
    el('dropPrompt').classList.add('hidden');
    for (const atom of nodeLayer.querySelectorAll('.atom-label')) { atom.classList.remove('drop-target', 'is-dragging'); }
    if (current.kind === 'camera') { if (current.moved) scheduleCameraSave(); return; }
    if (current.moved) {
      const element = labelNodes.get(current.id); if (element) element.dataset.suppressClick = '1';
      if (current.targetId) { prepareMove(current.id, current.targetId); return; }
      placeOnOrbit(current.id, current.world);
    }
  }
  function placeOnOrbit(id, world) {
    const n = node(id); if (!n || !n.parentId) return;
    const parent = positions.get(n.parentId) || [0, 0, 0], delta = [world[0] - parent[0], world[1] - parent[1], world[2] - parent[2]];
    delete n.peerLevel;
    n.orbit = Math.max(.35, Math.min(7, Math.hypot(...delta)));
    n.phase = Math.atan2(delta[2], delta[0]); n.lift = Math.max(-2, Math.min(2, delta[1]));
    saveState(); showToast(`Nouvelle orbite pour « ${n.name} ».`);
  }
  function onWheel(event) {
    event.preventDefault();
    if (walkMode) return;
    if (event.deltaY > 0 && engine.camera.distanceGoal >= 19.2 && performance.now() - lastShellZoomAt > 700) {
      lastShellZoomAt = performance.now(); zoomOutScope(); return;
    }
    if (event.deltaY < 0 && engine.camera.distanceGoal <= 6.35 && state.selectedId && state.selectedId !== state.focusId && ['root', 'folder'].includes(node(state.selectedId)?.kind)) {
      enterNode(state.selectedId); return;
    }
    engine.camera.distanceGoal = Math.max(6.2, Math.min(20, engine.camera.distanceGoal * Math.exp(event.deltaY * .001)));
    scheduleCameraSave();
  }
  function toggleTimer(reset = false) {
    if (reset) { state.timer = { remaining: 25 * 60, running: false, endsAt: 0 }; }
    else if (state.timer.running) { state.timer.remaining = timerRemaining(); state.timer.running = false; state.timer.endsAt = 0; }
    else { state.timer.running = true; state.timer.endsAt = Date.now() + state.timer.remaining * 1000; }
    saveState(); showToast(reset ? 'Le foyer repart pour 25 minutes.' : state.timer.running ? 'Le foyer de concentration démarre.' : 'Le foyer est en pause.');
    if (state.selectedId === 'focus-widget') renderInspector('focus-widget');
  }
  function timerRemaining() {
    if (!state.timer.running) return Math.max(0, state.timer.remaining || 0);
    const remaining = Math.max(0, Math.ceil((state.timer.endsAt - Date.now()) / 1000));
    if (remaining === 0) { state.timer.running = false; state.timer.remaining = 25 * 60; state.timer.endsAt = 0; saveState(); showToast('La période de concentration est terminée.', 3600); }
    return remaining;
  }
  function formatTime(seconds) { return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`; }

  function setupControls() {
    try { window.OrbitTools.setup(document, window.localStorage); }
    catch (error) { console.error(error); el('toolsButton').disabled = true; showToast('Les outils locaux sont temporairement indisponibles.'); }
    el('agentsButton').addEventListener('click', () => el('agentsDialog').showModal());
    for (const agent of window.OrbitAgents.agents) {
      const button = document.createElement('button');
      button.type = 'button'; button.textContent = agent.name;
      button.addEventListener('click', () => {
        const policy = document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content || '';
        const result = window.OrbitAgents.runAgent(agent.id, {
          nodes: state.nodes, sceneReady: Boolean(engine), pointerSeen, handMode,
          networkBlocked: policy.includes("connect-src 'none'")
        });
        el('agentResult').textContent = `${agent.name} · ${result.status} — ${result.detail}`;
      });
      el('agentsList').append(button);
    }
    el('handModeButton').addEventListener('click', () => {
      handMode = !handMode;
      cameraYawGoal = null; cameraPitchGoal = null;
      el('handModeButton').textContent = handMode ? '✋ Mode main : activé' : '✋ Mode main : désactivé';
      el('handModeButton').setAttribute('aria-pressed', String(handMode));
      showToast(handMode ? 'Mode main : planètes protégées.' : 'Mode main désactivé : les planètes peuvent être déplacées.');
    });
    const nativeWebView = window.chrome?.webview;
    if (nativeWebView && typeof nativeWebView.postMessage === 'function') {
      nativeWebView.addEventListener('message', onNativeWindowMessage);
      nativeWebView.postMessage({ type: 'list-registered-apps' });
    }
    el('zoomOutButton').addEventListener('click', () => { closeSpaceMenu({ restoreCamera: false }); zoomOutScope(); });
    el('menuButton').addEventListener('click', () => toggleSphericalMenu('main', 'menuButton'));
    el('settingsButton').addEventListener('click', () => toggleSphericalMenu('settings', 'settingsButton'));
    el('walkExitButton').addEventListener('click', () => exitWalkMode());
    el('chooseDirectoryButton').addEventListener('click', async () => {
      el('connectDialog').close();
      showToast('Connexion de dossiers désactivée dans ORBIT.');
      return;
      el('connectDialog').close();
      if (window.isSecureContext && typeof window.showDirectoryPicker === 'function') {
        try { const handle = await window.showDirectoryPicker({ id: 'winmap-root', mode: 'read' }); await importDirectoryHandle(handle); }
        catch (error) { if (error.name !== 'AbortError') showToast('Le dossier n’a pas pu être ouvert.'); }
      } else {
        showToast('Mode aperçu : sélectionne un dossier pour lire ses noms sans écrire sur le disque.', 3400);
        el('fallbackDirectory').click();
      }
    });
    el('fallbackDirectory').addEventListener('change', event => importFromFallback(event.target.files));
    el('inspectorClose').addEventListener('click', () => { inspector.classList.add('hidden'); state.selectedId = ''; });
    el('confirmMoveButton').addEventListener('click', confirmMove);
    el('moveDialog').addEventListener('close', () => { pendingMove = null; pendingExternalDrop = null; });
    el('createForm').addEventListener('submit', event => { event.preventDefault(); const color = new FormData(event.currentTarget).get('atomColor'); addToCurrent(el('createName').value, color); el('createDialog').close(); });
    el('renameForm').addEventListener('submit', event => {
      event.preventDefault(); const target = node(el('renameDialog').dataset.nodeId); if (!target) return;
      target.name = el('renameInput').value.trim(); rebuildIndex(); saveState(); el('renameDialog').close(); renderInspector(target.id); showToast('L’identité de l’atome a changé.');
    });
    el('searchInput').addEventListener('input', () => { currentQuery = el('searchInput').value; searchIndex = 0; renderSearchResults(); });
    el('searchInput').addEventListener('keydown', event => {
      const results = el('searchResults').querySelectorAll('.search-result');
      if (event.key === 'ArrowDown') { event.preventDefault(); searchIndex = Math.min(searchIndex + 1, results.length - 1); renderSearchResults(); }
      if (event.key === 'ArrowUp') { event.preventDefault(); searchIndex = Math.max(0, searchIndex - 1); renderSearchResults(); }
      if (event.key === 'Enter' && results[searchIndex]) chooseSearch(results[searchIndex].dataset.searchId);
    });
    document.addEventListener('click', event => {
      const create = event.target.closest('[data-create]');
      if (create) { const parentId = createParentId || state.focusId; closeSpaceMenu(); openCreate(create.dataset.create, parentId); return; }
      const field = event.target.closest('[data-field]');
      if (field) { state.field = field.dataset.field; saveState(); showToast(FIELD_EXPLANATIONS[state.field], 4200); return; }
      const action = event.target.closest('[data-action]');
      if (action) { handleInspectorAction(action.dataset.action); return; }
      const result = event.target.closest('[data-search-id]');
      if (result) { chooseSearch(result.dataset.searchId); return; }
      const crumb = event.target.closest('[data-breadcrumb]');
      if (crumb) { enterNode(crumb.dataset.breadcrumb); return; }
      const widgetAction = event.target.closest('[data-widget-action]');
      if (widgetAction) { if (widgetAction.dataset.widgetAction === 'timer') toggleTimer(); else selectNode(widgetAction.dataset.widgetId); return; }
      if (!event.target.closest('#spaceMenu,#menuButton') && !(spaceMenuOpen() && event.target.closest('#universe'))) closeSpaceMenu();
    });
    document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => el(button.dataset.close).close()));
    for (const dialog of document.querySelectorAll('dialog')) dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
    canvas.addEventListener('pointerdown', event => {
      if (event.button !== 0 || event.target.closest('.atom-label')) return;
      cameraYawGoal = engine.camera.yaw; cameraPitchGoal = engine.camera.pitch;
      gesture = { kind: 'camera', startX: event.clientX, startY: event.clientY, lastX: event.clientX, lastY: event.clientY, moved: false };
      canvas.setPointerCapture?.(event.pointerId);
    });
    canvas.addEventListener('wheel', onWheel, { passive: false });
    el('universe').addEventListener('dragover', updateExternalDrop);
    document.addEventListener('dragover', event => { if (hasExternalFiles(event.dataTransfer)) event.preventDefault(); }, true);
    document.addEventListener('drop', event => {
      if (hasExternalFiles(event.dataTransfer)) { event.preventDefault(); showToast('Import de fichiers désactivé dans ORBIT.'); }
      return;
      if (!hasExternalFiles(event.dataTransfer)) return;
      event.preventDefault();
      const inScene = el('universe').contains(event.target);
      const targetId = externalDropTargetId || findExternalDropTarget(event.clientX, event.clientY);
      const handlesPromise = inScene ? collectExternalHandles(event.dataTransfer) : Promise.resolve([]);
      clearExternalDrop();
      if (inScene) void finishExternalDrop(handlesPromise, targetId);
    }, true);
    document.addEventListener('dragleave', event => { if (!event.relatedTarget) clearExternalDrop(); }, true);
    document.addEventListener('dragend', clearExternalDrop, true);
    document.addEventListener('pointermove', event => { pointerSeen = true; onPointerMove(event); });
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('pointercancel', cancelGesture);
    window.addEventListener('blur', cancelGesture);
    document.addEventListener('keydown', event => {
      if (el('toolsDialog').open || el('agentsDialog').open) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); showSearch(); }
      if (event.key === 'Escape') {
        if (el('toolsDialog').open) return;
        if (el('agentsDialog').open) return;
        if (walkMode) { exitWalkMode(); return; }
        if (el('searchDialog').open || el('connectDialog').open || el('moveDialog').open || el('filePreviewDialog').open || el('createDialog').open || el('renameDialog').open) return;
        if (!el('spaceMenu').classList.contains('hidden')) { closeSpaceMenu({ focusTrigger: true }); return; }
        if (state.focusId !== 'root') zoomOutScope(); else { inspector.classList.add('hidden'); state.selectedId = ''; }
      }
      if (event.key === 'Enter' && state.selectedId && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) enterNode(state.selectedId);
      if (event.key === '+' || event.key === '=') { engine.camera.distanceGoal = Math.max(6.2, engine.camera.distanceGoal - .7); scheduleCameraSave(); }
      if (event.key === '-') {
        if (engine.camera.distanceGoal >= 19.2 && performance.now() - lastShellZoomAt > 700) { lastShellZoomAt = performance.now(); zoomOutScope(); }
        else { engine.camera.distanceGoal = Math.min(20, engine.camera.distanceGoal + .7); scheduleCameraSave(); }
      }
    });
    document.addEventListener('keydown', event => {
      if (!walkMode || ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      const key = event.key.toLowerCase();
      if (key === 'w' || key === 'a' || key === 's' || key === 'd' || key === 'q' || key === 'e') { walkKeys.add(key); event.preventDefault(); }
    });
    document.addEventListener('keyup', event => walkKeys.delete(event.key.toLowerCase()));
    window.addEventListener('blur', () => walkKeys.clear());
    el('searchDialog').addEventListener('close', () => { currentQuery = ''; });
    el('filePreviewDialog').addEventListener('close', clearFilePreview);
    window.addEventListener('resize', () => engine.resize());
    reduceMotion.addEventListener?.('change', () => showToast(reduceMotion.matches ? 'Mouvement réduit selon les préférences de Windows.' : 'Mouvement spatial rétabli.'));
  }
  function handleInspectorAction(action) {
    const n = node(state.selectedId); if (!n) return;
    if (action === 'open-file') { void openFilePreview(n); return; }
    if (action === 'focus-window') { requestNativeWindowFocus(n); return; }
    if (action === 'choose-app') { requestNativeAppChoice(n); return; }
    if (action === 'launch-app') { requestNativeAppLaunch(n); return; }
    if (action === 'create') { createParentId = n.id; openSpaceMenu('create'); return; }
    if (action === 'connect') { el('connectDialog').showModal(); return; }
    if (action === 'refresh-root') { refreshConnectedRoot(n.id).catch(error => { console.error(error); showToast('Le dossier ne peut pas être actualisé pour le moment.'); }); return; }
    if (action === 'enter') { enterNode(n.id); return; }
    if (action === 'rename') { openRename(n); return; }
    if (action === 'show-parent') { enterNode(n.parentId || 'root'); selectNode(n.id); return; }
    if (action === 'toggle-app') { n.running = !n.running; saveState(); renderInspector(n.id); showToast(`${n.name} est maintenant ${n.running ? 'en activité' : 'en veille'} dans la scène.`); return; }
    if (action === 'link-app') { const focus = node(state.focusId); n.links = Array.from(new Set([...(n.links || []), focus?.id].filter(Boolean))); rebuildIndex(); saveState(); renderInspector(n.id); showToast(`Liaison magnétique vers « ${focus?.name || 'Bureau'} » ajoutée.`); return; }
    if (action === 'toggle-task') { toggleTask(n); saveState(); renderInspector(n.id); showToast(`${n.name} · ${taskStatusText(n).toLocaleLowerCase('fr-CA')}.`); return; }
    if (action === 'advance-task') { if (!advanceTask(n)) { showToast('Démarre la tâche avant de modifier sa progression.'); return; } saveState(); renderInspector(n.id); showToast(`${n.name} · ${taskProgress(n)} %${n.taskStatus === 'completed' ? ' · terminée' : ''}.`); return; }
    if (action === 'toggle-timer') { toggleTimer(); return; }
    if (action === 'reset-timer') { toggleTimer(true); return; }
    if (action === 'inspect-widget') { showToast(`« ${n.name} » est un widget local, lié à ${childrenOf(state.focusId).length} atomes.`); }
  }

  function initEngine() {
    engine = new window.MolecularSpace(canvas);
    engine.camera.mode = 'orbit';
    engine.camera.yaw = Number(state.camera?.yaw ?? -.24); engine.camera.pitch = Number(state.camera?.pitch ?? .25);
    engine.camera.distance = Math.max(6.2, Math.min(25, Number(state.camera?.distance ?? 13.3))); engine.camera.distanceGoal = engine.camera.distance;
    const focus = node(state.focusId) || node('root'), anchor = cameraAnchor(focus);
    const focused = worldPosition(anchor.id, performance.now() / 1000, new Map());
    engine.camera.target = [...focused]; engine.camera.targetGoal = [...focused];
  }
  function queueFrame(delay = 0) {
    if (document.hidden || frameTimer || animationFramePending) return;
    if (delay > 0) {
      frameTimer = window.setTimeout(() => {
        frameTimer = 0;
        if (!document.hidden) frame(performance.now());
      }, delay);
      return;
    }
    animationFramePending = true;
    animationFrameId = requestAnimationFrame(now => { animationFrameId = 0; animationFramePending = false; frame(now); });
  }
  function wakeFrame() {
    if (frameTimer) { clearTimeout(frameTimer); frameTimer = 0; }
    queueFrame();
  }
  function frameIntervalFor({ resting, interactive, motion }) {
    if (resting) return 250;
    return interactive || motion >= .12 ? 1000 / 45 : 1000 / 30;
  }
  function frame(now) {
    if (document.hidden) return;
    const camera = engine.camera;
    const turning = handMode && cameraYawGoal !== null && cameraPitchGoal !== null &&
      (Math.abs(cameraYawGoal - camera.yaw) > .0001 || Math.abs(cameraPitchGoal - camera.pitch) > .0001);
    const cameraAnimating = turning || Math.abs(camera.distanceGoal - camera.distance) > .008 || camera.target.some((value, index) => Math.abs(camera.targetGoal[index] - value) > .008);
    const resting = !walkMode && !gesture && !cameraAnimating && (reduceMotion.matches || state.motion === 0);
    const frameInterval = frameIntervalFor({ resting, interactive: walkMode || gesture || cameraAnimating, motion: state.motion });
    const deltaSeconds = lastFrameTime ? Math.min(.06, (now - lastFrameTime) / 1000) : 1 / 45;
    lastFrameTime = now;
    if (turning) {
      const alpha = 1 - Math.exp(-14 * deltaSeconds);
      camera.yaw += (cameraYawGoal - camera.yaw) * alpha;
      camera.pitch += (cameraPitchGoal - camera.pitch) * alpha;
    }
    const seconds = now / 1000;
    const cache = new Map();
    const list = visibleNodes();
    for (const n of list) worldPosition(n.id, seconds, cache);
    if (state.selectedId && !cache.has(state.selectedId)) worldPosition(state.selectedId, seconds, cache);
    const menuOpen = spaceMenuOpen(), focused = node(state.focusId) || node('root');
    let menuSphere = null;
    if (menuOpen && sphericalMenuNodes.length) {
      const center = cache.get(focused.id) || worldPosition(focused.id, seconds, cache), radius = sphericalMenuRadius();
      const spin = reduceMotion.matches || state.motion === 0 ? 0 : state.motion < .12 ? .028 : .05;
      const surface = sphericalMenuNodes.filter(item => !item.menuCore);
      let surfaceIndex = 0;
      for (const item of sphericalMenuNodes) {
        cache.set(item.id, item.menuCore ? center : sphericalMenuPosition(surfaceIndex++, surface.length, center, radius, seconds, spin));
        list.push(item);
      }
      menuSphere = { center, radius };
    }
    positions = cache;
    if (!walkMode) {
      const anchor = menuOpen ? focused : cameraAnchor(focused);
      engine.camera.targetGoal = [...(positions.get(anchor.id) || [0, 0, 0])];
    }
    updateWalkMovement(deltaSeconds);
    const visualMotion = reduceMotion.matches || state.motion === 0 ? 0 : state.motion < .12 ? .34 : .7;
    engine.render({ visible: list, allNodes: state.nodes, positions, mode: state.field, selectedId: state.selectedId, focusId: state.focusId, walkMode, seconds, motion: visualMotion, menuSphere });
    renderLabels(seconds, list, menuSphere);
    if (state.timer.running && now - lastSaveClock > 8000) { saveState(); lastSaveClock = now; }
    queueFrame(frameInterval);
  }

  rebuildIndex();
  try { initEngine(); }
  catch (error) {
    console.error(error); el('space').style.display = 'none';
    showToast('Cette scène requiert un navigateur avec WebGL 2. Ouvre-la dans Microsoft Edge ou Chrome.', 8000);
  }
  if (engine) {
    setupControls(); renderInspector('');
    document.addEventListener('pointerdown', wakeFrame, { passive: true });
    document.addEventListener('wheel', wakeFrame, { passive: true });
    document.addEventListener('keydown', wakeFrame, { passive: true });
    window.addEventListener('resize', wakeFrame, { passive: true });
    reduceMotion.addEventListener?.('change', wakeFrame);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        clearTimeout(frameTimer); frameTimer = 0; lastFrameTime = 0;
        if (animationFramePending) cancelAnimationFrame(animationFrameId);
        animationFrameId = 0; animationFramePending = false;
      } else {
        lastFrameTime = 0; queueFrame();
      }
    });
    queueFrame();
    restoreConnectedHandles().catch(error => { console.error(error); showToast('La synchronisation des dossiers connectés a échoué.'); });
  }
})();

