import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.159.0/build/three.module.js';

const app = document.getElementById('app');
const statusEl = document.getElementById('status');
const objectiveEl = document.getElementById('objective');
const promptEl = document.getElementById('portalPrompt');
const transitionOverlay = document.getElementById('transitionOverlay');
const transitionText = document.getElementById('transitionText');

const WORLD_LIMIT = 70;
const player = {
  position: new THREE.Vector3(0, 1.3, 0),
  speed: 11,
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9cc8ff);
scene.fog = new THREE.Fog(0x9cc8ff, 28, 150);

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 300);
camera.position.set(10, 8, 16);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.appendChild(renderer.domElement);

const clock = new THREE.Clock();
const keys = {};
const portalDefinitions = [
  { tier: 'E', color: 0x8be9fd },
  { tier: 'D', color: 0x6ec7ff },
  { tier: 'C', color: 0x7ef0a8 },
  { tier: 'B', color: 0xffd166 },
  { tier: 'A', color: 0xff8a65 },
  { tier: 'S', color: 0xff5edb },
];

const dungeonThemes = [
  { name: 'Shadow Ruins', hue: 0xff5d73 },
  { name: 'Frost Catacomb', hue: 0x7ad7ff },
  { name: 'Ashen Hollow', hue: 0xffa857 },
  { name: 'Corrupted Grove', hue: 0x98ff8c },
  { name: 'Moonwell Vault', hue: 0xb2a5ff },
  { name: 'Void Prison', hue: 0xd08cff },
  { name: 'Mire Crypt', hue: 0x7fe1b2 },
  { name: 'Sunken Temple', hue: 0xf7d98d },
  { name: 'Storm Lair', hue: 0x76d9ff },
  { name: 'Crimson Citadel', hue: 0xff4f6d },
];

const zoneCenters = {
  city: new THREE.Vector3(-16, 0, -18),
  park: new THREE.Vector3(18, 0, -8),
  neighborhood: new THREE.Vector3(-8, 0, 20),
  forest: new THREE.Vector3(28, 0, 22),
};

const portals = [];
let nearestPortal = null;
let transitionState = null;
let inDungeon = false;

const mobileControls = {
  active: false,
  moveX: 0,
  moveY: 0,
  pointerId: null,
};

const mobileHud = document.createElement('div');
mobileHud.id = 'mobileHud';
mobileHud.innerHTML = `
  <div id="movePad">
    <div id="moveKnob"></div>
  </div>
  <div id="actionButtons">
    <button id="interactBtn">E</button>
    <button id="exitBtn">R</button>
  </div>
`;
app.appendChild(mobileHud);

const movePad = document.getElementById('movePad');
const moveKnob = document.getElementById('moveKnob');
const interactBtn = document.getElementById('interactBtn');
const exitBtn = document.getElementById('exitBtn');

interactBtn.addEventListener('click', () => {
  if (nearestPortal) triggerDungeon(nearestPortal);
});

exitBtn.addEventListener('click', () => {
  if (inDungeon) returnToLobby();
});

function updateJoystickFromPointer(clientX, clientY) {
  const rect = movePad.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const dx = clientX - cx;
  const dy = clientY - cy;
  const maxDist = rect.width * 0.34;
  const dist = Math.min(Math.hypot(dx, dy), maxDist);
  const angle = Math.atan2(dy, dx);
  const x = Math.cos(angle) * dist;
  const y = Math.sin(angle) * dist;

  moveKnob.style.transform = `translate(${x}px, ${y}px)`;
  mobileControls.moveX = dist === 0 ? 0 : x / maxDist;
  mobileControls.moveY = dist === 0 ? 0 : y / maxDist;
}

movePad.addEventListener('pointerdown', (event) => {
  mobileControls.active = true;
  mobileControls.pointerId = event.pointerId;
  movePad.setPointerCapture(event.pointerId);
  updateJoystickFromPointer(event.clientX, event.clientY);
});

movePad.addEventListener('pointermove', (event) => {
  if (!mobileControls.active || event.pointerId !== mobileControls.pointerId) return;
  updateJoystickFromPointer(event.clientX, event.clientY);
});

function releaseJoystick() {
  mobileControls.active = false;
  mobileControls.pointerId = null;
  mobileControls.moveX = 0;
  mobileControls.moveY = 0;
  moveKnob.style.transform = 'translate(0px, 0px)';
}

movePad.addEventListener('pointerup', releaseJoystick);
movePad.addEventListener('pointerleave', releaseJoystick);
movePad.addEventListener('pointercancel', releaseJoystick);

