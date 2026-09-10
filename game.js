(() => {
  'use strict';

  // Obfuscation only: browser-owned storage is not a trusted security boundary.
  const localStorage = (() => {
    const disk = window.localStorage;
    const salt = 'q7V_2mR9.zP4';
    function hash(value) {
      let result = 2166136261;
      for (const character of value) result = Math.imul(result ^ character.charCodeAt(0), 16777619);
      return (result >>> 0).toString(36);
    }
    const alias = (key) => '_0x' + hash(salt + key);
    function encode(value) {
      const bytes = new TextEncoder().encode(String(value));
      return btoa(Array.from(bytes, (byte, index) => String.fromCharCode(byte ^ salt.charCodeAt(index % salt.length))).join(''));
    }
    function decode(value) {
      const bytes = Uint8Array.from(atob(value), (character, index) => character.charCodeAt(0) ^ salt.charCodeAt(index % salt.length));
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    }
    function write(key, value) {
      const payload = encode(value);
      disk.setItem(alias(key), 'v1.' + hash(key + payload + salt) + '.' + payload);
    }
    return {
      getItem(key) {
        const saved = disk.getItem(alias(key));
        if (saved !== null) {
          try {
            const [version, check, payload] = saved.split('.');
            if (version !== 'v1' || check !== hash(key + payload + salt)) return null;
            return decode(payload);
          } catch { return null; }
        }
        const legacy = disk.getItem(key);
        if (legacy !== null) {
          // Remove the readable copy only after the encoded save succeeds.
          write(key, legacy);
          disk.removeItem(key);
        }
        return legacy;
      },
      setItem(key, value) {
        write(key, value);
        disk.removeItem(key);
      },
    };
  })();

  const W = 900;
  const H = 560;
  const canvas = document.querySelector('#game');
  const ctx = canvas.getContext('2d');
  const $ = (id) => document.getElementById(id);
  const defaults = { up: 'w', down: 's', left: 'a', right: 'd', boost: ' ', pause: 'escape' };
  const difficulties = {
    easy: { name: 'Easy', hazardSpeed: 0.78, spawnRate: 0.72, energyReward: 0.6 },
    normal: { name: 'Normal', hazardSpeed: 1, spawnRate: 1, energyReward: 1 },
    hard: { name: 'Hard', hazardSpeed: 1.65, spawnRate: 1.65, energyReward: 2.25 },
    insane: { name: 'Insane', hazardSpeed: 2.322, spawnRate: 2.9, energyReward: 6 },
  };
  const abilities = {
    overdrive: { name: 'Overdrive', icon: '»', cost: 0, duration: 2000, cooldown: 15000, description: 'More than doubles your movement speed for 2 seconds.' },
    shield: { name: 'Phase Shield', icon: '◇', cost: 80, duration: 2200, cooldown: 18000, description: 'Pass safely through debris for 2.2 seconds.' },
    magnet: { name: 'Energy Magnet', icon: '⊕', cost: 120, duration: 5000, cooldown: 18000, description: 'Pulls nearby energy cells toward your ship for 5 seconds.' },
    warp: { name: 'Time Warp', icon: '◷', cost: 175, duration: 3000, cooldown: 20000, description: 'Slows the entire debris field for 3 seconds.' },
    repulsor: { name: 'Repulsor Burst', icon: '✦', cost: 260, duration: 1000, cooldown: 22000, description: 'Vaporizes nearby debris and converts each hit into score.' },
    surge: { name: 'Score Surge', icon: '×3', cost: 360, duration: 5000, cooldown: 25000, description: 'Multiplies your purchased score multiplier by 3 for 5 seconds.' },
    quantum: { name: 'Quantum Shift', icon: '⬡', cost: 500, duration: 3500, cooldown: 30000, description: 'Gain invulnerability and 1.7× movement speed for 3.5 seconds.' },
  };
  const abilityColors = { overdrive: '#20e7cf', shield: '#66a8ff', warp: '#ed4eff', magnet: '#f7d756', repulsor: '#ff6179', surge: '#ff9e45', quantum: '#a98cff' };
  const skins = {
    neon: { name: 'Neon', icon: '▲', color: '#20e7cf', core: '#d9fffa', cost: 0 },
    razor: { name: 'Razor', icon: '◆', color: '#ed4eff', core: '#ffe1ff', cost: 0 },
    solar: { name: 'Solar', icon: '✦', color: '#f7d756', core: '#fff8be', cost: 0 },
    ghost: { name: 'Ghost', icon: '◇', color: '#66a8ff', core: '#e4f1ff', cost: 0 },
    void: { name: 'Void', icon: '⌄', color: '#a98cff', core: '#eee7ff', cost: 0 },
    nova: { name: 'Nova', icon: '✹', color: '#ff7548', secondary: '#f7d756', core: '#fff0d8', cost: 5 },
    glitch: { name: 'Glitch', icon: '⌁', color: '#1df6ff', secondary: '#ed4eff', core: '#ffffff', cost: 10 },
    eclipse: { name: 'Eclipse', icon: '◉', color: '#ff355d', secondary: '#a98cff', core: '#160a20', cost: 15 },
    aurora: { name: 'Aurora', icon: '∞', color: '#79ff8a', secondary: '#6ac7ff', core: '#ffffff', cost: 20 },
    royal: { name: 'Royal', icon: '♛', color: '#f7d756', secondary: '#ff9e45', core: '#fff8be', cost: 25 },
  };
  const trails = {
    pulse: { name: 'Pulse', icon: '━', color: '#20e7cf', cost: 0, description: 'The classic clean neon wake.' },
    lightning: { name: 'Lightning', icon: 'ϟ', color: '#9ffff5', cost: 18, description: 'A sharp, crackling electric bolt.' },
    fire: { name: 'Solar Fire', icon: '♨', color: '#ff7548', cost: 24, description: 'Hot orange plasma with a golden core.' },
    glitch: { name: 'Glitch', icon: '⌁', color: '#ed4eff', cost: 30, description: 'Broken cyan and magenta signal fragments.' },
    rainbow: { name: 'Prism', icon: '◒', color: '#f7d756', cost: 36, description: 'A constantly shifting spectrum trail.' },
    void: { name: 'Void', icon: '●', color: '#9a62ff', cost: 45, description: 'Dark gravity wake with violet edges.' },
  };
  const dailyMissions = [
    { id: 'collector', name: 'Danger Collector', goal: 20, reward: 30, description: 'Collect 20 pickups on Hard or Insane.' },
    { id: 'survivor', name: 'Stay in the Drift', goal: 90, reward: 35, description: 'Survive for 90 seconds in one day.' },
    { id: 'combo', name: 'Chain Reaction', goal: 12, reward: 25, description: 'Reach a 12-hit combo.' },
  ];
  const multiplierTiers = [
    { value: 1.25, cost: 2500 }, { value: 1.5, cost: 6000 }, { value: 1.75, cost: 12000 },
    { value: 2, cost: 25000 }, { value: 4, cost: 75000 }, { value: 5, cost: 150000 },
  ];
  const scoreMultiplierTiers = [
    { value: 1.25, cost: 15 }, { value: 1.5, cost: 30 }, { value: 1.75, cost: 50 },
    { value: 2, cost: 80 }, { value: 4, cost: 180 }, { value: 5, cost: 320 },
  ];
  const pilotLevelThresholds = [
    100, 500, 1000, 2000, 3500, 5000, 7500, 10000, 15000, 20000,
    26000, 33000, 41000, 50000, 60000, 72000, 85000, 100000, 120000, 150000,
    185000, 225000, 270000, 320000, 380000, 450000, 530000, 620000, 720000, 850000,
  ];
  const achievements = [
    { id: 'played', name: 'You Played!', description: 'Launch your first run.', points: 0, icon: '▶' },
    { id: 'p1000', name: "Let's Get Started!", description: 'Earn 1,000 lifetime points.', points: 1000, icon: 'Ⅰ' },
    { id: 'p2000', name: 'Picking Up Speed', description: 'Earn 2,000 lifetime points.', points: 2000, icon: 'Ⅱ' },
    { id: 'p3000', name: 'Star Runner', description: 'Earn 3,000 lifetime points.', points: 3000, icon: 'Ⅲ' },
    { id: 'p4000', name: 'Locked In', description: 'Earn 4,000 lifetime points.', points: 4000, icon: 'Ⅳ' },
    { id: 'p5000', name: 'Halfway There', description: 'Earn 5,000 lifetime points.', points: 5000, icon: 'Ⅴ' },
    { id: 'p6000', name: 'Cosmic Rhythm', description: 'Earn 6,000 lifetime points.', points: 6000, icon: 'Ⅵ' },
    { id: 'p7000', name: 'Debris Dancer', description: 'Earn 7,000 lifetime points.', points: 7000, icon: 'Ⅶ' },
    { id: 'p8000', name: 'Neon Veteran', description: 'Earn 8,000 lifetime points.', points: 8000, icon: 'Ⅷ' },
    { id: 'p9000', name: 'Almost Legendary', description: 'Earn 9,000 lifetime points.', points: 9000, icon: 'Ⅸ' },
    { id: 'p10000', name: 'Five Digits!', description: 'Earn 10,000 lifetime points.', points: 10000, icon: '★' },
    { id: 'p12500', name: 'Deep Space Ace', description: 'Earn 12,500 lifetime points.', points: 12500, icon: '✦' },
    { id: 'p15000', name: 'Untouchable', description: 'Earn 15,000 lifetime points.', points: 15000, icon: '◆' },
    { id: 'p17500', name: 'Beyond the Limit', description: 'Earn 17,500 lifetime points.', points: 17500, icon: '∞' },
    { id: 'p20000', name: 'Neon Legend', description: 'Earn 20,000 lifetime points.', points: 20000, icon: '♛' },
    { id: 'level1', name: 'Pilot Initiate', description: 'Reach pilot level 1.', level: 1, icon: 'L1' },
    { id: 'level3', name: 'Proven Drifter', description: 'Reach pilot level 3.', level: 3, icon: 'L3' },
    { id: 'level5', name: 'Sector Specialist', description: 'Reach pilot level 5.', level: 5, icon: 'L5' },
    { id: 'level7', name: 'Elite Navigator', description: 'Reach pilot level 7.', level: 7, icon: 'L7' },
    { id: 'level10', name: 'Master of the Drift', description: 'Reach pilot level 10.', level: 10, icon: 'L10' },
    { id: 'level15', name: 'Void Commander', description: 'Reach pilot level 15.', level: 15, icon: 'L15' },
    { id: 'level20', name: 'Ascended Pilot', description: 'Reach pilot level 20.', level: 20, icon: 'L20' },
    { id: 'level22', name: 'Rift Breaker', description: 'Reach pilot level 22.', level: 22, icon: 'L22' },
    { id: 'level25', name: 'Neon Vanguard', description: 'Reach pilot level 25.', level: 25, icon: 'L25' },
    { id: 'level27', name: 'Beyond Velocity', description: 'Reach pilot level 27.', level: 27, icon: 'L27' },
    { id: 'level30', name: 'Drift Transcendent', description: 'Reach the maximum pilot level.', level: 30, icon: 'L30' },
  ];

  const ui = {
    score: $('score'), energy: $('energy'), level: $('level'), best: $('best'), playerLevel: $('playerLevel'),
    pilotProgress: $('pilotProgress'), pilotProgressFill: $('pilotProgressFill'), pilotProgressCurrent: $('pilotProgressCurrent'),
    pilotProgressNext: $('pilotProgressNext'), pilotProgressText: $('pilotProgressText'),
    overlay: $('overlay'), pause: $('pause'), ability: $('ability'), abilityFill: $('abilityFill'),
    abilityText: $('abilityText'), eyebrow: $('eyebrow'), title: $('title'), copy: $('copy'),
    final: $('final'), finalScore: $('finalScore'), action: $('action'), hints: $('hints'),
    settingsButton: $('settingsButton'), settingsModal: $('settingsModal'), closeSettings: $('closeSettings'),
    masterVolume: $('masterVolume'), musicVolume: $('musicVolume'), sfxVolume: $('sfxVolume'),
    masterValue: $('masterValue'), musicValue: $('musicValue'), sfxValue: $('sfxValue'),
    resetKeys: $('resetKeys'), creditsButton: $('creditsButton'), creditsReveal: $('creditsReveal'),
    menuButtons: $('menuButtons'), shopButton: $('shopButton'), skinsButton: $('skinsButton'), trailsButton: $('trailsButton'), missionsButton: $('missionsButton'), mainMenuButton: $('mainMenuButton'),
    shopModal: $('shopModal'), closeShop: $('closeShop'), shopBalance: $('shopBalance'), shopItems: $('shopItems'),
    skinsModal: $('skinsModal'), closeSkins: $('closeSkins'), skinBalance: $('skinBalance'),
    freeSkinItems: $('freeSkinItems'), premiumSkinItems: $('premiumSkinItems'),
    trailsModal: $('trailsModal'), closeTrails: $('closeTrails'), trailBalance: $('trailBalance'), trailItems: $('trailItems'),
    missionsModal: $('missionsModal'), closeMissions: $('closeMissions'), missionDate: $('missionDate'), missionItems: $('missionItems'),
    multiplierItems: $('multiplierItems'), pointsBalance: $('pointsBalance'), scoreMultiplierItems: $('scoreMultiplierItems'),
    achievementsButton: $('achievementsButton'), achievementsModal: $('achievementsModal'), closeAchievements: $('closeAchievements'),
    lifetimePoints: $('lifetimePoints'), achievementLevel: $('achievementLevel'), achievementList: $('achievementList'),
    achievementToast: $('achievementToast'), achievementToastName: $('achievementToastName'),
    levelUpCelebration: $('levelUpCelebration'), levelUpNumber: $('levelUpNumber'), levelUpCaption: $('levelUpCaption'),
    resetAchievements: $('resetAchievements'), resetConfirm: $('resetConfirm'), cancelReset: $('cancelReset'), confirmReset: $('confirmReset'),
    difficultyPicker: $('difficultyPicker'), difficultyReward: $('difficultyReward'), difficultyBadge: $('difficultyBadge'),
  };

  function loadJSON(key, fallback) {
    try { return { ...fallback, ...JSON.parse(localStorage.getItem(key) || '{}') }; }
    catch { return { ...fallback }; }
  }

  let bindings = loadJSON('neon-drift-bindings', defaults);
  let mix = loadJSON('neon-drift-mix', { master: 80, music: 100, sfx: 75 });
  if (!localStorage.getItem('neon-drift-music-100-v1')) {
    mix.music = 100;
    localStorage.setItem('neon-drift-mix', JSON.stringify(mix));
    localStorage.setItem('neon-drift-music-100-v1', 'done');
  }
  const keys = new Set();
  let status = 'ready';
  let settingsOpen = false;
  let shopOpen = false;
  let skinsOpen = false;
  let trailsOpen = false;
  let missionsOpen = false;
  let achievementsOpen = false;
  let waitingBind = null;
  let last = performance.now();
  let pausedAt = 0;
  let best = +(localStorage.getItem('neon-drift-best') || 0);
  let wallet = +(localStorage.getItem('neon-drift-energy') || 0);
  let pointsWallet = +(localStorage.getItem('neon-drift-points') || 0);
  const advancementsWereReset = localStorage.getItem('neon-drift-advancements-reset') === 'yes';
  let lifetimePoints = advancementsWereReset
    ? +(localStorage.getItem('neon-drift-lifetime-points') || 0)
    : Math.max(+(localStorage.getItem('neon-drift-lifetime-points') || 0), pointsWallet, best);
  let unlockedAchievements = new Set();
  try { JSON.parse(localStorage.getItem('neon-drift-achievements') || '[]').forEach((id) => unlockedAchievements.add(id)); } catch {}
  let toastQueue = [];
  let toastActive = false;
  let levelUpTimer = null;
  let energyMultiplier = +(localStorage.getItem('neon-drift-multiplier') || 1);
  if (![1, ...multiplierTiers.map((tier) => tier.value)].includes(energyMultiplier)) energyMultiplier = 1;
  let scoreMultiplier = +(localStorage.getItem('neon-drift-score-multiplier') || 1);
  if (![1, ...scoreMultiplierTiers.map((tier) => tier.value)].includes(scoreMultiplier)) scoreMultiplier = 1;
  let unlocked = new Set(['overdrive']);
  try { JSON.parse(localStorage.getItem('neon-drift-abilities') || '[]').forEach((id) => unlocked.add(id)); } catch {}
  let equipped = localStorage.getItem('neon-drift-equipped') || 'overdrive';
  if (!abilities[equipped] || !unlocked.has(equipped)) equipped = 'overdrive';
  let unlockedSkins = new Set(Object.entries(skins).filter(([, skin]) => skin.cost === 0).map(([id]) => id));
  try { JSON.parse(localStorage.getItem('neon-drift-skins') || '[]').forEach((id) => { if (skins[id]) unlockedSkins.add(id); }); } catch {}
  let equippedSkin = localStorage.getItem('neon-drift-skin') || 'neon';
  if (!skins[equippedSkin] || !unlockedSkins.has(equippedSkin)) equippedSkin = 'neon';
  let unlockedTrails = new Set(['pulse']);
  try { JSON.parse(localStorage.getItem('neon-drift-trails') || '[]').forEach((id) => { if (trails[id]) unlockedTrails.add(id); }); } catch {}
  let equippedTrail = localStorage.getItem('neon-drift-trail') || 'pulse';
  if (!trails[equippedTrail] || !unlockedTrails.has(equippedTrail)) equippedTrail = 'pulse';
  const dailyKey = new Date().toLocaleDateString('en-CA');
  let dailyState;
  try { dailyState = JSON.parse(localStorage.getItem('neon-drift-daily') || 'null'); } catch { dailyState = null; }
  if (!dailyState || dailyState.date !== dailyKey) dailyState = { date: dailyKey, progress: { collector: 0, survivor: 0, combo: 0 }, claimed: [] };
  dailyState.progress = { collector: 0, survivor: 0, combo: 0, ...(dailyState.progress || {}) };
  if (!Array.isArray(dailyState.claimed)) dailyState.claimed = [];
  let difficulty = localStorage.getItem('neon-drift-difficulty') || 'normal';
  if (!difficulties[difficulty]) difficulty = 'normal';
  let audio = null;
  let musicStep = 0;
  let musicCycle = 0;
  let musicTimer = null;
  let musicMode = 'menu';
  let musicNotes = [];
  let musicTransitionTimer = null;
  const menuHideTimers = new WeakMap();

  function revealMenu(element) {
    const pending = menuHideTimers.get(element);
    if (pending) clearTimeout(pending);
    menuHideTimers.delete(element); element.classList.remove('menu-closing'); element.hidden = false;
  }

  function concealMenu(element, onHidden) {
    if (element.hidden || element.classList.contains('menu-closing')) return;
    element.classList.add('menu-closing');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = setTimeout(() => {
      element.hidden = true; element.classList.remove('menu-closing'); menuHideTimers.delete(element);
      if (onHidden) onHidden();
    }, reducedMotion ? 0 : 220);
    menuHideTimers.set(element, timer);
  }

  function fresh() {
    return {
      player: { x: W / 2, y: H - 82, r: 18, angle: 0, vx: 0, vy: 0 }, rocks: [], orbs: [], debrisBursts: [], trail: [], effects: [],
      score: 0, progress: 0, energy: 0, level: 1, lastRock: 0, lastOrb: 0,
      boostUntil: 0, boostReadyAt: 0, pickupSlowUntil: 0, lastTrail: 0, shakeUntil: 0, shakeStrength: 0, flashUntil: 0,
      combo: 0, comboExpiresAt: 0, bossSectors: [], elapsedMs: 0, lastMissionSecond: 0,
    };
  }

  let state = fresh();
  let lastShownPilotLevel = getPilotLevel();
  ui.best.textContent = pad(best);
  ui.energy.textContent = energyText(wallet);
  ui.pointsBalance.textContent = Math.floor(pointsWallet).toLocaleString();

  function pad(number) { return Math.floor(number).toString().padStart(5, '0'); }
  function energyText(number) { return Number.isInteger(number) ? String(number) : number.toFixed(2).replace(/0+$/, '').replace(/\.$/, ''); }
  function getPilotLevel(points = lifetimePoints) {
    return pilotLevelThresholds.reduce((level, threshold) => level + (points >= threshold ? 1 : 0), 0);
  }
  function effectiveScoreMultiplier(time = performance.now()) {
    const surgeMultiplier = equipped === 'surge' && time < state.boostUntil ? 3 : 1;
    return scoreMultiplier * surgeMultiplier;
  }
  function comboMultiplier() { return 1 + Math.min(2, Math.floor(state.combo / 4) * 0.25); }
  function saveDaily() { localStorage.setItem('neon-drift-daily', JSON.stringify(dailyState)); }
  function advanceMission(id, amount) {
    const mission = dailyMissions.find((item) => item.id === id);
    if (!mission || dailyState.claimed.includes(id)) return;
    dailyState.progress[id] = Math.min(mission.goal, Math.max(dailyState.progress[id] || 0, amount));
    saveDaily();
  }
  function incrementCombo(time, amount = 1) {
    state.combo = time < state.comboExpiresAt ? state.combo + amount : amount;
    state.comboExpiresAt = time + 3600;
    advanceMission('combo', state.combo);
  }
  function spawnBossWave(time) {
    const gap = 2 + Math.floor(Math.random() * 5);
    for (let column = 0; column < 9; column += 1) {
      if (column === gap || column === gap + 1) continue;
      state.rocks.push({
        x: 50 + column * 100, y: -72 - Math.abs(column - gap) * 9, r: 31,
        speed: 2.9 + state.level * 0.16, vx: Math.sin(column * 1.7) * 0.42,
        spin: (column % 2 ? 1 : -1) * 0.045, angle: 0, born: time, boss: true, nearMissed: false,
      });
    }
    state.effects.push({ x: W / 2, y: 105, started: time, duration: 1250, color: '#ed4eff', text: `SECTOR ${state.level} · BOSS WAVE`, sparks: [] });
    state.shakeUntil = time + 280; state.shakeStrength = 5;
  }
  function keyName(key) {
    const names = { ' ': 'SPACE', escape: 'ESC', arrowup: '↑', arrowdown: '↓', arrowleft: '←', arrowright: '→' };
    return names[key] || key.toUpperCase();
  }

  function ensureAudio() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!audio) {
      const ac = new AC();
      const master = ac.createGain();
      const music = ac.createGain();
      const sfx = ac.createGain();
      const warmth = ac.createBiquadFilter();
      warmth.type = 'lowpass';
      warmth.frequency.value = 3200;
      music.connect(warmth).connect(master);
      sfx.connect(master);
      master.connect(ac.destination);
      audio = { ac, master, music, sfx };
      applyMix();
      musicTimer = window.setInterval(playMusicStep, 326);
    }
    if (audio.ac.state === 'suspended') audio.ac.resume();
  }

  function applyMix() {
    if (!audio) return;
    const curve = (value) => Math.pow(value / 100, 1.7);
    audio.master.gain.setTargetAtTime(curve(mix.master), audio.ac.currentTime, 0.03);
    audio.music.gain.setTargetAtTime(curve(mix.music) * 0.85, audio.ac.currentTime, 0.03);
    audio.sfx.gain.setTargetAtTime(curve(mix.sfx), audio.ac.currentTime, 0.03);
  }

  function voice(frequency, start, duration, options = {}) {
    if (!audio) return;
    const { ac, music } = audio;
    const oscillator = ac.createOscillator();
    const filter = ac.createBiquadFilter();
    const gain = ac.createGain();
    const wave = options.wave || 'sine';
    const volume = options.volume || 0.03;
    const attack = options.attack || 0.01;
    const cutoff = options.cutoff || 1800;
    const cutoffEnd = options.cutoffEnd || cutoff;
    oscillator.type = wave;
    oscillator.frequency.value = frequency;
    oscillator.detune.value = (options.detune || 0) + (-2 + Math.random() * 4);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, start);
    if (cutoffEnd !== cutoff) filter.frequency.exponentialRampToValueAtTime(cutoffEnd, start + duration * 0.75);
    filter.Q.value = options.q || 1.1;
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + attack);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    oscillator.connect(filter).connect(gain).connect(music);
    musicNotes.push(oscillator);
    oscillator.onended = () => { musicNotes = musicNotes.filter((note) => note !== oscillator); };
    oscillator.start(start);
    oscillator.stop(start + duration + 0.03);
    return oscillator;
  }

  function electricKey(frequency, start, duration, volume = 0.035) {
    voice(frequency, start, duration, { wave: 'sine', volume, attack: 0.025, cutoff: 1900 });
    voice(frequency * 2.005, start + 0.008, duration * 0.72, { wave: 'triangle', volume: volume * 0.19, attack: 0.015, cutoff: 2400, detune: 4 });
  }

  function pluck(frequency, start, volume = 0.025) {
    voice(frequency, start, 0.29, { wave: 'square', volume, attack: 0.004, cutoff: 2600, cutoffEnd: 340, q: 2.8 });
    voice(frequency * 2, start, 0.17, { wave: 'triangle', volume: volume * 0.28, attack: 0.003, cutoff: 3200, cutoffEnd: 600 });
  }

  function bass(frequency, start, duration = 0.42, volume = 0.055) {
    voice(frequency, start, duration, { wave: 'triangle', volume, attack: 0.008, cutoff: 620, cutoffEnd: 180, q: 1.5 });
  }

  function padVoice(frequency, start, duration = 4.8, volume = 0.026) {
    voice(frequency, start, duration, { wave: 'sawtooth', volume, attack: 0.34, cutoff: 520, cutoffEnd: 290, detune: -8, q: 1.8 });
    voice(frequency, start + 0.02, duration * 0.96, { wave: 'sawtooth', volume: volume * 0.8, attack: 0.38, cutoff: 470, cutoffEnd: 260, detune: 8, q: 1.6 });
  }

  function bell(frequency, start, duration = 0.9, volume = 0.022) {
    voice(frequency, start, duration, { wave: 'sine', volume, attack: 0.004, cutoff: 4800 });
    voice(frequency * 2.01, start + 0.006, duration * 0.58, { wave: 'sine', volume: volume * 0.38, attack: 0.003, cutoff: 5600 });
  }

  function shopStab(frequency, start, minor = false) {
    const third = minor ? 1.189 : 1.25;
    [1, third, 1.5, 1.875].forEach((ratio, index) => {
      voice(frequency * ratio * 2, start + index * 0.008, 0.24, { wave: 'sawtooth', volume: index ? 0.009 : 0.015, attack: 0.003, cutoff: 2800, cutoffEnd: 420, q: 3.8 });
    });
  }

  function coinLead(frequency, start, accent = false) {
    pluck(frequency, start, accent ? 0.027 : 0.018);
    bell(frequency * 2, start + 0.012, accent ? 0.62 : 0.4, accent ? 0.014 : 0.009);
  }

  function stopMusicNotes() {
    musicNotes.forEach((note) => { try { note.stop(); } catch {} });
    musicNotes = [];
  }

  function kick(start, volume = 0.12) {
    if (!audio) return;
    const { ac, music } = audio;
    const oscillator = ac.createOscillator();
    const gain = ac.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(120, start);
    oscillator.frequency.exponentialRampToValueAtTime(46, start + 0.14);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.18);
    oscillator.connect(gain).connect(music);
    oscillator.start(start); oscillator.stop(start + 0.2);
  }

  function softHat(start, volume = 0.018) {
    if (!audio) return;
    const { ac, music } = audio;
    const length = Math.floor(ac.sampleRate * 0.045);
    const buffer = ac.createBuffer(1, length, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = ac.createBufferSource();
    const filter = ac.createBiquadFilter();
    const gain = ac.createGain();
    source.buffer = buffer;
    filter.type = 'highpass'; filter.frequency.value = 4300;
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.045);
    source.connect(filter).connect(gain).connect(music);
    source.start(start);
  }

  function snare(start, volume = 0.04) {
    if (!audio) return;
    const { ac, music } = audio;
    const length = Math.floor(ac.sampleRate * 0.13);
    const buffer = ac.createBuffer(1, length, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
    const source = ac.createBufferSource();
    const filter = ac.createBiquadFilter();
    const gain = ac.createGain();
    source.buffer = buffer;
    filter.type = 'bandpass'; filter.frequency.value = 1450; filter.Q.value = 0.7;
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.13);
    source.connect(filter).connect(gain).connect(music);
    source.start(start);
  }

  function playMusicStep() {
    if (!audio || audio.ac.state !== 'running') return;
    const now = audio.ac.currentTime + 0.015;
    if (musicMode === 'menu') {
      const roots = [261.63, 220, 174.61, 196];
      const root = roots[Math.floor(musicStep / 8) % roots.length];
      const melodySets = [[2, 6, 10, 14, 21, 26], [3, 7, 12, 18, 23, 29], [2, 5, 11, 15, 22, 30]];
      const melody = melodySets[musicCycle % melodySets.length];
      if (musicStep % 8 === 0) {
        electricKey(root / 2, now, 2.5, 0.024);
        electricKey(root, now + 0.035, 2.35, 0.042);
        electricKey(root * 1.25, now + 0.07, 2.2, 0.028);
        electricKey(root * 1.5, now + 0.1, 2.05, 0.024);
      }
      if (melody.includes(musicStep)) bell(root * ([2, 2.25, 2.5][(musicStep + musicCycle) % 3]), now, 0.72, 0.018);
      if (musicStep % 8 === 0) kick(now, 0.055);
      if (musicStep % 2 === 1) softHat(now + 0.02, musicStep % 8 === 7 ? 0.012 : 0.006);
    } else if (musicMode === 'shop') {
      const roots = [130.81, 110, 146.83, 98];
      const root = roots[Math.floor(musicStep / 8) % roots.length];
      const beat = musicStep % 8;
      const shopArps = [
        [1, 1.5, 2, 2.5, 2, 1.5, 1.25, 2],
        [1, 2, 1.5, 2.5, 1.25, 1.5, 2.25, 2],
        [1, 1.25, 1.5, 2, 2.5, 2.25, 1.5, 2],
        [1, 1.5, 2.5, 2, 1.25, 2.25, 1.5, 3],
      ];
      const bassPatterns = [[0, 3, 6], [0, 2, 5, 7], [0, 3, 5], [0, 2, 4, 7]];
      const variation = musicCycle % shopArps.length;
      if (beat === 0 || beat === 6) shopStab(root, now, Math.floor(musicStep / 8) % 2 === 1);
      if (bassPatterns[variation].includes(beat)) bass(root, now, beat === 0 ? 0.52 : 0.3, beat === 0 ? 0.052 : 0.038);
      coinLead(root * shopArps[variation][beat] * 2, now + (beat % 2 ? 0.025 : 0), beat === 0 || beat === 7);
      if ([0, 3, 6].includes(beat)) kick(now, beat === 0 ? 0.095 : 0.068);
      if (beat === 4) snare(now, 0.043);
      if (beat % 2 === 1) softHat(now, beat === 7 ? 0.018 : 0.009);
      if (musicStep === 30 && variation === 3) { softHat(now + 0.1, 0.014); softHat(now + 0.2, 0.018); }
      if (musicStep === 31 && musicCycle % 2 === 1) bell(root * 8, now, 0.75, 0.02);
    } else if (musicMode === 'gameover') {
      const roots = musicCycle % 2 ? [73.42, 65.41] : [82.41, 73.42];
      const root = roots[Math.floor(musicStep / 16) % roots.length];
      const chimes = musicCycle % 2 ? [5, 13, 22, 29] : [6, 15, 20, 27];
      if (musicStep % 16 === 0) {
        padVoice(root, now, 5.05, 0.034);
        padVoice(root * 1.189, now + 0.1, 4.8, 0.025);
        padVoice(root * 1.5, now + 0.18, 4.55, 0.022);
      }
      if (musicStep % 8 === 0) bass(root / 2, now, 1.2, 0.036);
      if (chimes.includes(musicStep)) bell(root * ([2, 1.782, 1.5][(musicStep + musicCycle) % 3]), now, 1.45, 0.019);
      if (musicStep % 8 === 7) softHat(now, 0.004);
    } else {
      const roots = [110, 146.83, 98, 130.81];
      const root = roots[Math.floor(musicStep / 8) % roots.length];
      const arps = [[1, 1.5, 2, 1.25, 1.5, 2.25, 2, 1.5], [1, 1.25, 1.5, 2, 1.5, 2.5, 2.25, 1.5], [1, 2, 1.5, 2.25, 1.25, 1.5, 2, 2.5]];
      const arp = arps[musicCycle % arps.length];
      if (musicStep % 8 === 0) {
        electricKey(root * 2, now, 1.7, 0.018);
        electricKey(root * 2.5, now + 0.025, 1.55, 0.012);
      }
      pluck(root * arp[musicStep % 8] * 2, now, musicStep % 4 === 0 ? 0.034 : 0.022);
      if (musicStep % 2 === 0) { bass(root, now, 0.42, 0.055); kick(now, 0.12); }
      if (musicStep % 8 === 4) snare(now, 0.052);
      softHat(now + 0.02, musicStep % 4 === 3 ? 0.027 : 0.012);
    }
    musicStep++;
    if (musicStep >= 32) { musicStep = 0; musicCycle++; }
  }

  function setMusicMode(mode) {
    if (musicTransitionTimer) {
      clearTimeout(musicTransitionTimer);
      musicTransitionTimer = null;
    }
    musicMode = mode;
    musicStep = 0;
    musicCycle = 0;
    stopMusicNotes();
    if (audio) {
      const target = Math.pow(mix.music / 100, 1.7) * 0.85;
      const now = audio.ac.currentTime;
      audio.music.gain.cancelScheduledValues(now);
      audio.music.gain.setTargetAtTime(target, now, 0.04);
    }
    playMusicStep();
  }

  function transitionMusicMode(mode, duration = 900) {
    if (!audio || musicMode === mode) return;
    if (musicTransitionTimer) clearTimeout(musicTransitionTimer);
    const { ac, music } = audio;
    const now = ac.currentTime;
    const half = duration / 2000;
    const target = Math.pow(mix.music / 100, 1.7) * 0.85;
    music.gain.cancelScheduledValues(now);
    music.gain.setValueAtTime(Math.max(0.0001, music.gain.value), now);
    music.gain.exponentialRampToValueAtTime(0.0001, now + half);
    musicTransitionTimer = setTimeout(() => {
      musicMode = mode;
      musicStep = 0;
      musicCycle = 0;
      stopMusicNotes();
      const switchTime = ac.currentTime;
      music.gain.cancelScheduledValues(switchTime);
      music.gain.setValueAtTime(target, switchTime);
      playMusicStep();
      musicTransitionTimer = null;
    }, duration / 2);
  }

  function playGameOverMusic() {
    ensureAudio();
    if (audio) setMusicMode('gameover');
  }

  function tone(kind) {
    ensureAudio();
    if (!audio) return;
    const { ac, sfx } = audio;
    const oscillator = ac.createOscillator();
    const gain = ac.createGain();
    oscillator.type = kind === 'orb' ? 'sine' : 'sawtooth';
    oscillator.frequency.setValueAtTime(kind === 'orb' ? 620 : 130, ac.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(kind === 'orb' ? 980 : 55, ac.currentTime + 0.14);
    gain.gain.setValueAtTime(0.08, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.16);
    oscillator.connect(gain).connect(sfx);
    oscillator.start(); oscillator.stop(ac.currentTime + 0.16);
  }

  function start() {
    ensureAudio();
    setMusicMode('game');
    unlockAchievement('played');
    state = fresh(); status = 'playing';
    concealMenu(ui.overlay); ui.pause.hidden = false; ui.ability.hidden = false;
    updateUI(); updateAbility(performance.now());
  }

  function pause() {
    if (status !== 'playing') return;
    status = 'paused'; pausedAt = performance.now(); keys.clear();
    ui.pause.hidden = true; ui.ability.hidden = true;
    show('FLIGHT SUSPENDED', 'Take a breath.', 'The debris field will wait. Your score is safe.', '▶ &nbsp; RESUME', false);
    ui.menuButtons.hidden = true; ui.difficultyPicker.hidden = true;
  }

  function resume() {
    const now = performance.now();
    const shift = pausedAt ? now - pausedAt : 0;
    if (state.boostUntil > pausedAt) state.boostUntil += shift;
    if (state.boostReadyAt > pausedAt) state.boostReadyAt += shift;
    if (state.pickupSlowUntil > pausedAt) state.pickupSlowUntil += shift;
    if (state.comboExpiresAt > pausedAt) state.comboExpiresAt += shift;
    status = 'playing'; pausedAt = 0;
    concealMenu(ui.overlay); ui.pause.hidden = false; ui.ability.hidden = false;
  }

  function gameOver() {
    const impactTime = performance.now();
    state.shakeUntil = impactTime + 420; state.shakeStrength = 11;
    state.effects.push({
      x: state.player.x, y: state.player.y, started: impactTime, duration: 900, color: '#ff6179', text: 'SIGNAL LOST',
      sparks: Array.from({ length: 22 }, (_, index) => ({ angle: index / 22 * Math.PI * 2 + Math.random() * 0.2, speed: 50 + Math.random() * 90, size: 2 + Math.random() * 4 })),
    });
    state.combo = 0; status = 'over'; ui.ability.hidden = true; ui.pause.hidden = true; keys.clear(); tone('crash'); playGameOverMusic();
    const score = Math.floor(state.score);
    const previousPilotLevel = lastShownPilotLevel;
    best = Math.max(best, score);
    pointsWallet += score;
    lifetimePoints += score;
    const newPilotLevel = getPilotLevel();
    localStorage.setItem('neon-drift-best', best);
    localStorage.setItem('neon-drift-points', pointsWallet);
    localStorage.setItem('neon-drift-lifetime-points', lifetimePoints);
    checkAchievements();
    updateUI();
    if (newPilotLevel > previousPilotLevel) {
      showLevelUpAnimation(previousPilotLevel, newPilotLevel);
      lastShownPilotLevel = newPilotLevel;
    }
    ui.best.textContent = pad(best); ui.finalScore.textContent = pad(score);
    show('SIGNAL LOST', 'Drift ended.', `Banked ${score.toLocaleString()} points and ${energyText(state.energy)} energy from this run.`, '↻ &nbsp; TRY AGAIN', true);
    ui.menuButtons.hidden = false; ui.difficultyPicker.hidden = true; ui.shopButton.hidden = true; ui.skinsButton.hidden = true; ui.trailsButton.hidden = true; ui.missionsButton.hidden = true; ui.achievementsButton.hidden = true; ui.mainMenuButton.hidden = false;
  }

  function returnToMenu() {
    const returningFromDeath = status === 'over';
    const finishReturn = () => {
      status = 'ready'; state = fresh(); keys.clear(); setMusicMode('menu');
      ui.pause.hidden = true; ui.ability.hidden = true; revealMenu(ui.overlay);
      ui.eyebrow.textContent = 'ARCADE SURVIVAL / 01'; ui.eyebrow.classList.remove('danger');
      ui.title.innerHTML = 'Thread the<br><em>impossible.</em>';
      ui.copy.textContent = 'Dodge the debris. Grab the gold energy. Stay alive as the drift accelerates.';
      ui.action.querySelector('span').innerHTML = '▶ &nbsp; LAUNCH RUN';
      ui.final.hidden = true; ui.hints.hidden = false; ui.menuButtons.hidden = false;
      ui.difficultyPicker.hidden = false; ui.shopButton.hidden = false; ui.skinsButton.hidden = false; ui.trailsButton.hidden = false; ui.missionsButton.hidden = false; ui.achievementsButton.hidden = false; ui.mainMenuButton.hidden = true; updateUI();
    };
    if (returningFromDeath) concealMenu(ui.overlay, finishReturn);
    else finishReturn();
  }

  function show(eyebrow, title, copy, button, final) {
    ui.eyebrow.textContent = eyebrow; ui.eyebrow.classList.toggle('danger', final);
    ui.title.innerHTML = title; ui.copy.textContent = copy;
    ui.action.querySelector('span').innerHTML = button;
    ui.final.hidden = !final; ui.hints.hidden = true; revealMenu(ui.overlay);
  }

  function updateUI() {
    ui.score.textContent = pad(state.score); ui.energy.textContent = energyText(wallet); ui.level.textContent = state.level;
    ui.shopBalance.textContent = energyText(wallet);
    ui.pointsBalance.textContent = Math.floor(pointsWallet).toLocaleString();
    const liveRunPoints = status === 'playing' || status === 'paused' ? Math.floor(state.score) : 0;
    const displayedLifetimePoints = lifetimePoints + liveRunPoints;
    const pilotLevel = getPilotLevel(displayedLifetimePoints);
    const maxLevel = pilotLevelThresholds.length;
    const previousThreshold = pilotLevel === 0 ? 0 : pilotLevelThresholds[pilotLevel - 1];
    const nextThreshold = pilotLevelThresholds[pilotLevel];
    const levelProgress = nextThreshold
      ? Math.max(0, Math.min(1, (displayedLifetimePoints - previousThreshold) / (nextThreshold - previousThreshold)))
      : 1;
    ui.playerLevel.textContent = pilotLevel;
    ui.pilotProgressCurrent.textContent = `LVL ${pilotLevel}`;
    ui.pilotProgressNext.textContent = nextThreshold ? `LVL ${pilotLevel + 1}` : 'MAX LEVEL';
    ui.pilotProgressText.textContent = nextThreshold
      ? `${Math.floor(displayedLifetimePoints).toLocaleString()} / ${nextThreshold.toLocaleString()} PTS`
      : `${maxLevel === pilotLevel ? 'MAX · ' : ''}${Math.floor(displayedLifetimePoints).toLocaleString()} PTS`;
    ui.pilotProgressFill.style.width = `${levelProgress * 100}%`;
    ui.pilotProgress.setAttribute('aria-valuenow', Math.round(levelProgress * 100));
    if (status === 'playing' && pilotLevel > lastShownPilotLevel) {
      showLevelUpAnimation(lastShownPilotLevel, pilotLevel);
      lastShownPilotLevel = pilotLevel;
    }
  }

  function boost() {
    const now = performance.now();
    if (status !== 'playing' || now < state.boostReadyAt) return;
    const ability = abilities[equipped];
    state.boostUntil = now + ability.duration; state.boostReadyAt = now + ability.cooldown;
    if (equipped === 'repulsor') {
      state.shakeUntil = now + 260; state.shakeStrength = 7;
      let destroyed = 0;
      state.rocks = state.rocks.filter((rock) => {
        const hit = Math.hypot(rock.x - state.player.x, rock.y - state.player.y) < 310;
        if (hit) {
          destroyed++;
          state.debrisBursts.push({
            x: rock.x, y: rock.y, r: rock.r, angle: rock.angle, started: now,
            shards: Array.from({ length: 10 }, (_, index) => ({
              angle: index / 10 * Math.PI * 2 + (Math.random() - 0.5) * 0.38,
              speed: 34 + Math.random() * 52,
              size: 2.5 + Math.random() * 5,
              spin: (Math.random() - 0.5) * 8,
            })),
          });
        }
        return !hit;
      });
      state.score += destroyed * 120 * scoreMultiplier;
    }
    tone('orb');
  }

  function updateAbility(time) {
    const active = time < state.boostUntil;
    const remaining = Math.max(0, state.boostReadyAt - time);
    ui.ability.classList.toggle('active', active);
    ui.ability.disabled = status !== 'playing' || remaining > 0;
    if (active) {
      const activeLabel = equipped === 'surge'
        ? `${abilities[equipped].name.toUpperCase()} · ${effectiveScoreMultiplier(time)}× TOTAL · ${((state.boostUntil - time) / 1000).toFixed(1)}S`
        : `${abilities[equipped].name.toUpperCase()} · ${((state.boostUntil - time) / 1000).toFixed(1)}S`;
      ui.abilityText.textContent = activeLabel;
      ui.abilityFill.style.width = '100%';
    } else if (remaining > 0) {
      ui.abilityText.textContent = `RECHARGING · ${(remaining / 1000).toFixed(1)}S`;
      ui.abilityFill.style.width = `${(1 - remaining / abilities[equipped].cooldown) * 100}%`;
    } else {
      ui.abilityText.textContent = `${keyName(bindings.boost)} · ${abilities[equipped].name.toUpperCase()}`;
      ui.abilityFill.style.width = '0%';
    }
  }

  function skinColorAt(skinId, time) {
    const skin = skins[skinId];
    if (skinId === 'aurora') return `hsl(${(time / 7) % 360} 95% 68%)`;
    if (skinId === 'glitch') return Math.floor(time / 90) % 2 ? skin.color : skin.secondary;
    return skin.color;
  }

  function traceShipSkin(skinId) {
    ctx.beginPath();
    if (skinId === 'razor') {
      ctx.moveTo(0, -30); ctx.lineTo(12, -5); ctx.lineTo(7, 22); ctx.lineTo(0, 13); ctx.lineTo(-7, 22); ctx.lineTo(-12, -5);
    } else if (skinId === 'solar') {
      ctx.moveTo(0, -25); ctx.lineTo(10, -7); ctx.lineTo(24, 14); ctx.lineTo(7, 10); ctx.lineTo(0, 20); ctx.lineTo(-7, 10); ctx.lineTo(-24, 14); ctx.lineTo(-10, -7);
    } else if (skinId === 'ghost') {
      ctx.moveTo(0, -27); ctx.lineTo(15, -2); ctx.lineTo(12, 20); ctx.lineTo(0, 10); ctx.lineTo(-12, 20); ctx.lineTo(-15, -2);
    } else if (skinId === 'void') {
      ctx.moveTo(0, -28); ctx.lineTo(20, 18); ctx.lineTo(5, 8); ctx.lineTo(0, 19); ctx.lineTo(-5, 8); ctx.lineTo(-20, 18);
    } else if (skinId === 'nova') {
      ctx.moveTo(0, -32); ctx.lineTo(9, -9); ctx.lineTo(25, 8); ctx.lineTo(13, 21); ctx.lineTo(4, 13); ctx.lineTo(0, 23); ctx.lineTo(-4, 13); ctx.lineTo(-13, 21); ctx.lineTo(-25, 8); ctx.lineTo(-9, -9);
    } else if (skinId === 'glitch') {
      ctx.moveTo(-3, -29); ctx.lineTo(14, -8); ctx.lineTo(8, 1); ctx.lineTo(20, 18); ctx.lineTo(2, 12); ctx.lineTo(-4, 23); ctx.lineTo(-9, 8); ctx.lineTo(-20, 15); ctx.lineTo(-12, -5);
    } else if (skinId === 'eclipse') {
      ctx.moveTo(0, -30); ctx.lineTo(17, -7); ctx.lineTo(21, 17); ctx.lineTo(5, 9); ctx.lineTo(0, 22); ctx.lineTo(-5, 9); ctx.lineTo(-21, 17); ctx.lineTo(-17, -7);
    } else if (skinId === 'aurora') {
      ctx.moveTo(0, -31); ctx.bezierCurveTo(9, -12, 24, 0, 27, 18); ctx.lineTo(7, 10); ctx.lineTo(0, 22); ctx.lineTo(-7, 10); ctx.lineTo(-27, 18); ctx.bezierCurveTo(-24, 0, -9, -12, 0, -31);
    } else if (skinId === 'royal') {
      ctx.moveTo(0, -34); ctx.lineTo(8, -12); ctx.lineTo(20, -22); ctx.lineTo(17, 5); ctx.lineTo(26, 17); ctx.lineTo(7, 12); ctx.lineTo(0, 24); ctx.lineTo(-7, 12); ctx.lineTo(-26, 17); ctx.lineTo(-17, 5); ctx.lineTo(-20, -22); ctx.lineTo(-8, -12);
    } else {
      ctx.moveTo(0, -25); ctx.lineTo(18, 20); ctx.lineTo(0, 13); ctx.lineTo(-18, 20);
    }
    ctx.closePath();
  }

  function draw(time) {
    const background = ctx.createLinearGradient(0, 0, 0, H);
    background.addColorStop(0, '#071120'); background.addColorStop(0.52, '#0a1730'); background.addColorStop(1, '#0b102a');
    ctx.fillStyle = background; ctx.fillRect(0, 0, W, H);
    ctx.save();
    if (time < state.shakeUntil) {
      const shakeFade = (state.shakeUntil - time) / 420;
      const amount = state.shakeStrength * Math.max(0.15, shakeFade);
      ctx.translate((Math.random() - 0.5) * amount, (Math.random() - 0.5) * amount);
    }
    if (status !== 'playing') {
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 70; i++) {
        const depth = 0.45 + (i % 4) * 0.22;
        const x = (i * 131 + 17 - state.player.vx * depth * 8 + W) % W;
        const y = (i * 83 + time * (0.006 + (i % 4) * 0.003) - state.player.vy * depth * 4 + H) % H;
        ctx.globalAlpha = 0.18 + (i % 5) * 0.08;
        ctx.fillRect(x, y, i % 7 === 0 ? 2 : 1, i % 7 === 0 ? 2 : 1);
      }
    }
    ctx.globalAlpha = 1; ctx.strokeStyle = 'rgba(35,231,207,.1)';
    for (let y = 365; y < H; y += 34) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    for (let x = -W; x < W * 2; x += 92) { ctx.beginPath(); ctx.moveTo(W / 2, 365); ctx.lineTo(x, H); ctx.stroke(); }

    const velocityGlow = Math.min(1, Math.hypot(state.player.vx, state.player.vy) / 7);
    if (status === 'playing' && velocityGlow > 0.08) {
      ctx.save(); ctx.strokeStyle = skinColorAt(equippedSkin, time); ctx.lineCap = 'round';
      for (let i = 0; i < 16; i += 1) {
        const x = (i * 97 + 41) % W; const y = (i * 71 + time * (0.18 + velocityGlow * 0.38)) % H;
        ctx.globalAlpha = (0.04 + (i % 3) * 0.025) * velocityGlow; ctx.lineWidth = 1 + (i % 2);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - state.player.vx * 3, y + 12 + velocityGlow * 28 - state.player.vy * 2); ctx.stroke();
      }
      ctx.restore();
    }

    if (state.trail.length > 1) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      for (let i = 1; i < state.trail.length; i += 1) {
        const previous = state.trail[i - 1]; const point = state.trail[i];
        const fade = Math.max(0, 1 - (time - point.started) / 520);
        if (!fade) continue;
        const trailType = point.trailType || 'pulse';
        const trailColor = trailType === 'rainbow' ? `hsl(${(time / 5 + i * 14) % 360} 95% 64%)` : trails[trailType].color;
        const jitter = trailType === 'lightning' ? (i % 2 ? 5 : -5) : trailType === 'glitch' ? Math.sin(i * 8.3) * 4 : 0;
        ctx.globalAlpha = fade * (trailType === 'void' ? 0.62 : 0.86); ctx.strokeStyle = trailColor; ctx.shadowColor = trailColor; ctx.shadowBlur = (trailType === 'void' ? 25 : 16) * fade;
        ctx.lineWidth = (trailType === 'fire' ? 4 : 1.5) + fade * (trailType === 'void' ? 11 : 7) * (point.intensity || 1);
        ctx.beginPath(); ctx.moveTo(previous.x + jitter, previous.y); ctx.lineTo(point.x - jitter, point.y); ctx.stroke();
        if (trailType === 'fire') { ctx.globalAlpha = fade * 0.9; ctx.strokeStyle = '#f7d756'; ctx.lineWidth *= 0.32; ctx.stroke(); }
        if (trailType === 'glitch') { ctx.fillStyle = i % 2 ? '#20e7cf' : '#ed4eff'; ctx.fillRect(point.x + jitter - 5, point.y - 2, 10, 4); }
        else { ctx.fillStyle = trailColor; ctx.beginPath(); ctx.arc(point.x, point.y, 1 + fade * 2.2 * (point.intensity || 1), 0, Math.PI * 2); ctx.fill(); }
      }
      ctx.restore();
    }

    state.orbs.forEach((orb) => {
      const pickupStyle = {
        energy: ['#f7d756', '#fff8be', 'ϟ'], crystal: ['#ed4eff', '#ffe1ff', '◆'],
        cooldown: ['#20e7cf', '#d9fffa', '↻'], slow: ['#66a8ff', '#e4f1ff', '◷'], jackpot: ['#ff9e45', '#fff0d8', '★'],
      }[orb.type || 'energy'];
      ctx.save(); ctx.translate(orb.x, orb.y); ctx.rotate(orb.pulse * 0.16); ctx.shadowColor = pickupStyle[0]; ctx.shadowBlur = 22 + Math.sin(orb.pulse) * 4;
      ctx.fillStyle = pickupStyle[0]; ctx.beginPath();
      if (orb.type === 'crystal') { ctx.moveTo(0, -orb.r - 3); ctx.lineTo(orb.r, 0); ctx.lineTo(0, orb.r + 3); ctx.lineTo(-orb.r, 0); ctx.closePath(); }
      else { ctx.arc(0, 0, orb.r, 0, Math.PI * 2); }
      ctx.fill(); ctx.rotate(-orb.pulse * 0.16); ctx.fillStyle = pickupStyle[1]; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '900 10px ui-monospace,monospace'; ctx.fillText(pickupStyle[2], 0, 0); ctx.restore();
    });
    state.rocks.forEach((rock) => {
      ctx.save(); ctx.translate(rock.x, rock.y); ctx.rotate(rock.angle);
      const entrance = rock.born ? Math.min(1, (time - rock.born) / 220) : 1;
      ctx.globalAlpha = entrance; ctx.scale(0.72 + entrance * 0.28, 0.72 + entrance * 0.28);
      ctx.fillStyle = rock.boss ? '#492052' : '#433d5f'; ctx.strokeStyle = rock.boss ? '#ed4eff' : '#746b91'; ctx.shadowColor = rock.boss ? '#ed4eff' : 'transparent'; ctx.shadowBlur = rock.boss ? 18 : 0; ctx.lineWidth = rock.boss ? 4 : 3; ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const angle = i / 8 * Math.PI * 2; const radius = rock.r * (i % 2 ? 0.78 : 1);
        const x = Math.cos(angle) * radius; const y = Math.sin(angle) * radius;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#29263d'; ctx.beginPath();
      ctx.arc(-rock.r * 0.22, -rock.r * 0.18, rock.r * 0.2, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    });
    state.rocks.filter((rock) => rock.y < 0 && rock.y > -175).forEach((rock) => {
      const warningAlpha = 0.35 + Math.sin(time / 55) * 0.25;
      ctx.save(); ctx.globalAlpha = warningAlpha; ctx.fillStyle = '#ff6179'; ctx.shadowColor = '#ff6179'; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.moveTo(rock.x, 7); ctx.lineTo(rock.x - 5, 16); ctx.lineTo(rock.x + 5, 16); ctx.closePath(); ctx.fill(); ctx.restore();
    });
    state.debrisBursts.forEach((burst) => {
      const progress = Math.min(1, (time - burst.started) / 720);
      const fade = 1 - progress;
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.strokeStyle = '#ff6179'; ctx.lineWidth = 3 * fade; ctx.shadowColor = '#ff6179'; ctx.shadowBlur = 24 * fade;
      ctx.beginPath(); ctx.arc(burst.x, burst.y, burst.r * 0.45 + progress * 54, 0, Math.PI * 2); ctx.stroke();
      ctx.translate(burst.x, burst.y); ctx.rotate(burst.angle + progress * 2.4); ctx.scale(fade, fade);
      ctx.fillStyle = '#fff0f3'; ctx.beginPath();
      for (let i = 0; i < 8; i += 1) {
        const angle = i / 8 * Math.PI * 2; const radius = burst.r * (i % 2 ? 0.72 : 1);
        i ? ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius) : ctx.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
      }
      ctx.closePath(); ctx.fill(); ctx.restore();
      burst.shards.forEach((shard) => {
        const distance = shard.speed * progress;
        const x = burst.x + Math.cos(shard.angle) * distance;
        const y = burst.y + Math.sin(shard.angle) * distance + progress * progress * 24;
        ctx.save(); ctx.globalAlpha = fade; ctx.translate(x, y); ctx.rotate(shard.spin * progress);
        ctx.fillStyle = progress < 0.45 ? '#fff0f3' : '#ff6179'; ctx.shadowColor = '#ff6179'; ctx.shadowBlur = 10 * fade;
        ctx.fillRect(-shard.size / 2, -shard.size / 2, shard.size, shard.size * 1.7); ctx.restore();
      });
    });
    state.effects = state.effects.filter((effect) => time - effect.started < effect.duration);
    state.effects.forEach((effect) => {
      const progress = Math.min(1, (time - effect.started) / effect.duration); const fade = 1 - progress;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = fade; ctx.strokeStyle = effect.color; ctx.shadowColor = effect.color; ctx.shadowBlur = 18 * fade;
      ctx.lineWidth = 3 * fade; ctx.beginPath(); ctx.arc(effect.x, effect.y, 8 + progress * 48, 0, Math.PI * 2); ctx.stroke();
      effect.sparks.forEach((spark) => {
        const distance = spark.speed * progress; const x = effect.x + Math.cos(spark.angle) * distance; const y = effect.y + Math.sin(spark.angle) * distance;
        ctx.fillStyle = effect.color; ctx.fillRect(x - spark.size / 2, y - spark.size / 2, spark.size, spark.size);
      });
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = fade; ctx.fillStyle = effect.color; ctx.textAlign = 'center'; ctx.font = '900 12px ui-monospace, monospace';
      ctx.fillText(effect.text, effect.x, effect.y - 28 - progress * 30);
      if (effect.secondaryText) {
        ctx.fillStyle = effect.secondaryColor || '#20e7cf';
        ctx.font = '900 11px ui-monospace, monospace';
        ctx.fillText(effect.secondaryText, effect.x, effect.y - 13 - progress * 30);
      }
      ctx.restore();
    });
    const player = state.player;
    const abilityActive = time < state.boostUntil;
    const abilityColor = abilityColors[equipped];
    const skin = skins[equippedSkin];
    const animatedSkinColor = skinColorAt(equippedSkin, time);
    if (abilityActive) {
      const shieldEnding = ['shield', 'quantum'].includes(equipped) && state.boostUntil - time <= 700;
      const auraAlpha = shieldEnding ? (Math.floor(time / 65) % 2 ? 0.92 : 0.1) : 0.65 + Math.sin(time / 55) * 0.18;
      ctx.save(); ctx.globalAlpha = auraAlpha; ctx.strokeStyle = abilityColor;
      ctx.lineWidth = ['shield', 'quantum'].includes(equipped) ? 7 : 4; ctx.shadowColor = abilityColor; ctx.shadowBlur = 24; ctx.beginPath();
      const burstProgress = equipped === 'repulsor' ? 1 - (state.boostUntil - time) / abilities.repulsor.duration : 0;
      const auraRadius = equipped === 'repulsor' ? 42 + burstProgress * 270 : 35 + Math.sin(time / 45) * 3;
      ctx.arc(player.x, player.y, auraRadius, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
    ctx.save(); ctx.translate(player.x, player.y); ctx.rotate(player.angle); ctx.shadowColor = abilityActive ? abilityColor : animatedSkinColor;
    ctx.shadowBlur = abilityActive ? 42 : 24;
    ctx.fillStyle = abilityActive ? abilityColor : animatedSkinColor; traceShipSkin(equippedSkin); ctx.fill();
    if (skin.cost > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.72 + Math.sin(time / 80) * 0.16;
      ctx.strokeStyle = skin.secondary; ctx.shadowColor = skin.secondary; ctx.shadowBlur = 16; ctx.lineWidth = 1.8;
      traceShipSkin(equippedSkin); ctx.stroke();
      if (equippedSkin === 'nova') {
        ctx.fillStyle = '#f7d756';
        [-12, 12].forEach((x) => { ctx.beginPath(); ctx.moveTo(x - 3, 15); ctx.lineTo(x, 31 + Math.sin(time / 45 + x) * 5); ctx.lineTo(x + 3, 15); ctx.fill(); });
      } else if (equippedSkin === 'glitch') {
        ctx.save(); ctx.translate(Math.sin(time / 32) * 3, 0); ctx.strokeStyle = '#ed4eff'; ctx.globalAlpha = 0.55; traceShipSkin('glitch'); ctx.stroke(); ctx.restore();
      } else if (equippedSkin === 'eclipse') {
        for (let i = 0; i < 3; i += 1) {
          const orbit = time / 260 + i * Math.PI * 2 / 3;
          ctx.fillStyle = i === 1 ? '#a98cff' : '#ff355d'; ctx.beginPath(); ctx.arc(Math.cos(orbit) * 28, Math.sin(orbit) * 28, 2.8, 0, Math.PI * 2); ctx.fill();
        }
      } else if (equippedSkin === 'aurora') {
        ctx.strokeStyle = animatedSkinColor; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, 0, 28 + Math.sin(time / 90) * 3, 0, Math.PI * 2); ctx.stroke();
      } else if (equippedSkin === 'royal') {
        for (let i = 0; i < 4; i += 1) {
          const sparkle = time / 330 + i * Math.PI / 2;
          const x = Math.cos(sparkle) * 30; const y = Math.sin(sparkle) * 25;
          ctx.fillStyle = i % 2 ? '#ffffff' : '#ff9e45'; ctx.fillRect(x - 1.5, y - 4, 3, 8); ctx.fillRect(x - 4, y - 1.5, 8, 3);
        }
      }
      ctx.restore();
    }
    ctx.shadowBlur = 0; ctx.fillStyle = skin.core; ctx.beginPath();
    ctx.moveTo(0, -13); ctx.lineTo(6, 7); ctx.lineTo(-6, 7); ctx.closePath(); ctx.fill();
    if (status === 'playing') {
      ctx.fillStyle = abilityActive ? '#f7d756' : '#ed4eff'; ctx.beginPath();
      ctx.moveTo(-7, 18); ctx.lineTo(0, (abilityActive && equipped === 'overdrive' ? 52 : 34) + Math.sin(time / 40) * 5);
      ctx.lineTo(7, 18); ctx.fill();
    }
    ctx.restore();
    ctx.restore();
    if (status === 'playing' && state.combo > 1) {
      ctx.save(); ctx.textAlign = 'left'; ctx.fillStyle = '#f7d756'; ctx.shadowColor = '#f7d756'; ctx.shadowBlur = 12;
      ctx.font = '950 23px "Arial Narrow",Arial,sans-serif'; ctx.fillText(`${state.combo} COMBO`, 22, 38);
      ctx.shadowBlur = 0; ctx.fillStyle = '#fff2a6'; ctx.font = '900 10px ui-monospace,monospace'; ctx.fillText(`${comboMultiplier()}× SCORE · ${(Math.max(0, state.comboExpiresAt - time) / 1000).toFixed(1)}S`, 23, 54); ctx.restore();
    }
    if (time < state.flashUntil) {
      const flash = Math.max(0, (state.flashUntil - time) / 130);
      ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = flash * 0.15; ctx.fillStyle = '#f7d756'; ctx.fillRect(0, 0, W, H); ctx.restore();
    }
  }

  function tick(time) {
    const dt = Math.min((time - last) / 16.67, 2.2); last = time;
    if (status === 'playing') {
      const player = state.player;
      const abilityActive = time < state.boostUntil;
      const speedBoost = abilityActive && equipped === 'overdrive' ? 2.15 : abilityActive && equipped === 'quantum' ? 1.7 : 1;
      const maxSpeed = 6.4 * speedBoost;
      let moveX = 0; let moveY = 0;
      if (keys.has(bindings.left) || keys.has('arrowleft')) moveX -= 1;
      if (keys.has(bindings.right) || keys.has('arrowright')) moveX += 1;
      if (keys.has(bindings.up) || keys.has('arrowup')) moveY -= 1;
      if (keys.has(bindings.down) || keys.has('arrowdown')) moveY += 1;
      if (moveX || moveY) {
        const length = Math.hypot(moveX, moveY);
        moveX /= length; moveY /= length;
        const acceleration = 1 - Math.pow(0.68, dt);
        player.vx += (moveX * maxSpeed - player.vx) * acceleration;
        player.vy += (moveY * maxSpeed - player.vy) * acceleration;
      } else {
        const drag = Math.pow(0.76, dt);
        player.vx *= drag; player.vy *= drag;
      }
      player.x += player.vx * dt; player.y += player.vy * dt;
      const movementSpeed = Math.hypot(player.vx, player.vy);
      if (movementSpeed > 0.16) {
        const targetAngle = Math.atan2(player.vy, player.vx) + Math.PI / 2;
        const angleDifference = Math.atan2(Math.sin(targetAngle - player.angle), Math.cos(targetAngle - player.angle));
        player.angle += angleDifference * (1 - Math.pow(0.76, dt));
        if (time - state.lastTrail > 22) {
          const facingX = Math.sin(player.angle); const facingY = -Math.cos(player.angle);
          state.trail.push({
            x: player.x - facingX * 19, y: player.y - facingY * 19,
            started: time, trailType: equippedTrail, color: abilityActive ? abilityColors[equipped] : skinColorAt(equippedSkin, time), intensity: Math.min(1.4, movementSpeed / 6.4),
          });
          state.lastTrail = time;
        }
      }
      if (player.x < 28 || player.x > W - 28) player.vx = 0;
      if (player.y < 62 || player.y > H - 35) player.vy = 0;
      player.x = Math.max(28, Math.min(W - 28, player.x)); player.y = Math.max(62, Math.min(H - 35, player.y));
      state.elapsedMs += dt * 16.67;
      const missionSecond = Math.floor(state.elapsedMs / 1000);
      if (missionSecond > state.lastMissionSecond) {
        dailyState.progress.survivor = Math.min(dailyMissions[1].goal, (dailyState.progress.survivor || 0) + missionSecond - state.lastMissionSecond);
        state.lastMissionSecond = missionSecond; saveDaily();
      }
      if (state.combo && time >= state.comboExpiresAt) state.combo = 0;
      const basePoints = dt * (1.45 + state.level * 0.1);
      const activeScoreMultiplier = effectiveScoreMultiplier(time) * comboMultiplier();
      state.progress += basePoints; state.score += basePoints * activeScoreMultiplier;
      state.level = Math.min(9, 1 + Math.floor(state.progress / 650));
      if (state.level >= 3 && state.level % 3 === 0 && !state.bossSectors.includes(state.level)) {
        state.bossSectors.push(state.level); spawnBossWave(time);
      }
      const spawnDelay = Math.max(245, 680 - state.level * 48) / difficulties[difficulty].spawnRate;
      if (time - state.lastRock > spawnDelay) {
        const rockCount = difficulty === 'insane'
          ? Math.min(8, 3 + Math.floor(state.level / 2))
          : difficulty === 'hard' && state.level >= 4 && Math.random() < 0.45 ? 2 : 1;
        for (let i = 0; i < rockCount; i += 1) {
          const radius = difficulty === 'insane' ? 13 + Math.random() * 20 : 14 + Math.random() * 18;
          state.rocks.push({
            x: radius + Math.random() * (W - radius * 2),
            y: -radius - 10 - i * 42,
            r: radius,
            speed: difficulty === 'insane'
              ? 5.1 + Math.random() * 0.6 + state.level * 0.48
              : 2.4 + Math.random() * 2.2 + state.level * 0.34,
            vx: difficulty === 'insane'
              ? (Math.random() - 0.5) * 6.8
              : difficulty === 'hard' ? (Math.random() - 0.5) * 2.4 : 0,
            spin: (Math.random() - 0.5) * 0.08,
            angle: 0, born: time, nearMissed: false,
          });
        }
        state.lastRock = time;
      }
      if (time - state.lastOrb > 1850) {
        const roll = Math.random();
        const type = roll < 0.64 ? 'energy' : roll < 0.79 ? 'crystal' : roll < 0.87 ? 'cooldown' : roll < 0.96 ? 'slow' : 'jackpot';
        state.orbs.push({ x: 30 + Math.random() * (W - 60), y: -20, r: type === 'jackpot' ? 12 : 9, speed: 3.1, pulse: 0, type });
        state.lastOrb = time;
      }
      const timeScale = abilityActive && equipped === 'warp' ? 0.32 : time < state.pickupSlowUntil ? 0.48 : 1;
      state.rocks.forEach((rock) => {
        const previousY = rock.y;
        rock.y += rock.speed * dt * timeScale * difficulties[difficulty].hazardSpeed;
        rock.x += (rock.vx || 0) * dt * timeScale;
        if (rock.x < rock.r || rock.x > W - rock.r) {
          rock.vx *= -1;
          rock.x = Math.max(rock.r, Math.min(W - rock.r, rock.x));
        }
        rock.angle += rock.spin * dt * timeScale;
        const missRadius = rock.r + player.r;
        const horizontalDistance = Math.abs(rock.x - player.x);
        if (!rock.nearMissed && previousY <= player.y && rock.y > player.y && horizontalDistance >= missRadius - 4 && horizontalDistance < missRadius + 38) {
          rock.nearMissed = true; incrementCombo(time);
          const nearMissScore = Math.round(55 * effectiveScoreMultiplier(time) * comboMultiplier());
          state.score += nearMissScore;
          state.effects.push({ x: player.x, y: player.y - 18, started: time, duration: 680, color: '#20e7cf', text: 'NEAR MISS', secondaryText: `+${nearMissScore} PTS`, sparks: [] });
        }
      });
      state.orbs.forEach((orb) => {
        orb.y += orb.speed * dt; orb.pulse += 0.12 * dt;
        if (abilityActive && equipped === 'magnet') {
          const dx = player.x - orb.x; const dy = player.y - orb.y; const distance = Math.max(1, Math.hypot(dx, dy));
          if (distance < 360) { orb.x += dx / distance * 8 * dt; orb.y += dy / distance * 8 * dt; }
        }
      });
      state.rocks = state.rocks.filter((rock) => rock.y < H + rock.r);
      state.orbs = state.orbs.filter((orb) => orb.y < H + orb.r);
      state.debrisBursts = state.debrisBursts.filter((burst) => time - burst.started < 720);
      state.trail = state.trail.filter((point) => time - point.started < 520);
      const invulnerable = abilityActive && ['shield', 'quantum'].includes(equipped);
      if (!invulnerable && state.rocks.some((rock) => Math.hypot(rock.x - player.x, rock.y - player.y) < rock.r + player.r - 4)) gameOver();
      state.orbs = state.orbs.filter((orb) => {
        if (Math.hypot(orb.x - player.x, orb.y - player.y) < orb.r + player.r + 3) {
          incrementCombo(time);
          const type = orb.type || 'energy';
          let energyEarned = 0; let baseScore = 0; let rewardText = '';
          if (type === 'energy') { energyEarned = energyMultiplier * difficulties[difficulty].energyReward; baseScore = 90; }
          if (type === 'crystal') { baseScore = 360; rewardText = 'SCORE CRYSTAL'; }
          if (type === 'cooldown') { state.boostReadyAt = time; baseScore = 120; rewardText = 'ABILITY READY'; }
          if (type === 'slow') { state.pickupSlowUntil = time + 4000; baseScore = 140; rewardText = 'TIME DILATION'; }
          if (type === 'jackpot') { energyEarned = energyMultiplier * difficulties[difficulty].energyReward * 5; baseScore = 500; rewardText = 'ENERGY JACKPOT'; }
          energyEarned = Math.round(energyEarned * 100) / 100;
          const scoreEarned = Math.round(baseScore * effectiveScoreMultiplier(time) * comboMultiplier() * 100) / 100;
          state.energy += energyEarned; wallet += energyEarned; state.score += scoreEarned;
          if (['energy', 'jackpot'].includes(type) && ['hard', 'insane'].includes(difficulty)) advanceMission('collector', (dailyState.progress.collector || 0) + 1);
          state.effects.push({
            x: orb.x, y: orb.y, started: time, duration: 760, color: type === 'crystal' ? '#ed4eff' : type === 'cooldown' ? '#20e7cf' : type === 'slow' ? '#66a8ff' : '#f7d756', text: rewardText || `+${energyText(energyEarned)} ϟ`,
            secondaryText: `+${energyText(scoreEarned)} PTS`, secondaryColor: abilityActive && equipped === 'surge' ? abilityColors.surge : '#20e7cf',
            sparks: Array.from({ length: 14 }, (_, index) => ({
              angle: index / 14 * Math.PI * 2 + (Math.random() - 0.5) * 0.24,
              speed: 28 + Math.random() * 48, size: 1.5 + Math.random() * 3.5,
            })),
          });
          state.flashUntil = time + 130;
          localStorage.setItem('neon-drift-energy', wallet); tone('orb'); return false;
        }
        return true;
      });
      updateUI(); updateAbility(time);
    }
    draw(time); requestAnimationFrame(tick);
  }

  function openSettings() {
    ensureAudio();
    if (status === 'playing') pause();
    settingsOpen = true; keys.clear(); revealMenu(ui.settingsModal);
    ui.closeSettings.focus();
  }

  function closeSettings() {
    settingsOpen = false; waitingBind = null; concealMenu(ui.settingsModal, () => ui.settingsButton.focus());
    document.querySelectorAll('.keybind').forEach((button) => button.classList.remove('listening'));
  }

  function saveBindings() {
    localStorage.setItem('neon-drift-bindings', JSON.stringify(bindings));
    updateBindingLabels();
  }

  function updateBindingLabels() {
    document.querySelectorAll('[data-bind]').forEach((button) => { button.textContent = keyName(bindings[button.dataset.bind]); });
    ui.pause.textContent = keyName(bindings.pause);
    ui.hints.innerHTML = `<span><kbd>${keyName(bindings.up)}${keyName(bindings.left)}${keyName(bindings.down)}${keyName(bindings.right)}</kbd> or <kbd>ARROWS</kbd> to move</span><span><kbd>${keyName(bindings.boost)}</kbd> ${abilities[equipped].name}</span><span><kbd>${keyName(bindings.pause)}</kbd> pause</span>`;
    updateAbility(performance.now());
  }

  function assignBinding(action, key) {
    const oldKey = bindings[action];
    const duplicate = Object.keys(bindings).find((name) => name !== action && bindings[name] === key);
    if (duplicate) bindings[duplicate] = oldKey;
    bindings[action] = key;
    saveBindings();
    waitingBind = null;
    document.querySelectorAll('.keybind').forEach((button) => button.classList.remove('listening'));
  }

  function renderDifficulty() {
    document.querySelectorAll('[data-difficulty]').forEach((button) => {
      button.classList.toggle('selected', button.dataset.difficulty === difficulty);
    });
    ui.difficultyReward.textContent = `${difficulties[difficulty].energyReward}× ENERGY`;
    ui.difficultyBadge.textContent = difficulties[difficulty].name.toUpperCase();
  }

  function setupDifficulty() {
    document.querySelectorAll('[data-difficulty]').forEach((button) => {
      button.addEventListener('click', () => {
        difficulty = button.dataset.difficulty;
        localStorage.setItem('neon-drift-difficulty', difficulty);
        renderDifficulty(); tone('orb');
      });
    });
    renderDifficulty();
  }

  function setupSettings() {
    const rows = [
      ['master', ui.masterVolume, ui.masterValue],
      ['music', ui.musicVolume, ui.musicValue],
      ['sfx', ui.sfxVolume, ui.sfxValue],
    ];
    rows.forEach(([name, input, output]) => {
      input.value = mix[name]; output.textContent = `${mix[name]}%`;
      input.addEventListener('input', () => {
        mix[name] = +input.value; output.textContent = `${input.value}%`;
        localStorage.setItem('neon-drift-mix', JSON.stringify(mix)); applyMix();
      });
    });
    document.querySelectorAll('[data-bind]').forEach((button) => {
      button.addEventListener('click', () => {
        waitingBind = button.dataset.bind;
        document.querySelectorAll('.keybind').forEach((item) => item.classList.toggle('listening', item === button));
        button.textContent = 'PRESS KEY';
      });
    });
    ui.resetKeys.addEventListener('click', () => { bindings = { ...defaults }; saveBindings(); });
    ui.creditsButton.addEventListener('click', () => { if (ui.creditsReveal.hidden) revealMenu(ui.creditsReveal); else concealMenu(ui.creditsReveal); });
    updateBindingLabels();
  }

  function saveShop() {
    localStorage.setItem('neon-drift-energy', wallet);
    localStorage.setItem('neon-drift-points', pointsWallet);
    localStorage.setItem('neon-drift-abilities', JSON.stringify([...unlocked]));
    localStorage.setItem('neon-drift-equipped', equipped);
    localStorage.setItem('neon-drift-skin', equippedSkin);
    localStorage.setItem('neon-drift-skins', JSON.stringify([...unlockedSkins]));
    localStorage.setItem('neon-drift-trails', JSON.stringify([...unlockedTrails]));
    localStorage.setItem('neon-drift-trail', equippedTrail);
    localStorage.setItem('neon-drift-multiplier', energyMultiplier);
    localStorage.setItem('neon-drift-score-multiplier', scoreMultiplier);
  }

  function renderSkins() {
    ui.skinBalance.textContent = energyText(wallet);
    const skinCard = ([id, skin]) => {
      const selected = equippedSkin === id; const owned = unlockedSkins.has(id);
      const label = selected ? 'EQUIPPED' : owned ? 'EQUIP' : `${skin.cost} ϟ`;
      const disabled = selected || (!owned && wallet < skin.cost);
      return `<button class="skin-card${skin.cost ? ' premium' : ''}${selected ? ' selected' : ''}" style="--skin:${skin.color}" data-skin="${id}" aria-pressed="${selected}" ${disabled ? 'disabled' : ''}><span class="skin-preview">${skin.icon}</span><strong>${skin.name.toUpperCase()}</strong><small>${label}</small></button>`;
    };
    ui.freeSkinItems.innerHTML = Object.entries(skins).filter(([, skin]) => skin.cost === 0).map(skinCard).join('');
    ui.premiumSkinItems.innerHTML = Object.entries(skins).filter(([, skin]) => skin.cost > 0).map(skinCard).join('');
    ui.skinsModal.querySelectorAll('[data-skin]').forEach((button) => {
      button.addEventListener('click', () => {
        const id = button.dataset.skin; const skin = skins[id];
        if (!unlockedSkins.has(id)) {
          if (wallet < skin.cost) return;
          wallet = Math.round((wallet - skin.cost) * 100) / 100; unlockedSkins.add(id);
        }
        equippedSkin = id; saveShop(); updateUI(); tone('orb'); renderSkins();
      });
    });
  }

  function renderTrails() {
    ui.trailBalance.textContent = energyText(wallet);
    ui.trailItems.innerHTML = Object.entries(trails).map(([id, trail]) => {
      const owned = unlockedTrails.has(id); const selected = equippedTrail === id;
      const label = selected ? 'EQUIPPED' : owned ? 'EQUIP' : `${trail.cost} ϟ`;
      return `<article class="shop-item trail-shop-item"><div class="shop-icon" style="color:${trail.color};border-color:${trail.color}66">${trail.icon}</div><div class="shop-copy"><h3>${trail.name.toUpperCase()}</h3><p>${trail.description}</p></div><button class="buy-button${selected ? ' equipped' : ''}" data-trail="${id}" ${selected || (!owned && wallet < trail.cost) ? 'disabled' : ''}>${label}</button></article>`;
    }).join('');
    ui.trailItems.querySelectorAll('[data-trail]').forEach((button) => button.addEventListener('click', () => {
      const id = button.dataset.trail; const trail = trails[id];
      if (!unlockedTrails.has(id)) {
        if (wallet < trail.cost) return;
        wallet = Math.round((wallet - trail.cost) * 100) / 100; unlockedTrails.add(id);
      }
      equippedTrail = id; saveShop(); updateUI(); tone('orb'); renderTrails();
    }));
  }

  function renderMissions() {
    ui.missionDate.textContent = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' }).toUpperCase();
    ui.missionItems.innerHTML = dailyMissions.map((mission) => {
      const progress = Math.min(mission.goal, dailyState.progress[mission.id] || 0);
      const claimed = dailyState.claimed.includes(mission.id); const complete = progress >= mission.goal;
      const label = claimed ? 'CLAIMED' : complete ? `CLAIM +${mission.reward} ϟ` : `${Math.floor(progress)} / ${mission.goal}`;
      return `<article class="mission-item${complete ? ' complete' : ''}"><div class="mission-copy"><strong>${mission.name.toUpperCase()}</strong><p>${mission.description}</p><div><i style="width:${progress / mission.goal * 100}%"></i></div></div><button class="buy-button" data-mission="${mission.id}" ${!complete || claimed ? 'disabled' : ''}>${label}</button></article>`;
    }).join('');
    ui.missionItems.querySelectorAll('[data-mission]').forEach((button) => button.addEventListener('click', () => {
      const mission = dailyMissions.find((item) => item.id === button.dataset.mission);
      if (!mission || dailyState.claimed.includes(mission.id) || (dailyState.progress[mission.id] || 0) < mission.goal) return;
      dailyState.claimed.push(mission.id); wallet = Math.round((wallet + mission.reward) * 100) / 100;
      saveDaily(); saveShop(); updateUI(); tone('orb'); renderMissions();
    }));
  }

  function renderShop() {
    ui.shopBalance.textContent = energyText(wallet);
    ui.pointsBalance.textContent = Math.floor(pointsWallet).toLocaleString();
    ui.shopItems.innerHTML = Object.entries(abilities).map(([id, ability]) => {
      const owned = unlocked.has(id);
      const isEquipped = equipped === id;
      const label = isEquipped ? 'EQUIPPED' : owned ? 'EQUIP' : `${ability.cost} ϟ`;
      const disabled = isEquipped || (!owned && wallet < ability.cost);
      return `<article class="shop-item"><div class="shop-icon">${ability.icon}</div><div class="shop-copy"><h3>${ability.name.toUpperCase()}</h3><p>${ability.description}</p></div><button class="buy-button${isEquipped ? ' equipped' : ''}" data-ability="${id}" ${disabled ? 'disabled' : ''}>${label}</button></article>`;
    }).join('');
    ui.shopItems.querySelectorAll('[data-ability]').forEach((button) => {
      button.addEventListener('click', () => {
        const id = button.dataset.ability;
        const ability = abilities[id];
        if (!unlocked.has(id)) {
          if (wallet < ability.cost) return;
          wallet -= ability.cost; unlocked.add(id); tone('orb');
        }
        equipped = id; saveShop(); updateUI(); updateBindingLabels(); renderShop();
      });
    });
    const currentIndex = multiplierTiers.findIndex((tier) => tier.value === energyMultiplier);
    const nextIndex = currentIndex + 1;
    ui.multiplierItems.innerHTML = multiplierTiers.map((tier, index) => {
      const current = tier.value === energyMultiplier;
      const owned = tier.value < energyMultiplier;
      const available = index === nextIndex;
      const label = current ? 'ACTIVE' : owned ? 'OWNED' : available ? `${tier.cost.toLocaleString()} PTS` : 'LOCKED';
      const disabled = current || owned || !available || pointsWallet < tier.cost;
      return `<article class="multiplier-card${current ? ' current' : ''}"><strong>${tier.value}×</strong><button data-multiplier="${tier.value}" ${disabled ? 'disabled' : ''}>${label}</button></article>`;
    }).join('');
    ui.multiplierItems.querySelectorAll('[data-multiplier]').forEach((button) => {
      button.addEventListener('click', () => {
        const value = +button.dataset.multiplier;
        const tierIndex = multiplierTiers.findIndex((tier) => tier.value === value);
        const expectedIndex = multiplierTiers.findIndex((tier) => tier.value === energyMultiplier) + 1;
        const tier = multiplierTiers[tierIndex];
        if (tierIndex !== expectedIndex || pointsWallet < tier.cost) return;
        pointsWallet -= tier.cost;
        energyMultiplier = tier.value; saveShop(); tone('orb'); updateUI(); renderShop();
      });
    });
    const scoreIndex = scoreMultiplierTiers.findIndex((tier) => tier.value === scoreMultiplier);
    const nextScoreIndex = scoreIndex + 1;
    ui.scoreMultiplierItems.innerHTML = scoreMultiplierTiers.map((tier, index) => {
      const current = tier.value === scoreMultiplier;
      const owned = tier.value < scoreMultiplier;
      const available = index === nextScoreIndex;
      const label = current ? 'ACTIVE' : owned ? 'OWNED' : available ? `${tier.cost} ϟ` : 'LOCKED';
      const disabled = current || owned || !available || wallet < tier.cost;
      return `<article class="multiplier-card score-multiplier${current ? ' current' : ''}"><strong>${tier.value}×</strong><button data-score-multiplier="${tier.value}" ${disabled ? 'disabled' : ''}>${label}</button></article>`;
    }).join('');
    ui.scoreMultiplierItems.querySelectorAll('[data-score-multiplier]').forEach((button) => {
      button.addEventListener('click', () => {
        const value = +button.dataset.scoreMultiplier;
        const tierIndex = scoreMultiplierTiers.findIndex((tier) => tier.value === value);
        const expectedIndex = scoreMultiplierTiers.findIndex((tier) => tier.value === scoreMultiplier) + 1;
        const tier = scoreMultiplierTiers[tierIndex];
        if (tierIndex !== expectedIndex || wallet < tier.cost) return;
        wallet = Math.round((wallet - tier.cost) * 100) / 100;
        scoreMultiplier = tier.value; saveShop(); tone('orb'); updateUI(); renderShop();
      });
    });
  }

  function unlockAchievement(id, silent = false) {
    if (unlockedAchievements.has(id)) return;
    const achievement = achievements.find((item) => item.id === id);
    if (!achievement) return;
    unlockedAchievements.add(id);
    localStorage.setItem('neon-drift-achievements', JSON.stringify([...unlockedAchievements]));
    if (!silent) { toastQueue.push(achievement); showNextToast(); }
    renderAchievements();
  }

  function checkAchievements(silent = false) {
    const pilotLevel = getPilotLevel();
    achievements.forEach((achievement) => {
      const pointGoalMet = achievement.points > 0 && lifetimePoints >= achievement.points;
      const levelGoalMet = achievement.level > 0 && pilotLevel >= achievement.level;
      if (pointGoalMet || levelGoalMet) unlockAchievement(achievement.id, silent);
    });
  }

  function showNextToast() {
    if (toastActive || !toastQueue.length) return;
    toastActive = true;
    const achievement = toastQueue.shift();
    ui.achievementToastName.textContent = achievement.name;
    ui.achievementToast.classList.add('show');
    tone('orb');
    window.setTimeout(() => {
      ui.achievementToast.classList.remove('show');
      window.setTimeout(() => { toastActive = false; showNextToast(); }, 320);
    }, 2600);
  }

  function showLevelUpAnimation(previousLevel, newLevel) {
    if (levelUpTimer) clearTimeout(levelUpTimer);
    ui.levelUpNumber.textContent = newLevel;
    const levelsGained = newLevel - previousLevel;
    ui.levelUpCaption.textContent = levelsGained > 1 ? `${levelsGained} LEVELS GAINED` : 'PILOT RANK INCREASED';
    ui.levelUpCelebration.classList.remove('show');
    void ui.levelUpCelebration.offsetWidth;
    ui.levelUpCelebration.classList.add('show');
    levelUpTimer = setTimeout(() => {
      ui.levelUpCelebration.classList.remove('show');
      levelUpTimer = null;
    }, 2600);
  }

  function renderAchievements() {
    ui.lifetimePoints.textContent = `${Math.floor(lifetimePoints).toLocaleString()} PTS`;
    ui.achievementLevel.textContent = getPilotLevel();
    ui.achievementList.innerHTML = achievements.map((achievement, index) => {
      const unlocked = unlockedAchievements.has(achievement.id);
      return `<article class="achievement-row ${unlocked ? 'unlocked' : 'locked'}" style="--delay:${index * 42}ms"><div class="achievement-badge">${unlocked ? achievement.icon : '?'}</div><div class="achievement-info"><strong>${achievement.name}</strong><small>${achievement.description}</small></div><span class="achievement-state">${unlocked ? 'UNLOCKED' : 'LOCKED'}</span></article>`;
    }).join('');
  }

  function openAchievements() {
    if (status !== 'ready') return;
    achievementsOpen = true; ui.resetConfirm.hidden = true; renderAchievements(); revealMenu(ui.achievementsModal); ui.closeAchievements.focus();
  }

  function closeAchievements() {
    achievementsOpen = false; ui.resetConfirm.hidden = true; concealMenu(ui.achievementsModal, () => ui.achievementsButton.focus());
  }

  function askToResetAchievements() {
    revealMenu(ui.resetConfirm); ui.cancelReset.focus();
  }

  function cancelAchievementReset() {
    concealMenu(ui.resetConfirm, () => ui.resetAchievements.focus());
  }

  function confirmAchievementReset() {
    lifetimePoints = 0; lastShownPilotLevel = 0; unlockedAchievements.clear(); toastQueue = []; toastActive = false;
    ui.achievementToast.classList.remove('show');
    localStorage.setItem('neon-drift-lifetime-points', '0');
    localStorage.setItem('neon-drift-achievements', '[]');
    localStorage.setItem('neon-drift-advancements-reset', 'yes');
    updateUI(); renderAchievements(); concealMenu(ui.resetConfirm, () => ui.resetAchievements.focus());
  }

  function openShop() {
    if (status !== 'ready') return;
    ensureAudio(); shopOpen = true; renderShop();
    revealMenu(ui.shopModal); setMusicMode('shop'); ui.closeShop.focus();
  }

  function closeShop() {
    shopOpen = false; concealMenu(ui.shopModal, () => ui.shopButton.focus()); transitionMusicMode('menu');
  }

  function openSkins() {
    if (status !== 'ready') return;
    ensureAudio(); skinsOpen = true; renderSkins();
    revealMenu(ui.skinsModal); setMusicMode('shop'); ui.closeSkins.focus();
  }

  function closeSkins() {
    skinsOpen = false; concealMenu(ui.skinsModal, () => ui.skinsButton.focus()); transitionMusicMode('menu');
  }

  function openTrails() {
    if (status !== 'ready') return;
    ensureAudio(); trailsOpen = true; renderTrails(); revealMenu(ui.trailsModal); setMusicMode('shop'); ui.closeTrails.focus();
  }

  function closeTrails() {
    trailsOpen = false; concealMenu(ui.trailsModal, () => ui.trailsButton.focus()); transitionMusicMode('menu');
  }

  function openMissions() {
    if (status !== 'ready') return;
    missionsOpen = true; renderMissions(); revealMenu(ui.missionsModal); ui.closeMissions.focus();
  }

  function closeMissions() {
    missionsOpen = false; concealMenu(ui.missionsModal, () => ui.missionsButton.focus());
  }

  function awakenMenuMusic() {
    if (status !== 'ready') return;
    ensureAudio();
    if (audio) setMusicMode('menu');
  }

  document.addEventListener('pointerdown', awakenMenuMusic, { once: true, capture: true });
  document.addEventListener('keydown', awakenMenuMusic, { once: true, capture: true });

  window.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    if (achievementsOpen) {
      if (key === 'escape') {
               event.preventDefault();
        if (!ui.resetConfirm.hidden) cancelAchievementReset(); else closeAchievements();
      }
      return;
    }
    if (shopOpen) {
      if (key === 'escape') { event.preventDefault(); closeShop(); }
      return;
    }
    if (skinsOpen) {
      if (key === 'escape') { event.preventDefault(); closeSkins(); }
      return;
    }
    if (trailsOpen) {
      if (key === 'escape') { event.preventDefault(); closeTrails(); }
      return;
    }
    if (missionsOpen) {
      if (key === 'escape') { event.preventDefault(); closeMissions(); }
      return;
    }
    if (settingsOpen) {
      if (waitingBind) {
        event.preventDefault();
        if (!['shift', 'control', 'alt', 'meta', 'tab'].includes(key)) assignBinding(waitingBind, key);
        return;
      }
      if (key === 'escape') { event.preventDefault(); closeSettings(); }
      return;
    }
    const gameKeys = [...Object.values(bindings), 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'];
    if (gameKeys.includes(key)) event.preventDefault();
    if (key === bindings.boost) { if (!event.repeat) boost(); return; }
    if (key === bindings.pause) {
      if (!event.repeat) { if (status === 'playing') pause(); else if (status === 'paused') resume(); }
      return;
    }
    keys.add(key);
  });
  window.addEventListener('keyup', (event) => keys.delete(event.key.toLowerCase()));
  window.addEventListener('blur', () => keys.clear());

  ui.action.addEventListener('click', () => status === 'paused' ? resume() : start());
  ui.pause.addEventListener('click', pause);
  ui.ability.addEventListener('click', boost);
  ui.settingsButton.addEventListener('click', openSettings);
  ui.closeSettings.addEventListener('click', closeSettings);
  ui.settingsModal.addEventListener('click', (event) => { if (event.target === ui.settingsModal) closeSettings(); });
  ui.shopButton.addEventListener('click', openShop);
  ui.skinsButton.addEventListener('click', openSkins);
  ui.trailsButton.addEventListener('click', openTrails);
  ui.missionsButton.addEventListener('click', openMissions);
  ui.achievementsButton.addEventListener('click', openAchievements);
  ui.mainMenuButton.addEventListener('click', returnToMenu);
  ui.closeShop.addEventListener('click', closeShop);
  ui.shopModal.addEventListener('click', (event) => { if (event.target === ui.shopModal) closeShop(); });
  ui.closeSkins.addEventListener('click', closeSkins);
  ui.skinsModal.addEventListener('click', (event) => { if (event.target === ui.skinsModal) closeSkins(); });
  ui.closeTrails.addEventListener('click', closeTrails);
  ui.trailsModal.addEventListener('click', (event) => { if (event.target === ui.trailsModal) closeTrails(); });
  ui.closeMissions.addEventListener('click', closeMissions);
  ui.missionsModal.addEventListener('click', (event) => { if (event.target === ui.missionsModal) closeMissions(); });
  ui.closeAchievements.addEventListener('click', closeAchievements);
  ui.achievementsModal.addEventListener('click', (event) => { if (event.target === ui.achievementsModal) closeAchievements(); });
  ui.resetAchievements.addEventListener('click', askToResetAchievements);
  ui.cancelReset.addEventListener('click', cancelAchievementReset);
  ui.confirmReset.addEventListener('click', confirmAchievementReset);
  document.querySelectorAll('[data-key]').forEach((button) => {
    const key = button.dataset.key;
    button.addEventListener('pointerdown', (event) => { event.preventDefault(); keys.add(key); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((name) => button.addEventListener(name, () => keys.delete(key)));
  });

  setupSettings();
  setupDifficulty();
  checkAchievements(true);
  updateUI();
  renderAchievements();
  draw(performance.now());
  requestAnimationFrame(tick);
})();
