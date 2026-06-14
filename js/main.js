/* ============================================================
   极光信笺 — Aurora Letters
   核心逻辑：视图路由 | 极光Canvas | MBTI测试 | 信笺系统 | 音频
   ============================================================ */

// ============================================================
// 0. Supabase 客户端
// ============================================================
const SUPABASE_URL = 'https://huxxnrwedtugyhqvpxzx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1eHhucndlZHR1Z3locXZweHp4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0MjI5NjYsImV4cCI6MjA5Njk5ODk2Nn0.-tuIYvAOnEfll_yz-n02sEc8jphHvyLv44db39so10A';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ============================================================
// 1. localStorage 工具（仅用于当前用户会话）
const STORAGE_KEY = 'aurora_user';
const LETTERS_SENT_KEY = 'aurora_sentLetters';
const LETTERS_RECEIVED_KEY = 'aurora_receivedLetters';
const AUDIO_KEY = 'aurora_audioEnabled';
let welcomeShown = false; // 会话级别，每次打开网站都会重置

function loadData(key, fallback = null) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch { return fallback; }
}

function saveData(key, data) {
    try { localStorage.setItem(key, JSON.stringify(data)); } catch {}
}

// ============================================================
// 1. 视图路由
// ============================================================
let currentView = 'landing';

function switchView(viewName) {
    // 隐藏所有视图
    document.querySelectorAll('.view').forEach(v => v.classList.add('view-hidden'));
    // 显示目标
    const target = document.querySelector(`[data-view="${viewName}"]`);
    if (target) target.classList.remove('view-hidden');

    currentView = viewName;

    // 导航栏：register 隐藏，landing + 其他显示
    const nav = document.getElementById('nav');
    if (viewName === 'register') {
        nav.classList.add('nav-hidden');
    } else {
        nav.classList.remove('nav-hidden');
    }

    // 页脚：landing 和 register 隐藏
    const footer = document.getElementById('siteFooter');
    if (footer) {
        if (viewName === 'landing' || viewName === 'register') {
            footer.classList.add('footer-hidden');
        } else {
            footer.classList.remove('footer-hidden');
        }
    }

    // 更新导航高亮
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.toggle('active', link.dataset.nav === viewName);
    });

    // 极光画布：仅在landing运行
    if (viewName === 'landing') {
        startAurora();
    } else {
        stopAurora();
    }

    // 进入特定视图时刷新内容
    if (viewName === 'home') renderHome();
    if (viewName === 'discover') renderDiscover();
    if (viewName === 'letters') renderLetters();
    if (viewName === 'diary') renderDiary();
    if (viewName === 'map') renderMapPins();
    if (viewName === 'friends') renderFriends();
    if (viewName === 'profile') renderProfile();
    if (viewName === 'mbti') resetMbtiView();
    if (viewName === 'register') resetRegisterView();

    // 立即滚动到视图顶部
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;

    // 触发淡入动画
    setTimeout(() => {
        target.querySelectorAll('.fade-in').forEach(el => {
            el.classList.add('visible');
        });
    }, 50);
}

// hash路由（浏览器前进后退）
window.addEventListener('hashchange', () => {
    const hash = window.location.hash.replace('#', '');
    if (hash && document.querySelector(`[data-view="${hash}"]`)) {
        switchView(hash);
    }
});

// ============================================================
// 2. 导航栏
// ============================================================
const hamburger = document.getElementById('hamburger');
const navLinks = document.getElementById('navLinks');

hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('active');
    navLinks.classList.toggle('active');
});

// 导航链接点击
document.querySelectorAll('[data-nav]').forEach(el => {
    el.addEventListener('click', (e) => {
        e.preventDefault();
        const view = el.dataset.nav;
        if (view) switchView(view);
        // 关闭移动端菜单
        hamburger.classList.remove('active');
        navLinks.classList.remove('active');
    });
});

// Enter按钮：过渡动画 → 切换视图
document.getElementById('btnEnter').addEventListener('click', () => {
    enterSite();
});

function enterSite() {
    const landing = document.getElementById('view-landing');
    if (!landing) return;

    // 首次用户交互时启动音频
    if (audioEnabled) {
        initAudio();
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume().then(() => {
                fadeAudio(true);
                startBellTones();
                startNatureSounds();
            });
        } else if (audioCtx) {
            fadeAudio(true);
            startBellTones();
            startNatureSounds();
        }
    }

    landing.classList.add('landing-exit');

    setTimeout(() => {
        const user = loadData(STORAGE_KEY);
        if (user && user.name) {
            switchView('home');
        } else {
            switchView('register');
        }
        // 清除 hash，刷新时回到封面
        history.replaceState(null, '', window.location.pathname);
        landing.classList.remove('landing-exit');

        // 欢迎窗口：每次打开网站只弹一次（会话级别）
        if (!welcomeShown) {
            welcomeShown = true;
            document.getElementById('welcomeModal').classList.add('open');
        }
    }, 500);
}

// ============================================================
// 3. 极光 Canvas 动画（增强版：6缎带 + 暖色 + 雾粒子）
// ============================================================
let auroraRunning = false;
let auroraRAF = null;
let stars = [];
let mistParticles = [];

function initAurora() {
    const canvas = document.getElementById('auroraCanvas');
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // 150颗星星，12%暖色调
    stars = [];
    for (let i = 0; i < 150; i++) {
        stars.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            r: Math.random() * 1.8 + 0.4,
            speed: Math.random() * 0.015 + 0.003,
            phase: Math.random() * Math.PI * 2,
            warm: Math.random() < 0.12
        });
    }

    // 40个雾粒子 — 慢速上升的大尺寸低透明度粒子
    mistParticles = [];
    for (let i = 0; i < 40; i++) {
        mistParticles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            r: Math.random() * 40 + 20,
            vy: -(Math.random() * 0.3 + 0.1)
        });
    }
}

function drawAurora() {
    const canvas = document.getElementById('auroraCanvas');
    if (!canvas || !auroraRunning) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    // 极低透明度清屏 — 让CSS奶油底透出
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(250, 247, 242, 0.03)';
    ctx.fillRect(0, 0, w, h);

    // 6条极光缎带（ins风淡彩：灰粉/灰紫/灰蓝）
    const ribbons = [
        { y: 0.22, amp: 60,  freq: 0.003,  speed: 0.0025, phase: 0,   c1: '#D4C9C8', c2: '#C8CCD4', alpha: 0.13 },
        { y: 0.30, amp: 90,  freq: 0.0025, speed: 0.0035, phase: 2.5, c1: '#C8CCD4', c2: '#CDC8D8', alpha: 0.10 },
        { y: 0.40, amp: 75,  freq: 0.0035, speed: 0.003,  phase: 5,   c1: '#CDC8D8', c2: '#C8CDD8', alpha: 0.11 },
        { y: 0.50, amp: 65,  freq: 0.0028, speed: 0.004,  phase: 1.8, c1: '#C8CDD8', c2: '#D4B8A5', alpha: 0.09 },
        { y: 0.58, amp: 80,  freq: 0.0022, speed: 0.0028, phase: 3.5, c1: '#D4B8A5', c2: '#D4C9C8', alpha: 0.08 },
        { y: 0.65, amp: 55,  freq: 0.0038, speed: 0.0045, phase: 6,   c1: '#C8A8B8', c2: '#C8CCD4', alpha: 0.07 },
    ];

    ribbons.forEach(r => {
        const centerY = r.y * h;
        const grad = ctx.createLinearGradient(0, centerY - r.amp, 0, centerY + r.amp);
        grad.addColorStop(0, 'transparent');
        grad.addColorStop(0.3, hexToRgba(r.c1, r.alpha));
        grad.addColorStop(0.7, hexToRgba(r.c2, r.alpha));
        grad.addColorStop(1, 'transparent');

        ctx.beginPath();
        ctx.moveTo(0, centerY);
        for (let x = 0; x <= w; x += 2) {
            const yOff = Math.sin(x * r.freq + r.phase) * r.amp;
            const yOff2 = Math.sin(x * r.freq * 1.6 + r.phase + 0.7) * r.amp * 0.5;
            ctx.lineTo(x, centerY + yOff + yOff2);
        }
        for (let x = w; x >= 0; x -= 2) {
            const yOff = Math.sin(x * r.freq + r.phase) * r.amp;
            ctx.lineTo(x, centerY + yOff - 35);
        }
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();

        r.phase += r.speed * 0.4;
    });

    // 星星（ins风淡金微光）
    stars.forEach(s => {
        s.phase += s.speed;
        const alpha = 0.05 + Math.sin(s.phase) * 0.07 + 0.07;
        const tint = s.warm
            ? `rgba(210, 185, 170, ${alpha})`
            : `rgba(190, 180, 175, ${alpha})`;
        ctx.fillStyle = tint;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
    });

    // 雾粒子 — 慢速上升，底部渐隐
    mistParticles.forEach(m => {
        m.y += m.vy;
        if (m.y < -20) { m.y = h + 20; m.x = Math.random() * w; }
        const fadeAlpha = m.y > h * 0.7 ? 0.02 * ((h - m.y) / (h * 0.3)) : 0.02;
        ctx.fillStyle = `rgba(230, 222, 212, ${Math.max(0, fadeAlpha)})`;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
        ctx.fill();
    });

    auroraRAF = requestAnimationFrame(drawAurora);
}

function startAurora() {
    if (auroraRunning) return;
    initAurora();
    auroraRunning = true;
    drawAurora();
}

function stopAurora() {
    auroraRunning = false;
    if (auroraRAF) {
        cancelAnimationFrame(auroraRAF);
        auroraRAF = null;
    }
}

function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// 窗口大小变化时重新初始化
window.addEventListener('resize', () => {
    if (currentView === 'landing') {
        initAurora();
    }
});

// ============================================================
// 4. 音频控制 — Web Audio API 全局背景音乐
// ============================================================
let audioEnabled = loadData(AUDIO_KEY, true); // 默认开启
const audioToggle = document.getElementById('audioToggle');
const navAudioToggle = document.getElementById('navAudioToggle');
let audioCtx = null;
let masterGain = null;
let ambientNodes = [];
let bellInterval = null;
let natureNodes = [];

// 钟琴音符 — A小调五声音阶 + 高八度
const BELL_NOTES = [220, 261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.25, 783.99];

function initAudio() {
    if (audioCtx) return;

    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0;
    masterGain.connect(audioCtx.destination);

    // 4层温暖drone
    createAmbientLayer(55,   'sine',     0.05, 0.0005, 0.10);  // A1
    createAmbientLayer(82.4,'triangle',  0.04, 0.0006, 0.09);  // E2
    createAmbientLayer(110,  'sine',     0.03, 0.0008, 0.06);  // A2
    createAmbientLayer(138.6,'triangle', 0.02, 0.001,  0.04);  // C#3

    // 风声 — 低频滤波白噪
    createWindLayer();
    // 雪声 — 高频轻柔沙沙
    createSnowLayer();
    // 篝火 — 不规则噼啪
    createCampfireLayer();

    fadeAudio(true);
    startBellTones();
}

function createAmbientLayer(freq, type, baseGain, lfoFreq, lfoDepth) {
    const osc = audioCtx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;

    const gainNode = audioCtx.createGain();
    gainNode.gain.value = baseGain;

    const lfoOsc = audioCtx.createOscillator();
    lfoOsc.type = 'sine';
    lfoOsc.frequency.value = lfoFreq;
    const lfoGain = audioCtx.createGain();
    lfoGain.gain.value = lfoDepth;
    lfoOsc.connect(lfoGain);
    lfoGain.connect(gainNode.gain);

    osc.connect(gainNode);
    gainNode.connect(masterGain);

    osc.start();
    lfoOsc.start();

    ambientNodes.push({ osc, gain: gainNode, lfoGain, lfoOsc });
}

// 风声：低频调制白噪
function createWindLayer() {
    const bufferSize = audioCtx.sampleRate * 4;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    const src = audioCtx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 200;
    filter.Q.value = 0.3;

    const gain = audioCtx.createGain();
    gain.gain.value = 0.02;

    // LFO让风声有呼吸感
    const lfo = audioCtx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.0008;
    const lfoGain = audioCtx.createGain();
    lfoGain.gain.value = 0.01;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    lfo.start();

    src.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    src.start();
    natureNodes.push({ src, gain, lfo, lfoGain });
}