const ambientLight = new THREE.AmbientLight(0xeff6ff, 0.9);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xfff1ca, 1.45);
sunLight.position.set(30, 35, 20);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.camera.left = -70;
sunLight.shadow.camera.right = 70;
sunLight.shadow.camera.top = 70;
sunLight.shadow.camera.bottom = -70;
scene.add(sunLight);

const worldGroup = new THREE.Group();
scene.add(worldGroup);

const skyGlow = new THREE.Mesh(
  new THREE.SphereGeometry(200, 32, 32),
  new THREE.MeshBasicMaterial({ color: 0xbfe4ff, side: THREE.BackSide, transparent: true, opacity: 0.9 })
);
scene.add(skyGlow);

function createTree(x, z, scale = 1) {
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3 * scale, 0.45 * scale, 2.5 * scale, 8),
    new THREE.MeshStandardMaterial({ color: 0x5f3c2c, roughness: 1 })
  );
  trunk.position.set(x, 1.3 * scale, z);
  trunk.castShadow = true;

  const leaves = new THREE.Mesh(
    new THREE.SphereGeometry(1.7 * scale, 12, 12),
    new THREE.MeshStandardMaterial({ color: 0x3e8f4e, roughness: 0.9 })
  );
  leaves.position.set(x, 3.25 * scale, z);
  leaves.castShadow = true;

  worldGroup.add(trunk);
  worldGroup.add(leaves);
}

function createRock(x, z, scale = 1) {
  const rock = new THREE.Mesh(
    new THREE.DodecahedronGeometry(1.2 * scale, 0),
    new THREE.MeshStandardMaterial({ color: 0x69757d, roughness: 1 })
  );
  rock.position.set(x, 0.8 * scale, z);
  rock.rotation.z = Math.random() * Math.PI;
  rock.scale.set(1, 0.8 + Math.random() * 0.5, 1.3);
  worldGroup.add(rock);
}

function createGround() {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(180, 180),
    new THREE.MeshStandardMaterial({ color: 0x7c8d66, roughness: 0.95, metalness: 0.04 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  worldGroup.add(ground);

  const roads = new THREE.Group();
  for (let i = -60; i <= 60; i += 18) {
    const road = new THREE.Mesh(
      new THREE.BoxGeometry(12, 0.08, 6),
      new THREE.MeshStandardMaterial({ color: 0x2f3540, roughness: 0.8 })
    );
    road.position.set(i, 0.06, 0);
    roads.add(road);

    const road2 = new THREE.Mesh(
      new THREE.BoxGeometry(6, 0.08, 12),
      new THREE.MeshStandardMaterial({ color: 0x2f3540, roughness: 0.8 })
    );
    road2.position.set(0, 0.06, i);
    roads.add(road2);
  }

  worldGroup.add(roads);
}

function createBuilding(color, x, z, w, d, h) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.86, metalness: 0.28 })
  );
  mesh.position.set(x, h / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  worldGroup.add(mesh);
}

function createZoneDecor() {
  for (let i = 0; i < 42; i += 1) {
    const x = -34 + Math.random() * 42;
    const z = -30 + Math.random() * 42;
    const w = 3 + Math.random() * 4;
    const d = 3 + Math.random() * 4;
    const h = 7 + Math.random() * 11;
    createBuilding(0x4b6179, x, z, w, d, h);
  }

  for (let i = 0; i < 30; i += 1) createTree(-22 + Math.random() * 44, -18 + Math.random() * 28, 1 + Math.random() * 0.7);
  for (let i = 0; i < 26; i += 1) {
    const x = 18 + Math.random() * 42;
    const z = -20 + Math.random() * 30;
    createTree(x, z, 1.2 + Math.random() * 0.9);
  }
  for (let i = 0; i < 28; i += 1) {
    const x = -26 + Math.random() * 30;
    const z = 12 + Math.random() * 42;
    createTree(x, z, 0.8 + Math.random() * 0.8);
    createRock(x + 2, z + 2, 0.5 + Math.random() * 0.8);
  }
  for (let i = 0; i < 32; i += 1) {
    const x = 28 + Math.random() * 20;
    const z = 24 + Math.random() * 18;
    createTree(x, z, 1.4 + Math.random() * 0.8);
    createRock(x + 1, z - 1, 0.8 + Math.random() * 0.8);
  }
}