// 雪声：高频轻柔沙沙
function createSnowLayer() {
    const bufferSize = audioCtx.sampleRate * 2;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    const src = audioCtx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 3000;
    filter.Q.value = 0.8;

    const gain = audioCtx.createGain();
    gain.gain.value = 0.006;

    src.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    src.start();
    natureNodes.push({ src, gain });
}

// 篝火：不规则噼啪声
function playCrackle() {
    if (!audioCtx || !audioEnabled) return;
    const now = audioCtx.currentTime;

    // 随机3-8个短促噪声
    const count = 3 + Math.floor(Math.random() * 6);
    for (let i = 0; i < count; i++) {
        const t = now + Math.random() * 0.3;
        const dur = 0.005 + Math.random() * 0.04;
        const osc = audioCtx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = 200 + Math.random() * 800;
        const env = audioCtx.createGain();
        env.gain.setValueAtTime(0, t);
        env.gain.linearRampToValueAtTime(0.03 + Math.random() * 0.04, t + dur * 0.3);
        env.gain.exponentialRampToValueAtTime(0.001, t + dur);
        osc.connect(env);
        env.connect(masterGain);
        osc.start(t);
        osc.stop(t + dur + 0.01);
    }
    // 下一次噼啪
    const nextDelay = 800 + Math.random() * 4000;
    natureNodes._crackleTimer = setTimeout(playCrackle, nextDelay);
}

function startNatureSounds() {
    if (natureNodes._crackleTimer) clearTimeout(natureNodes._crackleTimer);
    playCrackle();
}

function stopNatureSounds() {
    if (natureNodes._crackleTimer) {
        clearTimeout(natureNodes._crackleTimer);
        natureNodes._crackleTimer = null;
    }
}

// 钟琴：更频繁、更优美的叮咚旋律
function playBellNote() {
    if (!audioCtx || !audioEnabled) return;
    const now = audioCtx.currentTime;

    // 主音
    const freq = BELL_NOTES[Math.floor(Math.random() * BELL_NOTES.length)];
    createBellVoice(freq, now, 0.07, 2.2);

    // 1/3概率加双音和声
    if (Math.random() < 0.4) {
        const delay = 0.15 + Math.random() * 0.4;
        const chordIdx = (BELL_NOTES.indexOf(freq) + 2 + Math.floor(Math.random() * 3)) % BELL_NOTES.length;
        createBellVoice(BELL_NOTES[chordIdx], now + delay, 0.05, 1.6);
    }
}

function createBellVoice(freq, startTime, volume, duration) {
    const osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;

    // 泛音
    const osc2 = audioCtx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = freq * 2.005;

    // 次泛音
    const osc3 = audioCtx.createOscillator();
    osc3.type = 'sine';
    osc3.frequency.value = freq * 3.003;

    const env = audioCtx.createGain();
    env.gain.setValueAtTime(0, startTime);
    env.gain.linearRampToValueAtTime(volume, startTime + 0.015);
    env.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    osc.connect(env);
    osc2.connect(env);
    osc3.connect(env);
    env.connect(masterGain);

    osc.start(startTime);
    osc2.start(startTime);
    osc3.start(startTime);
    osc.stop(startTime + duration + 0.01);
    osc2.stop(startTime + duration + 0.01);
    osc3.stop(startTime + duration + 0.01);
}

function startBellTones() {
    stopBellTones();
    scheduleNextBell();
}

function scheduleNextBell() {
    if (!audioEnabled) return;
    // 更快的节奏：1.2-4秒间隔
    const delay = 1200 + Math.random() * 2800;
    bellInterval = setTimeout(() => {
        playBellNote();
        scheduleNextBell();
    }, delay);
}

function stopBellTones() {
    if (bellInterval) {
        clearTimeout(bellInterval);
        bellInterval = null;
    }
}

function fadeAudio(fadeIn) {
    if (!masterGain || !audioCtx) return;
    const target = fadeIn ? 0.16 : 0;
    const now = audioCtx.currentTime;
    masterGain.gain.cancelScheduledValues(now);
    masterGain.gain.setValueAtTime(masterGain.gain.value, now);
    masterGain.gain.linearRampToValueAtTime(target, now + 1.5);
}

function updateAudioUI() {
    [audioToggle, navAudioToggle].forEach(btn => {
        if (!btn) return;
        if (audioEnabled) {
            btn.classList.remove('muted');
        } else {
            btn.classList.add('muted');
        }
    });
}

// 统一音频切换处理
function handleAudioToggle() {
    audioEnabled = !audioEnabled;
    saveData(AUDIO_KEY, audioEnabled);
    updateAudioUI();

    if (audioEnabled) {
        initAudio();
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        fadeAudio(true);
        startBellTones();
        startNatureSounds();
    } else {
        fadeAudio(false);
        stopBellTones();
        stopNatureSounds();
    }
}

if (audioToggle) {
    audioToggle.addEventListener('click', handleAudioToggle);
}
if (navAudioToggle) {
    navAudioToggle.addEventListener('click', handleAudioToggle);
}

// 欢迎弹窗事件
document.getElementById('btnWelcomeSkip').addEventListener('click', () => {
    document.getElementById('welcomeModal').classList.remove('open');
});

document.getElementById('btnWelcomeProfile').addEventListener('click', () => {
    document.getElementById('welcomeModal').classList.remove('open');
    switchView('profile');
});