function createPortalMesh(color) {
  const group = new THREE.Group();

  const outer = new THREE.Mesh(
    new THREE.TorusGeometry(1.9, 0.18, 16, 120),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.5, metalness: 0.75, roughness: 0.2 })
  );
  outer.rotation.x = Math.PI / 2;
  group.add(outer);

  const crystal = new THREE.Mesh(
    new THREE.OctahedronGeometry(1, 0),
    new THREE.MeshStandardMaterial({ color: 0xf2f6ff, emissive: color, emissiveIntensity: 1.2 })
  );
  crystal.position.y = 0.2;
  group.add(crystal);

  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(0.95, 32, 32),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.25 })
  );
  glow.position.y = 0.2;
  group.add(glow);

  return group;
}

function createClueMarks(color, x, z) {
  const marks = new THREE.Group();
  for (let i = 0; i < 4; i += 1) {
    const mark = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.04, 0.9),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 })
    );
    mark.rotation.z = (Math.random() - 0.5) * 1.2;
    mark.position.set(x + (Math.random() - 0.5) * 2.4, 0.2, z + (Math.random() - 0.5) * 2.4);
    marks.add(mark);
  }
  return marks;
}

function randomZonePosition(zoneName, radius) {
  const base = zoneCenters[zoneName];
  const angle = Math.random() * Math.PI * 2;
  const distance = Math.random() * radius;
  return new THREE.Vector3(
    base.x + Math.cos(angle) * distance,
    0,
    base.z + Math.sin(angle) * distance
  );
}

function randomDungeonFromTier(tierIndex) {
  const theme = dungeonThemes[Math.floor(Math.random() * dungeonThemes.length)];
  const tier = portalDefinitions[tierIndex];
  return {
    theme: theme.name,
    color: theme.hue,
    tier: tier.tier,
    portalColor: tier.color,
    tierIndex,
  };
}

function getZoneForTier(tierIndex) {
  const weightedZones = [
    ['city', 0.35],
    ['park', 0.28],
    ['neighborhood', 0.22],
    ['forest', 0.15],
  ];

  const roll = Math.random();
  let total = 0;
  for (const [zoneName, weight] of weightedZones) {
    total += weight;
    if (roll <= total) return zoneName;
  }
  return 'city';
}

function getPortalPosition(zoneName, tierIndex) {
  let radius = 12;
  if (zoneName === 'city') radius = 18;
  if (zoneName === 'park') radius = 15;
  if (zoneName === 'neighborhood') radius = 12;
  if (zoneName === 'forest') radius = 10;

  if (tierIndex >= 4) radius *= 0.7;
  if (tierIndex === 5) radius *= 0.55;

  return randomZonePosition(zoneName, radius);
}

function createPortalPortalData(index) {
  const tierIndex = Math.min(5, Math.floor(index / 2.5));
  const zoneName = getZoneForTier(tierIndex);
  const portalData = randomDungeonFromTier(tierIndex);
  const position = getPortalPosition(zoneName, tierIndex);

  const group = createPortalMesh(portalData.portalColor);
  group.position.copy(position);
  group.position.y = 1.5;
  group.userData.portalMeta = { ...portalData, zoneName, id: index };
  worldGroup.add(group);

  const clueDensity = Math.max(1, 6 - tierIndex);
  for (let i = 0; i < clueDensity; i += 1) {
    const clue = createClueMarks(portalData.portalColor, position.x + (Math.random() - 0.5) * 3, position.z + (Math.random() - 0.5) * 3);
    clue.position.y = 0.1;
    worldGroup.add(clue);
  }

  const portal = {
    index,
    id: `portal-${index}`,
    mesh: group,
    position: position.clone(),
    visible: true,
    active: true,
    lifeMs: 22000 + Math.random() * 18000,
    respawnAt: 0,
    clueStrength: clueDensity,
    tierIndex,
    ...portalData,
    zoneName,
  };

  portals.push(portal);
}

function updatePortalPrompt() {
  let best = null;
  for (const portal of portals) {
    if (!portal.active) continue;
    const distance = portal.mesh.position.distanceTo(player.position);
    if (distance < 4.6 && (!best || distance < best.distance)) {
      best = { portal, distance };
    }
  }

  nearestPortal = best ? best.portal : null;

  if (nearestPortal) {
    promptEl.textContent = `Press E to enter ${nearestPortal.tier} Portal · ${nearestPortal.theme}`;
    promptEl.classList.add('visible');
  } else {
    promptEl.classList.remove('visible');
  }
}