// 更新导航栏用户信息
function updateNavUser() {
    const user = loadData(STORAGE_KEY);
    const navUser = document.getElementById('navUser');
    if (!navUser) return;

    if (user && user.name) {
        navUser.style.display = 'flex';

        const avatarData = AVATAR_ICONS.find(a => a.id === user.avatar) || AVATAR_ICONS[0];
        document.getElementById('navUserAvatar').innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
                ${avatarData.svg}
            </svg>`;
        document.getElementById('navUserName').textContent = user.name;
        document.getElementById('navUserId').textContent = user.auroraId ? `ID: ${user.auroraId}` : '';
    } else {
        navUser.style.display = 'none';
    }
}

// ============================================================
// 5. 注册系统
// ============================================================
const AVATAR_ICONS = [
    { id: 'fox',      svg: '<circle cx="12" cy="12" r="10"/><path d="M8 8l1.5 4L12 6l2.5 6L16 8"/><circle cx="14.5" cy="10" r="1" fill="currentColor"/><circle cx="9.5" cy="10" r="1" fill="currentColor"/>' },
    { id: 'owl',      svg: '<circle cx="10" cy="10" r="5"/><circle cx="14" cy="9" r="5"/><circle cx="12" cy="13" r="2"/><circle cx="10" cy="10" r="1.5" fill="currentColor"/><circle cx="14" cy="9" r="1.5" fill="currentColor"/>' },
    { id: 'pine',     svg: '<path d="M12 2L6 10h4l-3 6h10l-3-6h4L12 2z"/><rect x="9" y="16" width="6" height="6" rx="1"/>' },
    { id: 'mountain', svg: '<path d="M2 20L8 8l6 8 4-6 4 10H2z"/>' },
    { id: 'star',     svg: '<polygon points="12,2 15,9 22,9 16,14 18,21 12,17 6,21 8,14 2,9 9,9"/>' },
    { id: 'wave',     svg: '<path d="M2 16c3-4 5-4 8 0s5 4 8 0 5-4 4 0v4H2v-4z"/>' },
    { id: 'moon',     svg: '<path d="M20 13.5A8 8 0 1 1 10.5 4 6.5 6.5 0 0 0 20 13.5z"/>' },
    { id: 'feather',  svg: '<path d="M20 2L4 18l4-4 4-4L6 16l4-4 4-4L8 14l8-8L6 16l12-12v4l-8 8 4-4z"/>' },
    { id: 'crystal',  svg: '<polygon points="12,2 16,9 22,9 17,14 19,21 12,17 5,21 7,14 2,9 8,9"/>' },
    { id: 'fire',     svg: '<path d="M12 22c4-4 5-8 5-11a5 5 0 0 0-10 0c0 3 1 7 5 11z"/><path d="M12 18c2-2 3-5 3-7a3 3 0 0 0-6 0c0 2 1 5 3 7z" fill="currentColor" opacity="0.5"/>' },
];

let selectedAvatar = null;

function renderAvatarGrid() {
    const grid = document.getElementById('avatarGrid');
    if (!grid) return;
    grid.innerHTML = AVATAR_ICONS.map(a => `
        <div class="avatar-option" data-avatar="${a.id}" title="${a.id}">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
                ${a.svg}
            </svg>
        </div>
    `).join('');

    grid.querySelectorAll('.avatar-option').forEach(opt => {
        opt.addEventListener('click', () => {
            grid.querySelectorAll('.avatar-option').forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            selectedAvatar = opt.dataset.avatar;
            document.getElementById('btnAvatarNext').disabled = false;
        });
    });
}

function resetRegisterView() {
    selectedAvatar = null;
    document.getElementById('regStep1').classList.remove('step-hidden');
    document.getElementById('regStep2').classList.add('step-hidden');
    document.getElementById('regStep3').classList.add('step-hidden');
    document.getElementById('inputAge').value = '';
    document.getElementById('inputName').value = '';
    document.getElementById('ageError').textContent = '';
    document.getElementById('nameError').textContent = '';
    document.getElementById('btnAvatarNext').disabled = true;
    renderAvatarGrid();
}

// 步骤1 → 2
document.getElementById('btnAgeNext').addEventListener('click', () => {
    const age = parseInt(document.getElementById('inputAge').value);
    if (!age || age < 16 || age > 120) {
        document.getElementById('ageError').textContent = '请输入有效年龄（16岁以上）';
        return;
    }
    document.getElementById('ageError').textContent = '';
    document.getElementById('regStep1').classList.add('step-hidden');
    document.getElementById('regStep2').classList.remove('step-hidden');
});

// 步骤2 → 1 (返回)
document.getElementById('btnAvatarBack').addEventListener('click', () => {
    document.getElementById('regStep2').classList.add('step-hidden');
    document.getElementById('regStep1').classList.remove('step-hidden');
});

// 步骤2 → 3
document.getElementById('btnAvatarNext').addEventListener('click', () => {
    if (!selectedAvatar) return;
    document.getElementById('regStep2').classList.add('step-hidden');
    document.getElementById('regStep3').classList.remove('step-hidden');
});

// 步骤3 → 2 (返回)
document.getElementById('btnNameBack').addEventListener('click', () => {
    document.getElementById('regStep3').classList.add('step-hidden');
    document.getElementById('regStep2').classList.remove('step-hidden');
});

// 步骤3 → 完成
document.getElementById('btnNameDone').addEventListener('click', async () => {
    const name = document.getElementById('inputName').value.trim();
    if (!name) {
        document.getElementById('nameError').textContent = '请输入你的名字或昵称';
        return;
    }
    document.getElementById('nameError').textContent = '';
    const age = parseInt(document.getElementById('inputAge').value);

    // 检查名字是否已被使用
    const { data: existing } = await sb.from('profiles').select('name').eq('name', name);
    if (existing && existing.length > 0) {
        document.getElementById('nameError').textContent = '这个名字已被使用，换一个吧';
        return;
    }

    // 生成唯一极光ID
    const auroraId = 'AL-' + Math.random().toString(36).slice(2, 6).toUpperCase();
    const user = { name, age, avatar: selectedAvatar, auroraId, mbti: null, mbtiCompleted: false };

    // 保存到 Supabase
    const { error } = await sb.from('profiles').insert({
        name, age, avatar: selectedAvatar, aurora_id: auroraId
    });
    if (error) {
        document.getElementById('nameError').textContent = '注册失败，请重试';
        console.error('Supabase insert error:', error);
        return;
    }

    // 本地存会话
    saveData(STORAGE_KEY, user);
    updateNavUser();
    document.getElementById('welcomeModal').classList.add('open');
});

// Enter 键支持：输入框回车自动下一步
document.getElementById('inputAge').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('btnAgeNext').click();
});
document.getElementById('inputName').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('btnNameDone').click();
});

// ============================================================
// 6. 个人主页
// ============================================================
function renderHome() {
    const user = loadData(STORAGE_KEY);
    if (!user) {
        switchView('register');
        return;
    }
    updateNavUser();

    document.getElementById('homeName').textContent = user.name;
    document.getElementById('homeAge').textContent = `${user.age}岁`;
    document.getElementById('homeAuroraId').textContent = user.auroraId ? `极光ID: ${user.auroraId}` : '';

    // 头像
    const avatarData = AVATAR_ICONS.find(a => a.id === user.avatar) || AVATAR_ICONS[0];
    document.getElementById('homeAvatar').innerHTML = `
        <div class="avatar-option" style="cursor:default;margin:0 auto;">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
                ${avatarData.svg}
            </svg>
        </div>
    `;

    // MBTI
    if (user.mbtiCompleted && user.mbti) {
        document.getElementById('mbtiNotTested').style.display = 'none';
        document.getElementById('mbtiResult').style.display = 'block';
        const typeData = getMbtiTypeData(user.mbti);
        document.getElementById('mbtiTypeLarge').textContent = user.mbti;
        document.getElementById('mbtiNickname').textContent = typeData ? typeData.nicknameCN : '';
        document.getElementById('mbtiDescPoetic').textContent = typeData ? typeData.descCN : '';
    } else {
        document.getElementById('mbtiNotTested').style.display = 'block';
        document.getElementById('mbtiResult').style.display = 'none';
    }

    // 随机诗句
    document.getElementById('homeQuote').textContent = getRandomQuote();
}

// 个人主页渲染
async function renderProfile() {
    const user = loadData(STORAGE_KEY);
    if (!user) { switchView('register'); return; }

    // 头像
    const avatarData = AVATAR_ICONS.find(a => a.id === user.avatar) || AVATAR_ICONS[0];
    document.getElementById('profileAvatar').innerHTML = `
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
            ${avatarData.svg}
        </svg>`;
    document.getElementById('profileName').textContent = user.name;
    document.getElementById('profileId').textContent = user.auroraId ? `极光ID: ${user.auroraId}` : '';
    document.getElementById('profileAge').textContent = `${user.age}岁`;

    // MBTI
    if (user.mbtiCompleted && user.mbti) {
        document.getElementById('profileMbtiNot').style.display = 'none';
        document.getElementById('profileMbtiDone').style.display = 'block';
        document.getElementById('profileMbtiType').textContent = user.mbti;
        const typeData = getMbtiTypeData(user.mbti);
        document.getElementById('profileMbtiNick').textContent = typeData ? typeData.nicknameCN : '';
        document.getElementById('profileMbtiDesc').textContent = typeData ? typeData.descCN : '';
    } else {
        document.getElementById('profileMbtiNot').style.display = 'block';
        document.getElementById('profileMbtiDone').style.display = 'none';
    }

    // 日记（从 Supabase）
    await loadDiary();
    const myDiary = diaryEntries.slice(0, 3);
    document.getElementById('profileDiaryCount').textContent = diaryEntries.length > 0 ? `${diaryEntries.length}篇` : '';
    document.getElementById('profileDiaryList').innerHTML = myDiary.length > 0
        ? myDiary.map(d => `
            <div class="profile-mini-item">
                <span class="profile-mini-item-icon">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>
                </span>
                <span class="profile-mini-item-text">${escapeHTML(d.title || '无标题')} · ${new Date(d.createdAt).toLocaleDateString('zh-CN')}</span>
            </div>`).join('')
        : '<p class="profile-mini-empty">还没有日记</p>';

    // 寄出的信
    const sent = loadData(LETTERS_SENT_KEY, []);
    document.getElementById('profileSentCount').textContent = sent.length > 0 ? `${sent.length}封` : '';
    document.getElementById('profileSentList').innerHTML = sent.length > 0
        ? sent.slice(-3).reverse().map(l => {
            const toProfile = FAKE_PROFILES.find(p => p.id === l.to);
            return `
            <div class="profile-mini-item">
                <span class="profile-mini-item-icon">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="22,6 12,13 2,6"/></svg>
                </span>
                <span class="profile-mini-item-text">致 ${toProfile ? toProfile.name : l.to} · ${escapeHTML(l.content.slice(0, 30))}...</span>
            </div>`;
        }).join('')
        : '<p class="profile-mini-empty">还没有寄出过信</p>';

    // 捡到的漂流信（从 Supabase）
    const { data: userDriftFinds } = await sb.from('drift_letters').select('*')
        .contains('found_by', [user.name])
        .order('created_at', { ascending: false })
        .limit(3);
    document.getElementById('profileDriftCount').textContent = (userDriftFinds && userDriftFinds.length > 0) ? `${userDriftFinds.length}封` : '';
    document.getElementById('profileDriftList').innerHTML = (userDriftFinds && userDriftFinds.length > 0)
        ? userDriftFinds.map(d => {
            const loc = LOCATIONS.find(l => l.id === d.location_id);
            return `
            <div class="profile-mini-item">
                <span class="profile-mini-item-icon">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/></svg>
                </span>
                <span class="profile-mini-item-text">${loc ? loc.name : ''} · 来自 ${escapeHTML(d.user_name)}</span>
            </div>`;
        }).join('')
        : '<p class="profile-mini-empty">还没有捡到漂流信</p>';

    // 编辑资料按钮
    document.getElementById('btnEditProfile').onclick = () => switchView('register');
}

// ============================================================
// 7. 发现页
// ============================================================
const FAKE_PROFILES = [
    { id: 'freya', name: 'Freya', nameCN: '芙蕾雅', age: 24, mbti: 'INFP', avatar: 'moon', bio: '在挪威的森林里长大，相信每一片雪花都承载着一个未说出口的故事。', interests: ['摄影','森林徒步','诗歌'] },
    { id: 'sigurd', name: 'Sigurd', nameCN: '西格德', age: 27, mbti: 'INTJ', avatar: 'mountain', bio: '喜欢在峡湾边读书，觉得最好的对话发生在篝火旁。', interests: ['阅读','登山','咖啡'] },
    { id: 'astrid', name: 'Astrid', nameCN: '阿斯特丽德', age: 23, mbti: 'ENFP', avatar: 'star', bio: '相信每一场相遇都是极光安排的奇迹。永远在路上，永远热泪盈眶。', interests: ['旅行','音乐','写作'] },
    { id: 'bjorn', name: 'Bjorn', nameCN: '比约恩', age: 29, mbti: 'ISTP', avatar: 'pine', bio: '木屋建造者。周末总在森林里，对树说话比对人说话多。', interests: ['木工','钓鱼','露营'] },
    { id: 'ingrid', name: 'Ingrid', nameCN: '英格丽', age: 25, mbti: 'INFJ', avatar: 'crystal', bio: '极光猎人。在北冰洋边长大，心里住着一片星空和一首未完的诗。', interests: ['天文学','瑜伽','茶道'] },
    { id: 'leif', name: 'Leif', nameCN: '雷夫', age: 28, mbti: 'ENTP', avatar: 'wave', bio: '航海爱好者。相信人生就像峡湾，曲折但处处是风景。', interests: ['航海','摄影','哲学'] },
    { id: 'solveig', name: 'Solveig', nameCN: '索尔维格', age: 22, mbti: 'ISFP', avatar: 'feather', bio: '在奥斯陆学画画。能用铅笔捕捉光线的温度，却画不出自己的心情。', interests: ['绘画','电影','烘焙'] },
    { id: 'erik', name: 'Erik', nameCN: '埃里克', age: 26, mbti: 'ENFJ', avatar: 'fire', bio: '人类观察者。觉得每个人都像一本没读完的书，想认识每一页。', interests: ['心理学','音乐','跑步'] },
];

function renderDiscover() {
    const grid = document.getElementById('profileGrid');
    if (!grid) return;
    grid.innerHTML = FAKE_PROFILES.map(p => {
        const avatarData = AVATAR_ICONS.find(a => a.id === p.avatar) || AVATAR_ICONS[0];
        return `
        <div class="profile-card fade-in">
            <div class="profile-card-avatar">
                <div class="avatar-option" style="cursor:default;margin:0 auto;">
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
                        ${avatarData.svg}
                    </svg>
                </div>
            </div>
            <span class="profile-card-name">${p.name} <small style="font-weight:300;color:var(--color-text-tertiary);">${p.nameCN}</small></span>
            <span class="profile-card-age">${p.age}岁</span>
            <span class="profile-card-mbti">${p.mbti}</span>
            <p class="profile-card-bio">"${p.bio}"</p>
            <div class="profile-card-tags">
                ${p.interests.map(t => `<span class="profile-card-tag">${t}</span>`).join('')}
            </div>
            <button class="profile-card-btn" data-write="${p.id}">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                寄一封信
            </button>
        </div>`;
    }).join('');

    // 绑定寄信按钮
    grid.querySelectorAll('[data-write]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const profileId = btn.dataset.write;
            openCompose(profileId);
        });
    });

    // 淡入
    setTimeout(() => {
        grid.querySelectorAll('.fade-in').forEach(el => el.classList.add('visible'));
    }, 50);

    // 随机诗句
    const quoteEl = document.getElementById('discoverQuote');
    if (quoteEl) quoteEl.textContent = getRandomQuote();
}

// 在写信弹窗中打开，预填收信人
function openCompose(profileId) {
    const user = loadData(STORAGE_KEY);
    if (!user) { switchView('register'); return; }
    const select = document.getElementById('composeRecipient');
    select.innerHTML = FAKE_PROFILES.map(p =>
        `<option value="${p.id}" ${p.id === profileId ? 'selected' : ''}>${p.name} (${p.nameCN})</option>`
    ).join('');
    document.getElementById('composeContent').value = '';
    document.getElementById('composeCount').textContent = '0';
    document.getElementById('composeError').textContent = '';
    document.getElementById('btnSendLetter').disabled = true;
    document.getElementById('composeModal').classList.add('open');
    document.getElementById('composeTitle').textContent = profileId ? `写给 ${FAKE_PROFILES.find(p => p.id === profileId)?.name || ''}` : '写一封信';
}

// ============================================================
// 8. 信笺系统
// ============================================================
let sentLetters = loadData(LETTERS_SENT_KEY, []);
let receivedLetters = loadData(LETTERS_RECEIVED_KEY, []);

function generateId() { return 'ltr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8); }

function sendLetter(to, content) {
    const user = loadData(STORAGE_KEY);
    if (!user) return;
    const profile = FAKE_PROFILES.find(p => p.id === to);
    const letter = {
        id: generateId(),
        to, toName: profile ? profile.name : to,
        content, timestamp: Date.now(),
        status: 'sent' // sent → delivered → replied
    };
    sentLetters.unshift(letter);
    saveData(LETTERS_SENT_KEY, sentLetters);

    // 模拟送达
    setTimeout(() => {
        const idx = sentLetters.findIndex(l => l.id === letter.id);
        if (idx >= 0) { sentLetters[idx].status = 'delivered'; saveData(LETTERS_SENT_KEY, sentLetters); }
    }, 8000);

    // 模拟对方回复
    const delay = 15000 + Math.random() * 30000;
    setTimeout(() => {
        generateReply(letter);
    }, delay);
}

function generateReply(sentLetter) {
    const profile = FAKE_PROFILES.find(p => p.id === sentLetter.to);
    if (!profile) return;

    const replies = [
        `你的信像一缕穿过松林的光，落在我的下午。谢谢你的文字——在这个被极光照耀的世界里，能收到一封手写的温暖，真好。`,
        `读到你的信时，窗外正下着雪。你说的话让我想起挪威的一句老话："Det finnes ikke dårlig vær, bare dårlige klær."（没有坏天气，只有不合适的衣服。）很高兴认识你。`,
        `谢谢你的来信。我反复读了好几遍，每一遍都有不同的感受。也许有一天，我们可以在极光下喝杯咖啡，聊聊那些信里写不下的故事。`,
        `你的文字有种特别的温度。在这个快节奏的时代，能收到一封认真写的信，就像在森林里捡到一颗星星。希望我们保持联系。`,
    ];
    const replyContent = replies[Math.floor(Math.random() * replies.length)];

    const reply = {
        id: generateId(),
        from: sentLetter.to, fromName: profile.name,
        content: replyContent,
        timestamp: Date.now(),
        status: 'new',
        replyToId: sentLetter.id
    };
    receivedLetters.unshift(reply);
    saveData(LETTERS_RECEIVED_KEY, receivedLetters);

    // 更新已寄出信的状态
    const idx = sentLetters.findIndex(l => l.id === sentLetter.id);
    if (idx >= 0) { sentLetters[idx].status = 'replied'; saveData(LETTERS_SENT_KEY, sentLetters); }

    showToast('你收到了一封新的回信！');
}

function renderLetters() {
    sentLetters = loadData(LETTERS_SENT_KEY, []);
    receivedLetters = loadData(LETTERS_RECEIVED_KEY, []);

    // 收件箱
    const inboxList = document.getElementById('inboxList');
    const inboxEmpty = document.getElementById('inboxEmpty');
    if (receivedLetters.length === 0) {
        inboxEmpty.style.display = 'block';
        inboxList.innerHTML = '';
    } else {
        inboxEmpty.style.display = 'none';
        inboxList.innerHTML = receivedLetters.map(l => {
            const profile = FAKE_PROFILES.find(p => p.id === l.from);
            const avatarData = profile ? AVATAR_ICONS.find(a => a.id === profile.avatar) : AVATAR_ICONS[0];
            const statusClass = l.status === 'new' ? 'status-new' : l.status === 'replied' ? 'status-replied' : 'status-read';
            const statusText = l.status === 'new' ? '新信件' : l.status === 'replied' ? '已回复' : '已读';
            return `
            <div class="letter-item ${l.status === 'new' ? 'unread' : ''}" data-read="${l.id}">
                <div class="letter-item-header">
                    <div class="letter-item-avatar">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">${avatarData.svg}</svg>
                    </div>
                    <span class="letter-item-name">${l.fromName}</span>
                    <span class="letter-item-time">${formatTime(l.timestamp)}</span>
                </div>
                <p class="letter-item-preview">${l.content.slice(0, 60)}...</p>
                <span class="letter-item-status ${statusClass}">${statusText}</span>
            </div>`;
        }).join('');

        // 点击读信
        inboxList.querySelectorAll('[data-read]').forEach(item => {
            item.addEventListener('click', () => openLetterDetail(item.dataset.read, 'received'));
        });
    }

    // 已寄出
    const sentList = document.getElementById('sentList');
    const sentEmpty = document.getElementById('sentEmpty');
    if (sentLetters.length === 0) {
        sentEmpty.style.display = 'block';
        sentList.innerHTML = '';
    } else {
        sentEmpty.style.display = 'none';
        sentList.innerHTML = sentLetters.map(l => {
            const profile = FAKE_PROFILES.find(p => p.id === l.to);
            const avatarData = profile ? AVATAR_ICONS.find(a => a.id === profile.avatar) : AVATAR_ICONS[0];
            const statusText = l.status === 'sent' ? '已寄出' : l.status === 'delivered' ? '已送达' : '对方已回复';
            const statusClass = l.status === 'replied' ? 'status-replied' : 'status-read';
            return `
            <div class="letter-item" data-read-sent="${l.id}">
                <div class="letter-item-header">
                    <div class="letter-item-avatar">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">${avatarData.svg}</svg>
                    </div>
                    <span class="letter-item-name">${l.toName}</span>
                    <span class="letter-item-time">${formatTime(l.timestamp)}</span>
                </div>
                <p class="letter-item-preview">${l.content.slice(0, 60)}...</p>
                <span class="letter-item-status ${statusClass}">${statusText}</span>
            </div>`;
        }).join('');

        sentList.querySelectorAll('[data-read-sent]').forEach(item => {
            item.addEventListener('click', () => openLetterDetail(item.dataset.readSent, 'sent'));
        });
    }
}

function openLetterDetail(letterId, type) {
    const letters = type === 'received' ? receivedLetters : sentLetters;
    const letter = letters.find(l => l.id === letterId);
    if (!letter) return;

    const isReceived = type === 'received';
    const otherId = isReceived ? letter.from : letter.to;
    const profile = FAKE_PROFILES.find(p => p.id === otherId);
    const avatarData = profile ? AVATAR_ICONS.find(a => a.id === profile.avatar) : AVATAR_ICONS[0];

    document.getElementById('detailTitle').textContent = isReceived ? `来自 ${letter.fromName}` : `寄给 ${letter.toName}`;
    document.getElementById('detailContent').innerHTML = `
        <div class="letter-detail-sender">
            <div class="letter-item-avatar">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">${avatarData.svg}</svg>
            </div>
            <div>
                <span class="letter-item-name">${isReceived ? letter.fromName : letter.toName}</span>
                ${profile ? `<span class="profile-card-mbti" style="margin-left:8px;">${profile.mbti}</span>` : ''}
            </div>
        </div>
        <p class="letter-detail-body">${letter.content}</p>
        <p class="letter-detail-time">${formatTime(letter.timestamp)}</p>
        ${isReceived && letter.status === 'new' ? `
            <div class="letter-detail-actions">
                <button class="btn-accept" data-accept="${letter.id}">接受并回复</button>
            </div>
        ` : ''}
    `;

    // 标记为已读
    if (isReceived && letter.status === 'new') {
        letter.status = 'read';
        saveData(LETTERS_RECEIVED_KEY, receivedLetters);
    }

    document.getElementById('letterDetailModal').classList.add('open');

    // 接受按钮
    const acceptBtn = document.getElementById('detailContent').querySelector('[data-accept]');
    if (acceptBtn) {
        acceptBtn.addEventListener('click', () => {
            letter.status = 'replied';
            saveData(LETTERS_RECEIVED_KEY, receivedLetters);
            // 再次生成回复
            const sentLetter = sentLetters.find(l => l.id === letter.replyToId);
            if (sentLetter) {
                setTimeout(() => generateReply(sentLetter), 5000);
            }
            showToast('已接受！对方很快会回信 💌');
            document.getElementById('letterDetailModal').classList.remove('open');
            renderLetters();
        });
    }
}

function formatTime(ts) {
    const diff = Date.now() - ts;
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
    if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
    return Math.floor(diff / 86400000) + '天前';
}

// ============================================================
// 9. 弹窗事件
// ============================================================
document.getElementById('btnCompose').addEventListener('click', () => openCompose(null));

document.getElementById('btnCloseCompose').addEventListener('click', () => {
    document.getElementById('composeModal').classList.remove('open');
});

document.getElementById('btnCloseDetail').addEventListener('click', () => {
    document.getElementById('letterDetailModal').classList.remove('open');
});

// 点击遮罩关闭
document.getElementById('composeModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) e.currentTarget.classList.remove('open');
});
document.getElementById('letterDetailModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) e.currentTarget.classList.remove('open');
});

// 写信字数
document.getElementById('composeContent').addEventListener('input', function() {
    const len = this.value.trim().length;
    document.getElementById('composeCount').textContent = len;
    document.getElementById('btnSendLetter').disabled = len < 10;
    document.getElementById('composeError').textContent = '';
});

// 发送信件
document.getElementById('btnSendLetter').addEventListener('click', () => {
    const to = document.getElementById('composeRecipient').value;
    const content = document.getElementById('composeContent').value.trim();
    if (content.length < 10) {
        document.getElementById('composeError').textContent = '至少写10个字哦';
        return;
    }
    sendLetter(to, content);
    document.getElementById('composeModal').classList.remove('open');
    showToast('你的信已乘着极光出发了 ✨');
    renderLetters();
});

// ============================================================
// 10. 信笺Tab切换
// ============================================================
document.querySelectorAll('.letters-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.letters-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const target = tab.dataset.tab;
        document.getElementById('lettersInbox').style.display = target === 'inbox' ? 'block' : 'none';
        document.getElementById('lettersSent').style.display = target === 'sent' ? 'block' : 'none';
    });
});

// ============================================================
// 11. Toast通知
// ============================================================
let toastTimer;

function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2500);
}

// ============================================================
// 12. MBTI测试引擎
// ============================================================
const MBTI_QUESTIONS = [
    { text: '在人群中我感到充满能量', dim: 'EI', reversed: false },
    { text: '我更喜欢一对一的深度对话', dim: 'EI', reversed: true },
    { text: '社交活动结束后我需要独处来恢复', dim: 'EI', reversed: true },
    { text: '我喜欢认识新朋友', dim: 'EI', reversed: false },
    { text: '独处时我最有创造力', dim: 'EI', reversed: true },
    { text: '我更关注具体的事实而非抽象的概念', dim: 'SN', reversed: false },
    { text: '我经常沉浸在对未来的想象中', dim: 'SN', reversed: true },
    { text: '我喜欢按照既定的步骤做事', dim: 'SN', reversed: false },
    { text: '我常能从看似无关的事物中发现联系', dim: 'SN', reversed: true },
    { text: '比起理论，我更相信实际经验', dim: 'SN', reversed: false },
    { text: '做决定时我优先考虑逻辑而非情感', dim: 'TF', reversed: false },
    { text: '我能轻易感受到他人的情绪变化', dim: 'TF', reversed: true },
    { text: '我认为公平比仁慈更重要', dim: 'TF', reversed: false },
    { text: '看到他人哭泣我也会感到难过', dim: 'TF', reversed: true },
    { text: '批评他人对我来说并不困难', dim: 'TF', reversed: false },
    { text: '我喜欢提前做好计划', dim: 'JP', reversed: false },
    { text: '我享受随性而为的自由', dim: 'JP', reversed: true },
    { text: '截止日期让我更有动力', dim: 'JP', reversed: false },
    { text: '我倾向于保持多种选择而不是过早决定', dim: 'JP', reversed: true },
    { text: '整洁有序的环境让我感到安心', dim: 'JP', reversed: false },
];

const OPTION_LABELS = ['完全不像我', '不太像我', '有时像我', '比较像我', '非常像我'];
const OPTION_SCORES = [-2, -1, 0, 1, 2];

let mbtiAnswers = new Array(20).fill(null);
let mbtiCurrentQ = 0;

function resetMbtiView() {
    mbtiAnswers = new Array(20).fill(null);
    mbtiCurrentQ = 0;
    document.getElementById('mbtiIntro').style.display = 'block';
    document.getElementById('mbtiQuiz').style.display = 'none';
    document.getElementById('mbtiResultPage').style.display = 'none';
}

document.getElementById('btnStartMbti').addEventListener('click', () => {
    document.getElementById('mbtiIntro').style.display = 'none';
    document.getElementById('mbtiQuiz').style.display = 'block';
    showMbtiQuestion(0);
});

function showMbtiQuestion(idx) {
    mbtiCurrentQ = idx;
    const q = MBTI_QUESTIONS[idx];
    document.getElementById('mbtiQuestion').textContent = q.text;
    document.getElementById('mbtiProgressText').textContent = `${idx + 1} / 20`;
    document.getElementById('mbtiProgressBar').style.width = `${((idx + 1) / 20) * 100}%`;

    const container = document.getElementById('mbtiOptions');
    container.innerHTML = OPTION_LABELS.map((label, i) => `
        <button class="mbti-option ${mbtiAnswers[idx] === i ? 'selected' : ''}" data-score="${i}">${label}</button>
    `).join('');

    container.querySelectorAll('.mbti-option').forEach(btn => {
        btn.addEventListener('click', () => {
            mbtiAnswers[idx] = parseInt(btn.dataset.score);
            if (idx < 19) {
                setTimeout(() => showMbtiQuestion(idx + 1), 200);
            } else {
                calculateMbti();
            }
        });
    });
}

function calculateMbti() {
    let scores = { EI: 0, SN: 0, TF: 0, JP: 0 };
    MBTI_QUESTIONS.forEach((q, i) => {
        let s = OPTION_SCORES[mbtiAnswers[i]];
        if (q.reversed) s *= -1;
        scores[q.dim] += s;
    });

    const type =
        (scores.EI <= 0 ? 'I' : 'E') +
        (scores.SN <= 0 ? 'N' : 'S') +
        (scores.TF <= 0 ? 'F' : 'T') +
        (scores.JP <= 0 ? 'P' : 'J');

    // 显示结果
    const typeData = getMbtiTypeData(type);
    document.getElementById('mbtiQuiz').style.display = 'none';
    document.getElementById('mbtiResultPage').style.display = 'block';
    document.getElementById('mbtiTypeHuge').textContent = type;
    document.getElementById('mbtiNicknameLg').textContent = typeData ? typeData.nicknameCN : '';
    document.getElementById('mbtiDescLong').textContent = typeData ? typeData.descCN : '';

    // 维度条
    const dims = [
        { name: 'E/I', score: scores.EI, left: 'E', right: 'I' },
        { name: 'S/N', score: scores.SN, left: 'S', right: 'N' },
        { name: 'T/F', score: scores.TF, left: 'T', right: 'F' },
        { name: 'J/P', score: scores.JP, left: 'J', right: 'P' },
    ];
    document.getElementById('mbtiDimensions').innerHTML = dims.map(d => {
        const pct = Math.min(100, Math.max(0, ((d.score + 10) / 20) * 100));
        const leftActive = d.score > 0;
        const rightActive = d.score < 0;
        return `<div class="mbti-dim">
            <span class="mbti-dim-label ${leftActive ? 'dim-active' : ''}">${d.left}</span>
            <div class="mbti-dim-bar-wrap"><div class="mbti-dim-bar" style="width:${pct}%"></div></div>
            <span class="mbti-dim-label ${rightActive ? 'dim-active' : ''}">${d.right}</span>
        </div>`;
    }).join('');

    // 保存到 localStorage + Supabase
    const user = loadData(STORAGE_KEY);
    if (user) {
        user.mbti = type;
        user.mbtiCompleted = true;
        saveData(STORAGE_KEY, user);
        sb.from('profiles').update({ mbti: type, mbti_completed: true }).eq('aurora_id', user.auroraId).then();
    }
}

document.getElementById('btnSaveMbti').addEventListener('click', () => {
    switchView('home');
});

function getMbtiTypeData(type) {
    const types = {
        'INTJ': { nicknameCN: '建筑师', descCN: '你像冬夜里的极光，安静却绚烂。你善于在头脑中构建宏大的图景，每一个计划都精确而优美。你的内心是一座灯塔，照亮自己也指引他人。' },
        'INTP': { nicknameCN: '逻辑学家', descCN: '你是一个安静的探索者。世界的每一条规律都让你着迷，你喜欢把一切拆解再重组。在你的宇宙里，好奇心是最亮的星。' },
        'ENTJ': { nicknameCN: '指挥官', descCN: '你天生就是引领极光的人。果断、远见、从不畏惧未知。你的热情像北极夏日的太阳，永远不落下。' },
        'ENTP': { nicknameCN: '辩论家', descCN: '你是一个永远长不大的冒险家。每一个新鲜的想法都是一扇通往新世界的门。和你聊天，就像在森林里迷路——但路上全是惊喜。' },
        'INFJ': { nicknameCN: '提倡者', descCN: '你像冬夜里的极光，安静却绚烂。你看得见别人看不见的图案，听得见沉默中的旋律。你的内心有一座深邃的森林，那里住着理想、诗意，和对世界温柔的坚持。' },
        'INFP': { nicknameCN: '调停者', descCN: '你的心是一片挪威的森林，安静、深邃、充满生机。你用善意看待世界，用诗意编织日常。在你身边，连沉默都是温暖的。' },
        'ENFJ': { nicknameCN: '主人公', descCN: '你是那个总能在人群中找到迷失灵魂的人。像北极星一样恒定，像篝火一样温暖。你相信每个人都是一首等待被读懂的诗。' },
        'ENFP': { nicknameCN: '竞选者', descCN: '你的灵魂是一阵穿过峡湾的风，自由、奔放、永远新鲜。你把生活过成了一场永不落幕的烟花，每认识一个人就点亮一片夜空。' },
        'ISTJ': { nicknameCN: '物流师', descCN: '你像一座古老的灯塔，稳定而可靠。你说到做到，每一个承诺都是一块沉甸甸的基石。在这个善变的世界里，你是那份不变的温度。' },
        'ISFJ': { nicknameCN: '守卫者', descCN: '你是那种会记住朋友喜欢什么口味的人。细腻、温柔、从不声张。你的爱像木屋里壁炉的火——不耀眼，但能让整个冬天都不冷。' },
        'ESTJ': { nicknameCN: '总经理', descCN: '你是森林里的领头鹿，目标明确、步伐坚定。你相信秩序是美的基础，每一件被你安排妥当的事都是一个小宇宙的和谐。' },
        'ESFJ': { nicknameCN: '执政官', descCN: '你是那个永远在照顾大家的人。你的关怀像冬日的热巧克力，从胃暖到心。有你在的地方，就是家。' },
        'ISTP': { nicknameCN: '鉴赏家', descCN: '你有一双能看透事物本质的眼睛。动手能力超强，沉默但不沉闷。你像森林里最老练的猎人，安静地观察着世界，然后一击即中。' },
        'ISFP': { nicknameCN: '探险家', descCN: '你用五感去丈量世界。一朵野花的颜色，一片雪的纹理——别人匆匆路过，你却停下来细细品味。你的世界很小，但美得惊人。' },
        'ESTP': { nicknameCN: '企业家', descCN: '你是天生的冒险家，脚下永远只有进行时。风险是你的朋友，未知是你的游乐场。和你在一起，永远不知道下一秒会发生什么——但一定很精彩。' },
        'ESFP': { nicknameCN: '表演者', descCN: '你是那团永远烧不完的篝火。每一刻都是你的舞台，每一个微笑都是真实的。和你在一起，就像一直沐浴在挪威夏日的午夜阳光里。' },
    };
    return types[type] || null;
}

// ============================================================
// 13. 诗意短句
// ============================================================
const POETIC_QUOTES = [
    '"在极光之下，所有的相遇都是久别重逢。"',
    '"每个人都是一座孤岛，直到有人乘着信笺而来。"',
    '"北欧的风说了许多，把森林吹得满是故事。"',
    '"有些相遇，就像极光——你不知道它何时来，却一眼认出了它。"',
    '"世界上有两种光：一种是太阳，一种是你写信时的眼睛。"',
    '"我在森林里迷了路，但找到了你。"',
    '"每一片雪花都携带着一个未说出口的秘密。"',
    '"峡湾有多深，我对你的思念就有多深。"',
    '"篝火熄了，但星星还亮着。"',
    '"等待一封信，就像等待一场极光——值得所有的耐心。"',
    '"我们都是彼此生命里的过客，但有些过客会留下一整个春天。"',
    '"在世界的尽头，有一间木屋，里面住着你想念的人。"',
    '"写一封信，让它乘着极光，漂到那个人的梦里。"',
    '"愿你的信，都能抵达温暖的港湾。"',
    '"人生海海，幸得一遇。"',
];

function getRandomQuote() {
    return POETIC_QUOTES[Math.floor(Math.random() * POETIC_QUOTES.length)];
}

// ============================================================
// 14. 日记本系统
// ============================================================
const DIARY_KEY = 'aurora_diary';
let diaryEntries = [];
let diaryPhotos = [];       // 当前编辑中的照片（base64数组）
let editingDiaryId = null;  // 正在编辑的日记ID

async function loadDiary() {
    const user = loadData(STORAGE_KEY);
    if (!user) { diaryEntries = []; return; }
    const { data } = await sb.from('diary_entries').select('*').eq('user_aurora_id', user.auroraId).order('created_at', { ascending: false });
    diaryEntries = (data || []).map(d => ({
        id: d.id, title: d.title, content: d.content, photos: d.photos,
        isPublic: d.is_public, createdAt: new Date(d.created_at).getTime(),
        updatedAt: new Date(d.updated_at).getTime()
    }));
}

function saveDiary() {} // deprecated, using Supabase directly

// 照片压缩：限制最大宽度800px，质量0.65
function compressPhoto(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const maxW = 800;
                let w = img.width, h = img.height;
                if (w > maxW) { h = h * maxW / w; w = maxW; }
                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/jpeg', 0.65));
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

// 渲染日记列表
async function renderDiary() {
    await loadDiary();
    const grid = document.getElementById('diaryGrid');
    const empty = document.getElementById('diaryEmpty');
    if (!grid || !empty) return;

    if (diaryEntries.length === 0) {
        grid.innerHTML = '';
        empty.style.display = 'block';
        return;
    }

    empty.style.display = 'none';
    // 按时间倒序
    const sorted = [...diaryEntries].sort((a, b) => b.createdAt - a.createdAt);

    grid.innerHTML = sorted.map(e => {
        const dateStr = new Date(e.createdAt).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
        const hasPhoto = e.photos && e.photos.length > 0;
        const thumbHTML = hasPhoto
            ? `<img class="diary-card-thumb" src="${e.photos[0]}" alt="">`
            : `<div class="diary-card-no-photo">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
               </div>`;

        return `
            <div class="diary-card" data-diary-id="${e.id}">
                ${thumbHTML}
                <div class="diary-card-body">
                    <div class="diary-card-title">${escapeHTML(e.title || '无标题')}</div>
                    <div class="diary-card-preview">${escapeHTML(e.content || '')}</div>
                    <div class="diary-card-footer">
                        <span class="diary-card-date">${dateStr}</span>
                        <span class="diary-badge ${e.isPublic ? 'public' : 'private'}">
                            ${e.isPublic ? '公开' : '私密'}
                        </span>
                    </div>
                </div>
            </div>`;
    }).join('');

    // 点击卡片查看详情
    grid.querySelectorAll('.diary-card').forEach(card => {
        card.addEventListener('click', () => {
            const id = card.dataset.diaryId;
            openDiaryDetail(id);
        });
    });
}

function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// 打开写日记弹窗
function openDiaryWrite(editId = null) {
    editingDiaryId = editId;
    diaryPhotos = [];
    document.getElementById('diaryPhotoPreviews').innerHTML = '';
    document.getElementById('diaryPhotoInput').value = '';
    document.getElementById('diaryPhotoError').textContent = '';
    document.getElementById('diaryError').textContent = '';

    const titleEl = document.getElementById('diaryWriteTitle');
    const titleInput = document.getElementById('diaryTitle');
    const contentInput = document.getElementById('diaryContent');
    const countEl = document.getElementById('diaryCount');

    if (editId) {
        const entry = diaryEntries.find(e => e.id === editId);
        if (entry) {
            titleEl.textContent = '编辑日记';
            titleInput.value = entry.title || '';
            contentInput.value = entry.content || '';
            diaryPhotos = entry.photos ? [...entry.photos] : [];
            renderDiaryPhotoPreviews();
            // 设置隐私
            document.querySelectorAll('.privacy-option').forEach(opt => {
                opt.classList.toggle('active', opt.dataset.privacy === (entry.isPublic ? 'public' : 'private'));
            });
        }
    } else {
        titleEl.textContent = '写日记';
        titleInput.value = '';
        contentInput.value = '';
        document.querySelectorAll('.privacy-option').forEach(opt => {
            opt.classList.toggle('active', opt.dataset.privacy === 'public');
        });
    }

    countEl.textContent = contentInput.value.length;
    document.getElementById('diaryWriteModal').classList.add('open');
}

function closeDiaryWrite() {
    document.getElementById('diaryWriteModal').classList.remove('open');
    editingDiaryId = null;
    diaryPhotos = [];
}

// 渲染照片预览
function renderDiaryPhotoPreviews() {
    const container = document.getElementById('diaryPhotoPreviews');
    container.innerHTML = diaryPhotos.map((photo, i) => `
        <div class="diary-photo-preview">
            <img src="${photo}" alt="">
            <span class="diary-photo-remove" data-photo-index="${i}">&times;</span>
        </div>
    `).join('');

    // 移除按钮
    container.querySelectorAll('.diary-photo-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(btn.dataset.photoIndex);
            diaryPhotos.splice(idx, 1);
            renderDiaryPhotoPreviews();
            document.getElementById('diaryPhotoError').textContent = '';
        });
    });

    // 超过3张时隐藏上传按钮
    const addLabel = document.getElementById('diaryPhotoAddLabel');
    if (diaryPhotos.length >= 3) {
        addLabel.style.display = 'none';
    } else {
        addLabel.style.display = '';
    }
}

// 保存日记
async function saveDiaryEntry() {
    const title = document.getElementById('diaryTitle').value.trim();
    const content = document.getElementById('diaryContent').value.trim();
    const isPublic = document.querySelector('.privacy-option.active').dataset.privacy === 'public';

    if (!content) {
        document.getElementById('diaryError').textContent = '请写点什么吧';
        return;
    }
    document.getElementById('diaryError').textContent = '';

    const user = loadData(STORAGE_KEY);
    if (!user) { showToast('请先注册'); return; }

    if (editingDiaryId) {
        await sb.from('diary_entries').update({
            title, content, photos: diaryPhotos, is_public: isPublic, updated_at: new Date().toISOString()
        }).eq('id', editingDiaryId).eq('user_aurora_id', user.auroraId);
    } else {
        await sb.from('diary_entries').insert({
            user_aurora_id: user.auroraId, title, content, photos: diaryPhotos, is_public: isPublic
        });
    }

    closeDiaryWrite();
    renderDiary();
    showToast('日记已保存');
}

// 打开日记详情
async function openDiaryDetail(id) {
    await loadDiary();
    const entry = diaryEntries.find(e => e.id === id);
    if (!entry) return;

    const dateStr = new Date(entry.createdAt).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    document.getElementById('diaryDetailTitle').textContent = entry.title || '日记';
    document.getElementById('diaryDetailContent').innerHTML = `
        <p class="diary-detail-date">${dateStr} · ${entry.isPublic ? '公开' : '私密'}</p>
        <div class="diary-detail-body">${escapeHTML(entry.content)}</div>
        ${entry.photos && entry.photos.length > 0 ? `
            <div class="diary-detail-photos">
                ${entry.photos.map(p => `<img src="${p}" alt="">`).join('')}
            </div>
        ` : ''}
        <div class="diary-detail-actions">
            <button class="btn-back" id="btnEditDiary">编辑</button>
            <button class="btn-delete" id="btnDeleteDiary">删除</button>
        </div>
    `;

    document.getElementById('diaryDetailModal').classList.add('open');

    // 编辑按钮
    document.getElementById('btnEditDiary').addEventListener('click', () => {
        document.getElementById('diaryDetailModal').classList.remove('open');
        openDiaryWrite(id);
    });

    // 删除按钮
    document.getElementById('btnDeleteDiary').addEventListener('click', async () => {
        if (confirm('确定删除这篇日记吗？')) {
            const user = loadData(STORAGE_KEY);
            await sb.from('diary_entries').delete().eq('id', id).eq('user_aurora_id', user.auroraId);
            document.getElementById('diaryDetailModal').classList.remove('open');
            renderDiary();
            showToast('日记已删除');
        }
    });
}

// ============================================================
// 15. 日记事件绑定
// ============================================================
document.getElementById('btnWriteDiary').addEventListener('click', () => openDiaryWrite());

document.getElementById('btnCloseDiaryWrite').addEventListener('click', () => closeDiaryWrite());

document.getElementById('btnCloseDiaryDetail').addEventListener('click', () => {
    document.getElementById('diaryDetailModal').classList.remove('open');
});

// 保存日记
document.getElementById('btnSaveDiary').addEventListener('click', () => saveDiaryEntry());

// 字数统计
document.getElementById('diaryContent').addEventListener('input', () => {
    document.getElementById('diaryCount').textContent = document.getElementById('diaryContent').value.length;
});

// 照片上传
document.getElementById('diaryPhotoInput').addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    const remaining = 3 - diaryPhotos.length;
    if (files.length > remaining) {
        document.getElementById('diaryPhotoError').textContent = `最多还能添加 ${remaining} 张照片`;
        e.target.value = '';
        return;
    }
    document.getElementById('diaryPhotoError').textContent = '';

    for (const file of files) {
        if (diaryPhotos.length >= 3) break;
        const base64 = await compressPhoto(file);
        diaryPhotos.push(base64);
    }
    renderDiaryPhotoPreviews();
    e.target.value = '';
});

// 隐私切换
document.querySelectorAll('.privacy-option').forEach(opt => {
    opt.addEventListener('click', () => {
        document.querySelectorAll('.privacy-option').forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
    });
});

// ============================================================
// 16. 北欧地图 + 漂流瓶系统
// ============================================================
const DRIFT_KEY = 'aurora_driftLetters';
const FRIENDS_KEY = 'aurora_friends';
let driftLetters = [];
let friends = [];
let currentLocationId = null;
let currentReadLetter = null;

// 30个北欧地点（viewBox 800x600）
const LOCATIONS = [
    // ===== 挪威 (10) =====
    { id: 'oslo-fjord',       name: '奥斯陆峡湾',     country: '挪威', atmosphere: 'fjord',
      desc: '海水深蓝，峡湾两岸森林密布，晨雾如同薄纱。',
      facts: '奥斯陆峡湾全长约100公里，是挪威首都奥斯陆的门户。峡湾内有数十个小岛，夏天可以乘船跳岛游。', x: 233, y: 356 },
    { id: 'bergen-forest',    name: '卑尔根森林',     country: '挪威', atmosphere: 'forest',
      desc: '雨雾缭绕的松林深处，藏着挪威最古老的传说。',
      facts: '卑尔根被称为"欧洲雨城"，年均降雨天数超过230天。环绕城市的七座山峦是当地人最爱的徒步胜地。', x: 173, y: 397 },
    { id: 'tromso-aurora',    name: '特罗姆瑟极光',   country: '挪威', atmosphere: 'aurora',
      desc: '北极圈内的极光之城，每一夜都有绿光起舞。',
      facts: '特罗姆瑟位于北纬69°，是北极圈内最大的城市。每年9月到次年4月都能看到极光，被称为"北极之门"。', x: 320, y: 83 },
    { id: 'lofoten-islands',  name: '罗弗敦群岛',     country: '挪威', atmosphere: 'fjord',
      desc: '险峻的岛屿从海中拔起，像巨人的牙齿嵌在海上。',
      facts: '罗弗敦群岛位于北极圈内，但受墨西哥暖流影响，冬季气温比同纬度地区高15-20°C。这里也是世界最北的冲浪胜地。', x: 273, y: 150 },
    { id: 'preikestolen',     name: '布道石',         country: '挪威', atmosphere: 'mountain',
      desc: '悬崖方正如被刀切，站在604米之上俯瞰吕瑟峡湾。',
      facts: '布道石是挪威三大奇石之一，顶部平台约25×25米。每年超过30万人徒步4小时登上这里，从悬崖边向下看落差达604米。', x: 193, y: 420 },
    { id: 'geirangerfjord',   name: '盖朗厄尔峡湾',   country: '挪威', atmosphere: 'fjord',
      desc: '七姐妹瀑布从翠绿山崖倾泻而下，被联合国列为世界遗产。',
      facts: '盖朗厄尔峡湾是联合国教科文组织世界遗产，全长15公里，最深处达260米。"七姐妹"瀑布由7条独立的水流组成。', x: 207, y: 322 },
    { id: 'northcape-cliff',  name: '北角悬崖',       country: '挪威', atmosphere: 'mountain',
      desc: '欧洲最北端，站在悬崖上，前面只有无尽的北冰洋。',
      facts: '北角悬崖海拔307米，位于北纬71°。夏季有"午夜太阳"现象，太阳连续77天不落下。每年吸引约20万游客前来。', x: 387, y: 44 },
    { id: 'alesund',          name: '奥勒松',         country: '挪威', atmosphere: 'city',
      desc: '新艺术风格建筑之城，从阿克斯拉山顶俯瞰，整座城市如童话般散落在岛屿上。',
      facts: '1904年一场大火烧毁了奥勒松几乎全部木屋，之后用石头按当时流行的新艺术风格重建，成为北欧最完整的新艺术建筑群。', x: 147, y: 372 },
    { id: 'svalbard',         name: '斯瓦尔巴群岛',   country: '挪威', atmosphere: 'glacier',
      desc: '北冰洋上的极寒群岛，北极熊比人还多的白色荒原。',
      facts: '斯瓦尔巴群岛位于北纬74°-81°，是世界上北极熊密度最高的地区之一。全球种子库就建在这里的永久冻土中。', x: 347, y: 18 },
    { id: 'atlantic-road',    name: '大西洋之路',     country: '挪威', atmosphere: 'coast',
      desc: '8座桥梁串联起破碎的岛屿，被称为"世界上最美的公路"。',
      facts: '大西洋之路全长8.3公里，横跨8座桥梁，连接多个小岛。在风暴天气，海浪会直接拍打到路面上，壮观又惊险。', x: 167, y: 340 },

    // ===== 瑞典 (5) =====
    { id: 'stockholm-sea',    name: '斯德哥尔摩群岛', country: '瑞典', atmosphere: 'city',
      desc: '两万座岛屿散落在波罗的海，每一座都藏着故事。',
      facts: '斯德哥尔摩由14座岛屿组成，通过57座桥梁连接。老城Gamla Stan是中世纪风貌保存最完好的城区之一，彩色房子可追溯到13世纪。', x: 387, y: 310 },
    { id: 'icehotel',         name: '冰酒店',         country: '瑞典', atmosphere: 'aurora',
      desc: '全部由托尔讷河的冰建成，每年冬天都会以全新面貌重生。',
      facts: '世界上第一家冰酒店，位于瑞典尤卡斯耶尔维村，每年12月开放到次年4月。室内恒温-5°C，床也是冰做的，但铺有驯鹿皮。', x: 393, y: 113 },
    { id: 'gotland',          name: '哥特兰岛',       country: '瑞典', atmosphere: 'coast',
      desc: '中世纪石墙与玫瑰，波罗的海上的童话之岛。',
      facts: '哥特兰岛是瑞典最大的岛屿，拥有92座中世纪教堂。首府维斯比完好保留了3.4公里的环形城墙，是联合国世界遗产。', x: 413, y: 380 },
    { id: 'abisko',           name: '阿比斯库极光站', country: '瑞典', atmosphere: 'aurora',
      desc: '世界上最干燥的地方之一，极光观测的绝佳地点。',
      facts: '阿比斯库国家公园年降水量仅300mm，晴天率极高。这里的极光观测站建有著名的"蓝色大门"，是摄影师最爱的极光拍摄点。', x: 360, y: 55 },
    { id: 'gothenburg',       name: '哥德堡',         country: '瑞典', atmosphere: 'city',
      desc: '西海岸的港口明珠，空气中弥漫着海盐与咖啡的香气。',
      facts: '哥德堡是北欧最大的港口城市，也是沃尔沃汽车的诞生地。市内的哈加老城区以木屋和咖啡馆闻名，Fika文化在这里深入人心。', x: 287, y: 385 },

    // ===== 芬兰 (5) =====
    { id: 'helsinki-bay',     name: '赫尔辛基海湾',   country: '芬兰', atmosphere: 'city',
      desc: '芬兰湾的清晨，海鸥在白色教堂上方盘旋。',
      facts: '赫尔辛基被称为"波罗的海的女儿"，市中心的白教堂是芬兰最著名的地标。芬兰有"千湖之国"之称，全国有18.8万个湖泊。', x: 460, y: 224 },
    { id: 'santa-village',    name: '圣诞老人村',     country: '芬兰', atmosphere: 'aurora',
      desc: '北极圈上的小木屋，驯鹿在雪地里等待远方的来信。',
      facts: '圣诞老人村位于罗瓦涅米，北极圈线正好穿过村子。这里每年收到来自全球200多个国家的50多万封信，可以在邮局寄出带有圣诞老人邮戳的明信片。', x: 467, y: 86 },
    { id: 'lake-saimaa',      name: '塞马湖',         country: '芬兰', atmosphere: 'forest',
      desc: '芬兰最大的湖泊，数千岛屿散落其间，宁静如画。',
      facts: '塞马湖是欧洲第四大湖泊，湖岸线长达1.5万公里。这里生活着极危物种塞马环斑海豹，全球仅存约400只。', x: 473, y: 161 },
    { id: 'turku-archipelago',name: '图尔库群岛',     country: '芬兰', atmosphere: 'coast',
      desc: '两万多座岛屿像珍珠般洒在波罗的海上，芬兰最古老的港口城市。',
      facts: '图尔库是芬兰最古老的城市和前首都，图尔库群岛包含超过2万座岛屿，是世界最大的群岛之一。夏季可沿群岛环形路线骑行。', x: 413, y: 242 },
    { id: 'oulu',             name: '奥卢',           country: '芬兰', atmosphere: 'city',
      desc: '北欧的设计之都，极光与科技在北方的雪原上交织。',
      facts: '奥卢被称为"北方硅谷"，是北欧重要的科技中心。这里每年举办世界闻名的"空气吉他世锦赛"，冬季海面结冰后可在冰上散步。', x: 453, y: 112 },

    // ===== 冰岛 (5) =====
    { id: 'reykjavik-spring', name: '雷克雅未克温泉', country: '冰岛', atmosphere: 'hotspring',
      desc: '地热蒸汽从蓝湖升起，冰冷与温暖在此交汇。',
      facts: '冰岛拥有超过600个温泉，地热为全国90%的家庭供暖。蓝湖的乳蓝色来自二氧化硅和藻类，水温常年保持37-40°C。', x: 93, y: 310 },
    { id: 'black-sand-beach', name: '维克黑沙滩',     country: '冰岛', atmosphere: 'coast',
      desc: '玄武岩柱伫立在海边，黑色的沙粒是火与冰的见证。',
      facts: '雷尼斯黑沙滩的沙子来自火山熔岩风化后形成的黑色玄武岩颗粒。旁边的雷尼斯岩玄武岩柱群是天然形成的六边形石柱，像一座风琴。', x: 133, y: 345 },
    { id: 'vatnajokull',      name: '瓦特纳冰川',     country: '冰岛', atmosphere: 'glacier',
      desc: '欧洲最大的冰川，冰层之下藏着沉睡的火山。',
      facts: '瓦特纳冰川覆盖冰岛8%的国土，面积达8100平方公里，最厚处冰层约950米。冰川下面是格里姆火山，形成了冰与火的奇观。', x: 153, y: 293 },
    { id: 'jokulsarlon',      name: '杰古沙龙冰河湖', country: '冰岛', atmosphere: 'glacier',
      desc: '漂浮的冰山在湖中缓缓旋转，每一块冰都闪烁着钻石般的光芒。',
      facts: '杰古沙龙冰河湖是冰岛最深的湖（248米），湖中的冰山从瓦特纳冰川崩裂而来。《007》《古墓丽影》等多部电影在此取景。', x: 170, y: 310 },
    { id: 'gullfoss',         name: '黄金瀑布',       country: '冰岛', atmosphere: 'hotspring',
      desc: '洪流以雷霆之势坠入64米深的峡谷，激起的水雾中常有彩虹。',
      facts: '黄金瀑布是冰岛黄金圈三大景点之一，宽约70米，分两级坠落。20世纪曾有外国投资者想在此建水电站，被当地一位农场主的女儿以死相逼阻止。', x: 120, y: 285 },

    // ===== 丹麦 (3) =====
    { id: 'copenhagen',       name: '哥本哈根新港',   country: '丹麦', atmosphere: 'city',
      desc: '彩色房子倒映在运河水面，安徒生曾在这里写下童话。',
      facts: '新港是哥本哈根最古老的港口，建于1671年。安徒生生前曾在新港的多个地址居住，并在这里写下了《海的女儿》和《丑小鸭》。', x: 253, y: 448 },
    { id: 'skagen',           name: '斯卡恩',         country: '丹麦', atmosphere: 'coast',
      desc: '两片海在这里相撞却不相融，丹麦最北端的艺术圣地。',
      facts: '斯卡恩位于丹麦最北端，是波罗的海与北海的交汇处。由于两片海的密度和温度不同，可以清晰看到海浪从两个方向撞击在一起的自然奇观。', x: 233, y: 410 },
    { id: 'aarhus',           name: '奥胡斯',         country: '丹麦', atmosphere: 'city',
      desc: '维京历史与现代建筑在日德兰半岛上奇妙共存。',
      facts: '奥胡斯是丹麦第二大城市，也是2017年欧洲文化之都。老城博物馆是世界上第一个露天城市博物馆，收集了75座来自丹麦各地的历史建筑。', x: 213, y: 440 },

    // ===== 法罗群岛 (1) =====
    { id: 'torshavn',         name: '托尔斯港',       country: '法罗群岛', atmosphere: 'coast',
      desc: '北大西洋上的隐秘珍珠，彩色木屋直面咆哮的海浪。',
      facts: '托尔斯港是世界上最小的首都之一，人口仅约2万。法罗群岛由18座火山岛组成，任何一个地点距离大海不超过5公里。', x: 80, y: 355 },

    // ===== 格陵兰 (1) =====
    { id: 'ilulissat',        name: '伊卢利萨特冰峡湾', country: '格陵兰', atmosphere: 'glacier',
      desc: '巨大冰山从冰川崩落入海，每一块都像一座漂浮的雕塑。',
      facts: '伊卢利萨特冰峡湾是联合国世界遗产，冰川每天崩裂出约2000万吨冰。冰山入海后需15个月才能漂出峡湾进入大西洋，有些冰山高达100米。', x: 37, y: 198 },
];

// 地点照片URL映射（LoremFlickr 真实照片）
const LOCATION_PHOTOS = {
    'oslo-fjord':       'https://loremflickr.com/640/380/oslofjord,norway,water',
    'bergen-forest':    'https://loremflickr.com/640/380/bergen,norway,forest',
    'tromso-aurora':    'https://loremflickr.com/640/380/tromso,aurora,northernlights',
    'lofoten-islands':  'https://loremflickr.com/640/380/lofoten,islands,norway',
    'preikestolen':     'https://loremflickr.com/640/380/preikestolen,pulpitrock,cliff',
    'geirangerfjord':   'https://loremflickr.com/640/380/geirangerfjord,norway,fjord',
    'northcape-cliff':  'https://loremflickr.com/640/380/nordkapp,norway,cliff',
    'alesund':          'https://loremflickr.com/640/380/alesund,norway,city',
    'svalbard':         'https://loremflickr.com/640/380/svalbard,arctic,snow',
    'atlantic-road':    'https://loremflickr.com/640/380/atlantic,road,norway,ocean',
    'stockholm-sea':    'https://loremflickr.com/640/380/stockholm,sweden,waterfront',
    'icehotel':         'https://loremflickr.com/640/380/icehotel,sweden,snow',
    'gotland':          'https://loremflickr.com/640/380/gotland,sweden,island',
    'abisko':           'https://loremflickr.com/640/380/abisko,sweden,aurora',
    'gothenburg':       'https://loremflickr.com/640/380/gothenburg,sweden,city',
    'helsinki-bay':     'https://loremflickr.com/640/380/helsinki,finland,harbor',
    'santa-village':    'https://loremflickr.com/640/380/rovaniemi,santa,finland,winter',
    'lake-saimaa':      'https://loremflickr.com/640/380/saimaa,lake,finland',
    'turku-archipelago':'https://loremflickr.com/640/380/turku,finland,archipelago',
    'oulu':             'https://loremflickr.com/640/380/oulu,finland,winter',
    'reykjavik-spring': 'https://loremflickr.com/640/380/bluelagoon,iceland,hotspring',
    'black-sand-beach': 'https://loremflickr.com/640/380/vik,iceland,blacksand',
    'vatnajokull':      'https://loremflickr.com/640/380/vatnajokull,iceland,glacier',
    'jokulsarlon':      'https://loremflickr.com/640/380/jokulsarlon,iceland,iceberg',
    'gullfoss':         'https://loremflickr.com/640/380/gullfoss,iceland,waterfall',
    'copenhagen':       'https://loremflickr.com/640/380/copenhagen,nyhavn,denmark',
    'skagen':           'https://loremflickr.com/640/380/skagen,denmark,beach',
    'aarhus':           'https://loremflickr.com/640/380/aarhus,denmark,city',
    'torshavn':         'https://loremflickr.com/640/380/faroe,islands,landscape',
    'ilulissat':        'https://loremflickr.com/640/380/ilulissat,greenland,iceberg',
};

async function loadDriftLetters() {
    const { data } = await sb.from('drift_letters').select('*').order('created_at', { ascending: false });
    driftLetters = data || [];
}
function loadFriends() {} // deprecated, using Supabase directly
function saveFriends() {} // deprecated

// 渲染地图标记点
async function renderMapPins() {
    await loadDriftLetters();
    const pinsGroup = document.getElementById('mapPins');
    if (!pinsGroup) return;

    const quoteEl = document.getElementById('mapQuote');
    if (quoteEl) quoteEl.textContent = getRandomQuote();

    // 统计每个地点的信件数
    const counts = {};
    driftLetters.forEach(d => {
        counts[d.location_id] = (counts[d.location_id] || 0) + 1;
    });

    pinsGroup.innerHTML = LOCATIONS.map(loc => {
        const count = counts[loc.id] || 0;
        const badgeHTML = count > 0
            ? `<text x="${loc.x}" y="${loc.y - 18}" class="map-pin-badge">${count}封</text>`
            : '';
        return `
            <g class="map-pin" data-location="${loc.id}">
                <circle cx="${loc.x}" cy="${loc.y}" r="26" class="map-pin-hit"/>
                <circle cx="${loc.x}" cy="${loc.y}" r="12" class="map-pin-glow"/>
                ${badgeHTML}
                <circle cx="${loc.x}" cy="${loc.y}" r="5" class="map-pin-dot"/>
                <text x="${loc.x}" y="${loc.y + 24}" class="map-pin-label">${loc.name}</text>
            </g>
        `;
    }).join('');

    pinsGroup.querySelectorAll('.map-pin').forEach(pin => {
        pin.addEventListener('click', () => {
            openLocation(pin.dataset.location);
        });
    });
}

// 打开地点详情
async function openLocation(locationId) {
    currentLocationId = locationId;
    const loc = LOCATIONS.find(l => l.id === locationId);
    if (!loc) return;

    document.getElementById('locationTitle').textContent = loc.name;

    // 氛围卡片（真实照片背景 + CSS渐变作为fallback）
    const atmosphereEl = document.getElementById('locationAtmosphere');
    atmosphereEl.className = 'location-atmosphere atmo-' + (loc.atmosphere || 'fjord');
    const photoUrl = LOCATION_PHOTOS[loc.id];
    if (photoUrl) {
        atmosphereEl.style.backgroundImage = `url(${photoUrl})`;
        atmosphereEl.style.backgroundSize = 'cover';
        atmosphereEl.style.backgroundPosition = 'center';
    }
    document.getElementById('locationAtmosphereLabel').textContent = loc.name;
    document.getElementById('locationCountryTag').textContent = loc.country || '';

    document.getElementById('locationDesc').textContent = loc.desc;
    document.getElementById('locationFacts').textContent = loc.facts || '';

    // 从 Supabase 拉取该地点的漂流信
    const { data: locLetters } = await sb.from('drift_letters').select('*')
        .eq('location_id', locationId).order('created_at', { ascending: false });

    const count = locLetters ? locLetters.length : 0;
    document.getElementById('locationLetterCount').textContent =
        count > 0 ? `这里有 ${count} 封漂流信` : '这里还没有信，做第一个投信的人吧';

    const lettersDiv = document.getElementById('locationLetters');
    if (count === 0) {
        lettersDiv.innerHTML = '';
    } else {
        const recent = locLetters.slice(0, 4);
        lettersDiv.innerHTML = recent.map(l => `
            <div class="drift-letter">
                <div class="drift-letter-preview">${escapeHTML(l.content.slice(0, 60))}...</div>
                <div class="drift-letter-time">${timeAgo(new Date(l.created_at).getTime())}</div>
            </div>
        `).join('');
    }

    document.getElementById('locationModal').classList.add('open');
}

// 关闭地点弹窗
function closeLocation() {
    document.getElementById('locationModal').classList.remove('open');
    currentLocationId = null;
}

// 打开投信弹窗
function openDropLetter() {
    if (!currentLocationId) return;
    const loc = LOCATIONS.find(l => l.id === currentLocationId);
    document.getElementById('dropLocationName').textContent = '📍 ' + (loc ? loc.name : '');
    document.getElementById('dropContent').value = '';
    document.getElementById('dropCount').textContent = '0';
    document.getElementById('dropError').textContent = '';
    document.getElementById('dropLetterModal').classList.add('open');
    document.getElementById('locationModal').classList.remove('open');
}

// 确认投信
async function confirmDropLetter() {
    const content = document.getElementById('dropContent').value.trim();
    if (!content) {
        document.getElementById('dropError').textContent = '请写下你想说的话';
        return;
    }
    document.getElementById('dropError').textContent = '';

    const user = loadData(STORAGE_KEY);
    const userName = user ? user.name : '匿名旅人';
    const userAvatar = user ? user.avatar : 'star';
    const userAuroraId = user ? user.auroraId : '';

    await sb.from('drift_letters').insert({
        location_id: currentLocationId,
        user_aurora_id: userAuroraId,
        user_name: userName,
        user_avatar: userAvatar,
        content: content
    });

    document.getElementById('dropLetterModal').classList.remove('open');
    renderMapPins();
    showToast('信已投入大海，等待有缘人发现');
}

// 捞一封信 — 随机找到同一地点别人的信（Supabase）
async function findRandomLetter() {
    if (!currentLocationId) return;

    const user = loadData(STORAGE_KEY);
    const userName = user ? user.name : '匿名旅人';
    const userAuroraId = user ? user.auroraId : '';

    // 从 Supabase 找同一地点、不是自己写的信，然后 JS 过滤已找到的
    // 先查所有信（调试用）
    const { data: allAtLoc } = await sb.from('drift_letters').select('*')
        .eq('location_id', currentLocationId);
    console.log('该地点全部信件:', allAtLoc, '当前用户auroraId:', userAuroraId);

    const candidates = (allAtLoc || []).filter(l =>
        l.user_aurora_id !== userAuroraId && !(l.found_by || []).includes(userName)
    );

    console.log('可捞的候选人:', candidates.length, '封');

    if (!candidates || candidates.length === 0) {
        showToast('这里还没有其他人的信，换个地点试试吧');
        return;
    }

    // 随机选一封
    const letter = candidates[Math.floor(Math.random() * candidates.length)];
    currentReadLetter = letter;

    // 标记为已找到
    const updatedFoundBy = [...(letter.found_by || []), userName];
    await sb.from('drift_letters').update({ found_by: updatedFoundBy }).eq('id', letter.id);

    // 显示读信弹窗
    const loc = LOCATIONS.find(l => l.id === currentLocationId);
    document.getElementById('readLetterContent').innerHTML = `
        <div class="read-letter-header">
            <div class="read-letter-avatar">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
                    ${getAvatarSVG(letter.user_avatar)}
                </svg>
            </div>
            <div>
                <div class="read-letter-from">${escapeHTML(letter.user_name)}</div>
                <div class="read-letter-location">${loc ? loc.name : ''} · ${timeAgo(new Date(letter.created_at).getTime())}</div>
            </div>
        </div>
        <div class="read-letter-body">${escapeHTML(letter.content)}</div>
    `;

    document.getElementById('readLetterActions').innerHTML = `
        <button class="btn-back" id="btnSkipLetter">换一封</button>
        <button class="btn-primary" id="btnReplyLetter">回复并请求加好友</button>
    `;

    document.getElementById('locationModal').classList.remove('open');
    document.getElementById('readLetterModal').classList.add('open');

    document.getElementById('btnSkipLetter').addEventListener('click', () => {
        document.getElementById('readLetterModal').classList.remove('open');
        openLocation(currentLocationId);
        setTimeout(() => findRandomLetter(), 300);
    });

    document.getElementById('btnReplyLetter').addEventListener('click', () => {
        document.getElementById('readLetterModal').classList.remove('open');
        addFriendFromLetter({ userName: letter.user_name, userAvatar: letter.user_avatar, user_aurora_id: letter.user_aurora_id, locationId: currentLocationId });
    });
}

// 从漂流信添加好友
async function addFriendFromLetter(letter) {
    const user = loadData(STORAGE_KEY);
    if (!user) {
        showToast('请先注册');
        return;
    }

    // 检查是否已经是好友
    const { data: existing } = await sb.from('friends').select('*')
        .eq('user_aurora_id', user.auroraId)
        .eq('friend_aurora_id', letter.user_aurora_id || letter.userName)
        .maybeSingle();

    if (existing) {
        showToast('你们已经是好友了');
        return;
    }

    const loc = LOCATIONS.find(l => l.id === letter.locationId);
    // 双向添加
    await sb.from('friends').insert([
        { user_aurora_id: user.auroraId, friend_aurora_id: letter.user_aurora_id || letter.userName, friend_name: letter.userName, friend_avatar: letter.userAvatar, location_name: loc ? loc.name : '' },
        { user_aurora_id: letter.user_aurora_id || letter.userName, friend_aurora_id: user.auroraId, friend_name: user.name, friend_avatar: user.avatar, location_name: loc ? loc.name : '' }
    ]);

    showToast(`已向 ${letter.userName} 发送好友请求！`);
}

// 获取头像SVG
function getAvatarSVG(avatarId) {
    const data = AVATAR_ICONS.find(a => a.id === avatarId);
    return data ? data.svg : AVATAR_ICONS[0].svg;
}

// 时间格式化
function timeAgo(ts) {
    const diff = Date.now() - ts;
    const min = Math.floor(diff / 60000);
    if (min < 1) return '刚刚';
    if (min < 60) return `${min}分钟前`;
    const hrs = Math.floor(min / 60);
    if (hrs < 24) return `${hrs}小时前`;
    const days = Math.floor(hrs / 24);
    return `${days}天前`;
}

// ============================================================
// 17. 好友系统
// ============================================================
async function renderFriends(searchTerm = '') {
    const user = loadData(STORAGE_KEY);
    if (!user) return;

    const grid = document.getElementById('friendGrid');
    const empty = document.getElementById('friendEmpty');
    if (!grid || !empty) return;

    // 从 Supabase 拉取好友列表
    let query = sb.from('friends').select('*').eq('user_aurora_id', user.auroraId).order('created_at', { ascending: false });
    if (searchTerm) {
        query = query.ilike('friend_name', `%${searchTerm}%`);
    }
    const { data: friends } = await query;

    if (!friends || friends.length === 0) {
        grid.innerHTML = '';
        empty.style.display = 'block';
        return;
    }

    empty.style.display = 'none';
    grid.innerHTML = friends.map(f => `
        <div class="friend-card">
            <button class="friend-delete-btn" data-delete="${f.friend_aurora_id}" data-name="${escapeHTML(f.friend_name)}" title="删除好友">&times;</button>
            <div class="friend-avatar">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
                    ${getAvatarSVG(f.friend_avatar)}
                </svg>
            </div>
            <div class="friend-name">${escapeHTML(f.friend_name)}</div>
            <div class="friend-met-at">在 ${escapeHTML(f.location_name)} 相遇</div>
            <input class="friend-note-input" data-note="${f.friend_aurora_id}" value="${escapeHTML(f.note || '')}" placeholder="添加备注..." maxlength="20">
            <div class="friend-actions">
                <button class="btn-sm btn-sm-outline" data-action="profile" data-friend="${f.friend_name}">查看</button>
                <button class="btn-sm btn-sm-primary" data-action="letter" data-friend="${f.friend_name}">写信</button>
            </div>
        </div>
    `).join('');

    // 写信按钮
    grid.querySelectorAll('[data-action="letter"]').forEach(btn => {
        btn.addEventListener('click', () => {
            const friendName = btn.dataset.friend;
            const select = document.getElementById('composeRecipient');
            select.innerHTML = FAKE_PROFILES.map(p =>
                `<option value="${p.id}" ${p.name === friendName ? 'selected' : ''}>${p.name} (${p.nameCN})</option>`
            ).join('');
            document.getElementById('composeContent').value = '';
            document.getElementById('composeCount').textContent = '0';
            document.getElementById('composeError').textContent = '';
            document.getElementById('btnSendLetter').disabled = true;
            document.getElementById('composeTitle').textContent = `写给 ${friendName}`;
            document.getElementById('composeModal').classList.add('open');
        });
    });

    // 查看按钮
    grid.querySelectorAll('[data-action="profile"]').forEach(btn => {
        btn.addEventListener('click', () => {
            showToast(`${btn.dataset.friend} 的个人主页`);
        });
    });

    // 删除好友
    grid.querySelectorAll('[data-delete]').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!confirm(`确定删除好友 ${btn.dataset.name} 吗？`)) return;
            const user = loadData(STORAGE_KEY);
            await sb.from('friends').delete().eq('user_aurora_id', user.auroraId).eq('friend_aurora_id', btn.dataset.delete);
            await sb.from('friends').delete().eq('user_aurora_id', btn.dataset.delete).eq('friend_aurora_id', user.auroraId);
            renderFriends();
            showToast('已删除好友');
        });
    });

    // 备注保存
    grid.querySelectorAll('.friend-note-input').forEach(input => {
        let saveTimer;
        input.addEventListener('input', () => {
            clearTimeout(saveTimer);
            saveTimer = setTimeout(async () => {
                const user = loadData(STORAGE_KEY);
                await sb.from('friends').update({ note: input.value })
                    .eq('user_aurora_id', user.auroraId)
                    .eq('friend_aurora_id', input.dataset.note);
            }, 600);
        });
    });
}

// ============================================================
// 18. 地图 + 好友事件绑定
// ============================================================

// 地图相关按钮
document.getElementById('btnCloseLocation').addEventListener('click', closeLocation);
document.getElementById('btnDropLetter').addEventListener('click', openDropLetter);
document.getElementById('btnFindLetter').addEventListener('click', findRandomLetter);
document.getElementById('btnCloseDropLetter').addEventListener('click', () => {
    document.getElementById('dropLetterModal').classList.remove('open');
});
document.getElementById('btnConfirmDrop').addEventListener('click', confirmDropLetter);
document.getElementById('btnCloseReadLetter').addEventListener('click', () => {
    document.getElementById('readLetterModal').classList.remove('open');
});

// 投信字数统计
document.getElementById('dropContent').addEventListener('input', () => {
    document.getElementById('dropCount').textContent = document.getElementById('dropContent').value.length;
});

// 随机前往地点
document.getElementById('btnRandomLocation').addEventListener('click', () => {
    const randomLoc = LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];
    openLocation(randomLoc.id);
});

// 好友搜索（已有好友内筛选）
document.getElementById('friendSearch').addEventListener('input', (e) => {
    renderFriends(e.target.value);
});

// 添加好友 — 从 Supabase 搜索
document.getElementById('btnAddFriend').addEventListener('click', async () => {
    const input = document.getElementById('addFriendInput').value.trim();
    const errorEl = document.getElementById('addFriendError');
    if (!input) {
        errorEl.textContent = '请输入对方的极光ID或名字';
        return;
    }
    errorEl.textContent = '';

    const user = loadData(STORAGE_KEY);
    if (!user) { showToast('请先注册'); return; }

    // 从 Supabase 搜索用户
    const { data: found } = await sb.from('profiles').select('*')
        .or(`aurora_id.eq.${input.toUpperCase()},name.ilike.%${input}%`)
        .limit(5);

    if (!found || found.length === 0) {
        errorEl.textContent = '未找到该用户，请确认ID或名字';
        return;
    }

    const target = found[0];
    if (target.aurora_id === user.auroraId) {
        errorEl.textContent = '这是你自己的ID哦';
        return;
    }

    // 检查是否已经是好友
    const { data: existing } = await sb.from('friends').select('*')
        .eq('user_aurora_id', user.auroraId)
        .eq('friend_aurora_id', target.aurora_id)
        .maybeSingle();

    if (existing) {
        errorEl.textContent = '已经是好友了';
        return;
    }

    // 双向添加好友
    await sb.from('friends').insert([
        { user_aurora_id: user.auroraId, friend_aurora_id: target.aurora_id, friend_name: target.name, friend_avatar: target.avatar, location_name: '搜索添加' },
        { user_aurora_id: target.aurora_id, friend_aurora_id: user.auroraId, friend_name: user.name, friend_avatar: user.avatar, location_name: '搜索添加' }
    ]);

    document.getElementById('addFriendInput').value = '';
    renderFriends();
    showToast(`已添加 ${target.name} 为好友！`);
});

// ============================================================
// 19. 初始化
// ============================================================
function init() {
    // 同步音乐UI
    updateAudioUI();
    // 初始化导航栏用户信息
    updateNavUser();

    // 检查hash
    const hash = window.location.hash.replace('#', '');
    const validViews = ['landing', 'register', 'home', 'discover', 'letters', 'diary', 'map', 'friends', 'profile', 'mbti'];
    const startView = validViews.includes(hash) ? hash : 'landing';

    // Landing页时启动极光
    if (startView === 'landing') startAurora();

    // 渲染注册页头像
    renderAvatarGrid();

    // 页加载时检查过期回复
    checkPendingResponses();

    switchView(startView);
}

function checkPendingResponses() {
    sentLetters = loadData(LETTERS_SENT_KEY, []);
    let changed = false;
    sentLetters.forEach(l => {
        if (l.status === 'delivered') {
            const elapsed = Date.now() - l.timestamp;
            if (elapsed > 20000) {
                // 生成回复
                const profile = FAKE_PROFILES.find(p => p.id === l.to);
                if (profile) {
                    const replies = [
                        `你的信像一缕穿过松林的光，落在我的下午。谢谢你的文字——在这个被极光照耀的世界里，能收到一封手写的温暖，真好。`,
                        `读到你的信时，窗外正下着雪。你说的话让我想起挪威的一句老话。很高兴认识你。`,
                        `谢谢你的来信。也许有一天，我们可以在极光下喝杯咖啡，聊聊那些信里写不下的故事。`,
                    ];
                    const reply = {
                        id: generateId(),
                        from: l.to, fromName: l.toName,
                        content: replies[Math.floor(Math.random() * replies.length)],
                        timestamp: Date.now(),
                        status: 'new', replyToId: l.id
                    };
                    receivedLetters = loadData(LETTERS_RECEIVED_KEY, []);
                    receivedLetters.unshift(reply);
                    saveData(LETTERS_RECEIVED_KEY, receivedLetters);
                    l.status = 'replied';
                    changed = true;
                }
            }
        }
    });
    if (changed) saveData(LETTERS_SENT_KEY, sentLetters);
}

// 启动
init();