function showTransition(theme, tier, color) {
  transitionOverlay.classList.add('visible');
  transitionText.textContent = `${theme.toUpperCase()} // ${tier} RIFT`;
  transitionOverlay.style.background = `radial-gradient(circle, rgba(255,255,255,0.08), rgba(${(color >> 16) & 255}, ${(color >> 8) & 255}, ${color & 255}, 0.82))`;
  transitionState = { startedAt: performance.now(), duration: 1600, theme, tier, color };
}

function hideTransition() {
  transitionOverlay.classList.remove('visible');
  transitionState = null;
}

function triggerDungeon(portal) {
  if (inDungeon || !portal || !portal.active) return;

  inDungeon = true;
  statusEl.textContent = `${portal.tier} Dungeon`;
  objectiveEl.textContent = `${portal.theme} • Clear the rift and return to the lobby.`;
  player.position.set(0, 1.3, -18);
  scene.background = new THREE.Color(0x0d1220);
  scene.fog = new THREE.Fog(0x0d1220, 8, 55);
  showTransition(portal.theme, portal.tier, portal.color);

  const dungeonGround = new THREE.Mesh(
    new THREE.CircleGeometry(12, 48),
    new THREE.MeshStandardMaterial({
      color: portal.color,
      emissive: portal.color,
      emissiveIntensity: 0.2,
      roughness: 0.85,
      metalness: 0.08,
    })
  );
  dungeonGround.rotation.x = -Math.PI / 2;
  dungeonGround.position.set(0, 0.02, -18);
  dungeonGround.name = 'dungeonFloor';

  const oldFloor = worldGroup.getObjectByName('dungeonFloor');
  if (oldFloor) worldGroup.remove(oldFloor);
  worldGroup.add(dungeonGround);

  setTimeout(() => hideTransition(), 1500);
}

function returnToLobby() {
  inDungeon = false;
  player.position.set(0, 1.3, 0);
  scene.background = new THREE.Color(0x9cc8ff);
  scene.fog = new THREE.Fog(0x9cc8ff, 28, 150);
  statusEl.textContent = 'Lobby';
  objectiveEl.textContent = 'Explore the hub and find a portal.';

  const oldFloor = worldGroup.getObjectByName('dungeonFloor');
  if (oldFloor) worldGroup.remove(oldFloor);
}

function despawnPortal(portal) {
  portal.active = false;
  portal.mesh.visible = false;
  portal.respawnAt = performance.now() + 30000;
  portal.lifeMs = 0;
}

function updatePortals(delta) {
  for (const portal of portals) {
    if (!portal.active) {
      if (performance.now() >= portal.respawnAt) {
        const nextTier = Math.floor(Math.random() * 6);
        portal.tierIndex = nextTier;
        portal.zoneName = getZoneForTier(nextTier);
        portal.tier = portalDefinitions[nextTier].tier;
        portal.portalColor = portalDefinitions[nextTier].color;
        const theme = dungeonThemes[Math.floor(Math.random() * dungeonThemes.length)];
        portal.theme = theme.name;
        portal.color = theme.hue;
        portal.mesh.children[0].material.color.setHex(portal.portalColor);
        portal.mesh.children[0].material.emissive.setHex(portal.portalColor);
        portal.mesh.children[2].material.color.setHex(portal.portalColor);
        portal.mesh.visible = true;
        portal.active = true;
        portal.lifeMs = 22000 + Math.random() * 18000;
        const pos = getPortalPosition(portal.zoneName, portal.tierIndex);
        portal.mesh.position.copy(pos);
        portal.position.copy(pos);
        portal.mesh.position.y = 1.5;
      }
      continue;
    }

    portal.lifeMs -= delta * 1000;
    if (portal.lifeMs <= 0) despawnPortal(portal);

    portal.mesh.rotation.y += delta * 1.1;
    portal.mesh.position.y = 1.5 + Math.sin(performance.now() * 0.003 + portal.index) * 0.25;
  }
}

window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  keys[key] = true;

  if (key === 'e' && nearestPortal) triggerDungeon(nearestPortal);
  if (key === 'r' && inDungeon) returnToLobby();
});

window.addEventListener('keyup', (event) => {
  keys[event.key.toLowerCase()] = false;
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function getMovementInput() {
  const keyboardX = (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0);
  const keyboardZ = (keys.s || keys.arrowdown ? 1 : 0) - (keys.w || keys.arrowup ? 1 : 0);
  const mobileX = mobileControls.moveX || 0;
  const mobileZ = -(mobileControls.moveY || 0);

  return {
    x: keyboardX || mobileX,
    z: keyboardZ || mobileZ,
  };
}

function updatePlayer(delta) {
  const input = getMovementInput();

  if (input.x !== 0 || input.z !== 0) {
    const movement = new THREE.Vector3(input.x, 0, input.z).normalize();
    player.position.x += movement.x * player.speed * delta;
    player.position.z += movement.z * player.speed * delta;

    player.position.x = THREE.MathUtils.clamp(player.position.x, -WORLD_LIMIT, WORLD_LIMIT);
    player.position.z = THREE.MathUtils.clamp(player.position.z, -WORLD_LIMIT, WORLD_LIMIT);
  }

  if (inDungeon) {
    camera.position.lerp(new THREE.Vector3(player.position.x + 10, player.position.y + 8, player.position.z + 18), 0.12);
    camera.lookAt(player.position.x, 1.5, player.position.z - 9);
  } else {
    camera.position.lerp(new THREE.Vector3(player.position.x + 13, player.position.y + 9, player.position.z + 17), 0.12);
    camera.lookAt(player.position.x, 1.3, player.position.z);
  }
}

function renderZones() {
  if (!inDungeon) {
    const cityDistance = Math.abs(player.position.x + 15) + Math.abs(player.position.z + 18);
    if (cityDistance < 36) {
      statusEl.textContent = 'City District';
      objectiveEl.textContent = 'The city is alive and full of portals — look for the obvious claw marks.';
    } else if (Math.abs(player.position.x - 18) + Math.abs(player.position.z + 8) < 30) {
      statusEl.textContent = 'Park District';
      objectiveEl.textContent = 'A calmer space with moderate danger and cleaner paths.';
    } else if (Math.abs(player.position.x + 8) + Math.abs(player.position.z - 20) < 26) {
      statusEl.textContent = 'Neighborhood';
      objectiveEl.textContent = 'Lower-tier portals are easier to spot here.';
    } else {
      statusEl.textContent = 'Forest Edge';
      objectiveEl.textContent = 'The rarest portals hide here with the faintest clues.';
    }
  }
}

const playerMesh = new THREE.Mesh(
  new THREE.SphereGeometry(0.75, 26, 26),
  new THREE.MeshStandardMaterial({ color: 0xe7ecff, emissive: 0x68b7ff, emissiveIntensity: 0.45 })
);
playerMesh.position.copy(player.position);
playerMesh.castShadow = true;
worldGroup.add(playerMesh);

const playerGlow = new THREE.Mesh(
  new THREE.SphereGeometry(1.1, 22, 22),
  new THREE.MeshBasicMaterial({ color: 0x4ea2ff, transparent: true, opacity: 0.2 })
);
playerGlow.position.copy(player.position);
worldGroup.add(playerGlow);

function animate() {
  const delta = Math.min(clock.getDelta(), 0.033);
  updatePlayer(delta);
  updatePortalPrompt();
  updatePortals(delta);
  renderZones();

  playerMesh.position.copy(player.position);
  playerGlow.position.copy(player.position);

  if (transitionState) {
    const elapsed = performance.now() - transitionState.startedAt;
    const alpha = Math.min(elapsed / transitionState.duration, 1);
    transitionOverlay.style.opacity = String(0.7 * alpha);
    if (elapsed > transitionState.duration) hideTransition();
  }

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

for (let i = 0; i < 15; i += 1) createPortalPortalData(i);
createGround();
createZoneDecor();

const dustGroup = new THREE.Group();
for (let i = 0; i < 120; i += 1) {
  const dust = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 })
  );
  dust.position.set((Math.random() - 0.5) * 90, Math.random() * 12 + 3, (Math.random() - 0.5) * 90);
  dust.userData = { speed: 0.1 + Math.random() * 0.4, drift: Math.random() * Math.PI * 2 };
  dustGroup.add(dust);
}
worldGroup.add(dustGroup);

function animateDust() {
  dustGroup.children.forEach((dust, index) => {
    dust.position.y += Math.sin(performance.now() * 0.001 + index + dust.userData.drift) * 0.003;
    dust.position.x += Math.sin(performance.now() * 0.0007 + index) * 0.01;
    dust.position.z += Math.cos(performance.now() * 0.0008 + index) * 0.01;
  });
}

function tick() {
  animateDust();
  requestAnimationFrame(tick);
}

tick();
animate();
console.log('Eclipse Rift beta quality upgraded.');





















































































































































































































































































































































































