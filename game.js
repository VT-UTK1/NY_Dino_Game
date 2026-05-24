/**
 * NYC Dino Run - Premium Chrome Dinosaur Game NY Edition
 * Built with HTML5 Canvas, Vanilla Javascript, and Web Audio API
 */

// Game Constants
const CANVAS_WIDTH = 900;
const CANVAS_HEIGHT = 400;
const GROUND_Y = CANVAS_HEIGHT - 60;
const INITIAL_SPEED = 6;
const MAX_SPEED = 16;
const SPEED_ACCEL = 0.001;

// Global Game Variables
let canvas, ctx;
let gameState = 'MENU'; // MENU, PLAYING, GAMEOVER
let currentCharacter = 'rexy'; // rexy, pizza-rat, pigeon-pete
let currentScore = 0;
let highScore = 0;
let distance = 0;
let gameSpeed = INITIAL_SPEED;

// Game Systems
let player;
let obstacles = [];
let powerups = [];
let backgroundLayers = [];
let particles = [];
let soundSystem;

// Power-up States
let activeCoffeeTime = 0; // In frames
let activePizzaTime = 0; // In frames
const COFFEE_DURATION = 300; // 5 seconds at 60fps
const PIZZA_DURATION = 360;  // 6 seconds at 60fps
let coffeeCollected = 0;
let pizzaEaten = 0;

// Input State
const keys = {};

// Character Statistics & Parameters
const CHAR_PROFILES = {
    'rexy': {
        width: 55,
        height: 60,
        jumpForce: 13,
        gravity: 0.62,
        avatar: '🦖',
        description: 'Rexy the Yorker'
    },
    'pizza-rat': {
        width: 50,
        height: 40,
        jumpForce: 10,
        gravity: 0.52,
        doubleJumpAllowed: true,
        avatar: '🐀',
        description: 'Pizza Rat'
    },
    'pigeon-pete': {
        width: 48,
        height: 44,
        jumpForce: 7.5,
        gravity: 0.35,
        canHover: true,
        avatar: '🐦',
        description: 'Pigeon Pete'
    }
};

// ==========================================
// 1. SOUND SYSTEM (WEB AUDIO API)
// ==========================================
class SoundSystem {
    constructor() {
        this.ctx = null;
        this.isMuted = false;
        this.musicNode = null;
        this.musicPlaying = false;
        this.tempo = 135; // BPM
        this.musicIntervalId = null;
        this.musicStep = 0;

        // Chiptune Melodies & Basslines
        this.bassSequence = [
            'A1', 'A1', 'C2', 'C2', 'D2', 'D2', 'G1', 'G1',
            'A1', 'A1', 'C2', 'C2', 'E2', 'E2', 'D2', 'G1'
        ];
        this.melodySequence = [
            'E4', 'G4', 'A4', null, 'G4', 'E4', 'D4', null,
            'C4', 'E4', 'G4', 'A4', 'C5', 'A4', 'G4', 'E4',
            'A4', null, 'C5', null, 'D5', 'C5', 'A4', null,
            'G4', 'E4', 'D4', 'C4', 'D4', null, 'E4', null
        ];

        this.noteFreqs = {
            'A1': 55.00, 'G1': 49.00, 'C2': 65.41, 'D2': 73.42, 'E2': 82.41,
            'C4': 261.63, 'D4': 293.66, 'E4': 329.63, 'G4': 392.00, 'A4': 440.00,
            'C5': 523.25, 'D5': 587.33
        };
    }

    init() {
        if (this.ctx) return;
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
            this.ctx = new AudioContextClass();
        }
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        const btn = document.getElementById('audio-toggle-btn');
        const icon = document.getElementById('audio-icon');
        
        if (this.isMuted) {
            icon.innerText = '🔇';
            btn.classList.add('muted');
            this.stopMusic();
        } else {
            icon.innerText = '🔊';
            btn.classList.remove('muted');
            this.init();
            if (gameState === 'PLAYING') {
                this.startMusic();
            }
        }
    }

    playJump() {
        if (this.isMuted || !this.ctx) return;
        this.init();
        
        const osc = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();
        
        osc.connect(gainNode);
        gainNode.connect(this.ctx.destination);
        
        osc.type = 'triangle';
        const now = this.ctx.currentTime;
        
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(700, now + 0.12);
        
        gainNode.gain.setValueAtTime(0.2, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
        
        osc.start(now);
        osc.stop(now + 0.12);
    }

    playDuck() {
        if (this.isMuted || !this.ctx) return;
        this.init();
        
        const osc = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();
        
        osc.connect(gainNode);
        gainNode.connect(this.ctx.destination);
        
        osc.type = 'triangle';
        const now = this.ctx.currentTime;
        
        osc.frequency.setValueAtTime(350, now);
        osc.frequency.linearRampToValueAtTime(100, now + 0.08);
        
        gainNode.gain.setValueAtTime(0.18, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
        
        osc.start(now);
        osc.stop(now + 0.08);
    }

    playPoint() {
        if (this.isMuted || !this.ctx) return;
        this.init();
        
        const now = this.ctx.currentTime;
        
        const playTone = (freq, start, duration) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.type = 'square';
            osc.frequency.setValueAtTime(freq, start);
            gain.gain.setValueAtTime(0.1, start);
            gain.gain.exponentialRampToValueAtTime(0.005, start + duration);
            osc.start(start);
            osc.stop(start + duration);
        };
        
        playTone(880, now, 0.07);
        playTone(1046, now + 0.07, 0.14);
    }

    playCoffee() {
        if (this.isMuted || !this.ctx) return;
        this.init();
        
        const now = this.ctx.currentTime;
        
        const notes = [440, 554, 659, 880];
        notes.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + idx * 0.06);
            gain.gain.setValueAtTime(0.15, now + idx * 0.06);
            gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.06 + 0.25);
            osc.start(now + idx * 0.06);
            osc.stop(now + idx * 0.06 + 0.25);
        });
    }

    playPizza() {
        if (this.isMuted || !this.ctx) return;
        this.init();
        
        const bufferSize = this.ctx.sampleRate * 0.15;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 1000;
        
        const gain = this.ctx.createGain();
        const now = this.ctx.currentTime;
        
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        
        noise.start(now);
    }

    playCrash() {
        if (this.isMuted || !this.ctx) return;
        this.init();
        
        const now = this.ctx.currentTime;
        
        const osc = this.ctx.createOscillator();
        const gainOsc = this.ctx.createGain();
        osc.connect(gainOsc);
        gainOsc.connect(this.ctx.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.linearRampToValueAtTime(30, now + 0.5);
        gainOsc.gain.setValueAtTime(0.25, now);
        gainOsc.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
        
        const bufferSize = this.ctx.sampleRate * 0.4;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 400;
        
        const gainNoise = this.ctx.createGain();
        gainNoise.gain.setValueAtTime(0.3, now);
        gainNoise.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
        
        noise.connect(filter);
        filter.connect(gainNoise);
        gainNoise.connect(this.ctx.destination);
        
        noise.start(now);
    }

    startMusic() {
        if (this.isMuted) return;
        this.init();
        if (this.musicPlaying) return;
        this.musicPlaying = true;
        this.musicStep = 0;

        const stepDuration = 60 / this.tempo / 2; // Eighth notes
        
        const playSequenceStep = () => {
            if (!this.musicPlaying || this.isMuted) return;
            
            const now = this.ctx.currentTime;
            
            // Bassline
            const bassNote = this.bassSequence[this.musicStep % this.bassSequence.length];
            if (bassNote && this.noteFreqs[bassNote]) {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.type = 'square';
                osc.frequency.setValueAtTime(this.noteFreqs[bassNote], now);
                
                if (activeCoffeeTime > 0) {
                    osc.frequency.setValueAtTime(this.noteFreqs[bassNote] * 2, now);
                }
                
                gain.gain.setValueAtTime(0.04, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + stepDuration * 0.85);
                osc.start(now);
                osc.stop(now + stepDuration * 0.95);
            }
            
            // Melody (Triangle)
            const melodyNote = this.melodySequence[this.musicStep % this.melodySequence.length];
            if (melodyNote && this.noteFreqs[melodyNote]) {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(this.noteFreqs[melodyNote], now);
                
                if (activeCoffeeTime > 0) {
                    osc.type = 'sawtooth';
                    osc.frequency.exponentialRampToValueAtTime(this.noteFreqs[melodyNote] * 1.2, now + stepDuration);
                    gain.gain.setValueAtTime(0.04, now);
                } else {
                    gain.gain.setValueAtTime(0.06, now);
                }
                
                gain.gain.exponentialRampToValueAtTime(0.001, now + stepDuration * 1.8);
                osc.start(now);
                osc.stop(now + stepDuration * 1.9);
            }
            
            // Retro Hi-hat noise trigger
            if (this.musicStep % 4 === 2) {
                const noise = this.ctx.createBufferSource();
                const noiseBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.03, this.ctx.sampleRate);
                const data = noiseBuffer.getChannelData(0);
                for (let i = 0; i < data.length; i++) {
                    data[i] = Math.random() * 2 - 1;
                }
                noise.buffer = noiseBuffer;
                
                const filter = this.ctx.createBiquadFilter();
                filter.type = 'highpass';
                filter.frequency.value = 7000;
                
                const gain = this.ctx.createGain();
                gain.gain.setValueAtTime(0.015, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
                
                noise.connect(filter);
                filter.connect(gain);
                gain.connect(this.ctx.destination);
                noise.start(now);
            }

            this.musicStep++;
            this.musicIntervalId = setTimeout(playSequenceStep, stepDuration * 1000);
        };

        playSequenceStep();
    }

    stopMusic() {
        this.musicPlaying = false;
        if (this.musicIntervalId) {
            clearTimeout(this.musicIntervalId);
            this.musicIntervalId = null;
        }
    }
}

soundSystem = new SoundSystem();

// ==========================================
// 2. PARALLAX SKYLINE LAYERS
// ==========================================
class BackgroundLayer {
    constructor(speedMult, color, drawFunc) {
        this.speedMult = speedMult;
        this.x = 0;
        this.color = color;
        this.drawFunc = drawFunc;
    }

    update() {
        this.x -= gameSpeed * this.speedMult;
        if (this.x <= -CANVAS_WIDTH) {
            this.x = 0;
        }
    }

    draw() {
        ctx.save();
        ctx.fillStyle = this.color;
        
        ctx.translate(this.x, 0);
        this.drawFunc(this.color);
        ctx.translate(CANVAS_WIDTH, 0);
        this.drawFunc(this.color);
        
        ctx.restore();
    }
}

function createBackgrounds() {
    backgroundLayers = [];

    // Layer 1: Silhouette Landmarks (Statue of Liberty, Empire State)
    backgroundLayers.push(new BackgroundLayer(0.05, 'rgba(34, 25, 68, 0.45)', (color) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        // Statue pedestal
        ctx.fillRect(100, GROUND_Y - 95, 45, 35);
        ctx.fillRect(105, GROUND_Y - 110, 35, 15);
        ctx.fillRect(115, GROUND_Y - 150, 15, 40);
        ctx.arc(122.5, GROUND_Y - 158, 6, 0, Math.PI * 2);
        // Crown
        ctx.moveTo(118, GROUND_Y - 163); ctx.lineTo(112, GROUND_Y - 165);
        ctx.moveTo(122, GROUND_Y - 164); ctx.lineTo(122, GROUND_Y - 170);
        ctx.moveTo(127, GROUND_Y - 163); ctx.lineTo(133, GROUND_Y - 165);
        // Torch
        ctx.fillRect(128, GROUND_Y - 165, 5, 20);
        ctx.fillRect(130, GROUND_Y - 170, 7, 7);
        ctx.fill();

        // Empire State
        ctx.beginPath();
        ctx.fillRect(520, GROUND_Y - 260, 45, 200);
        ctx.fillRect(527, GROUND_Y - 290, 31, 30);
        ctx.fillRect(537, GROUND_Y - 330, 11, 40);
        ctx.fillRect(541, GROUND_Y - 365, 3, 35);
        ctx.fill();

        // Extra Far Buildings
        ctx.fillRect(300, GROUND_Y - 120, 30, 60);
        ctx.fillRect(340, GROUND_Y - 140, 45, 80);
        ctx.fillRect(720, GROUND_Y - 130, 35, 70);
    }));

    // Layer 2: Midtown Buildings & Brooklyn Bridge
    backgroundLayers.push(new BackgroundLayer(0.18, 'rgba(56, 42, 102, 0.65)', (color) => {
        ctx.fillStyle = color;
        ctx.fillRect(40, GROUND_Y - 160, 50, 100);
        ctx.fillRect(110, GROUND_Y - 200, 60, 140);
        
        // Brooklyn Bridge Tower
        ctx.beginPath();
        ctx.fillRect(240, GROUND_Y - 190, 18, 130);
        ctx.fillRect(290, GROUND_Y - 190, 18, 130);
        ctx.fillRect(240, GROUND_Y - 180, 68, 15);
        ctx.fillRect(240, GROUND_Y - 130, 68, 12);
        ctx.arc(269, GROUND_Y - 100, 14, Math.PI, 0);
        ctx.arc(269, GROUND_Y - 50, 14, Math.PI, 0);
        ctx.moveTo(200, GROUND_Y - 70);
        ctx.quadraticCurveTo(245, GROUND_Y - 160, 258, GROUND_Y - 160);
        ctx.moveTo(290, GROUND_Y - 160);
        ctx.quadraticCurveTo(320, GROUND_Y - 150, 380, GROUND_Y - 60);
        ctx.fill();

        // Chrysler Building
        ctx.beginPath();
        ctx.fillRect(660, GROUND_Y - 200, 55, 140);
        ctx.fillRect(670, GROUND_Y - 230, 35, 30);
        ctx.moveTo(670, GROUND_Y - 230);
        ctx.lineTo(687.5, GROUND_Y - 290);
        ctx.lineTo(705, GROUND_Y - 230);
        ctx.closePath();
        ctx.fill();
        ctx.fillRect(686, GROUND_Y - 320, 3, 30);

        ctx.fillRect(400, GROUND_Y - 170, 45, 110);
        ctx.fillRect(470, GROUND_Y - 210, 65, 150);
        ctx.fillRect(800, GROUND_Y - 180, 50, 120);
    }));

    // Layer 3: Street Lights, Highway signage
    backgroundLayers.push(new BackgroundLayer(0.65, 'rgba(84, 66, 145, 0.8)', (color) => {
        ctx.fillStyle = color;
        
        const drawStreetlamp = (x) => {
            ctx.fillRect(x, GROUND_Y - 120, 4, 120);
            ctx.fillRect(x - 12, GROUND_Y - 120, 16, 5);
            ctx.beginPath();
            ctx.arc(x - 10, GROUND_Y - 114, 4, 0, Math.PI * 2);
            ctx.fill();
            
            if (currentScore > 500) {
                ctx.save();
                const grad = ctx.createRadialGradient(x - 10, GROUND_Y - 114, 2, x - 10, GROUND_Y - 70, 50);
                grad.addColorStop(0, 'rgba(255, 230, 100, 0.25)');
                grad.addColorStop(1, 'rgba(255, 230, 100, 0)');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.moveTo(x - 10, GROUND_Y - 114);
                ctx.lineTo(x - 55, GROUND_Y);
                ctx.lineTo(x + 35, GROUND_Y);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
            }
        };

        drawStreetlamp(150);
        drawStreetlamp(600);

        // Highway green sign
        ctx.fillStyle = color;
        ctx.fillRect(380, GROUND_Y - 130, 6, 130);
        ctx.fillRect(470, GROUND_Y - 130, 6, 130);
        ctx.fillStyle = '#0f612d';
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.fillRect(360, GROUND_Y - 130, 130, 50);
        ctx.strokeRect(360, GROUND_Y - 130, 130, 50);
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.fillRect(375, GROUND_Y - 118, 45, 4);
        ctx.fillRect(375, GROUND_Y - 108, 100, 4);
    }));
}

function drawSky() {
    ctx.save();
    const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    
    if (currentScore < 400) {
        grad.addColorStop(0, '#09081a');
        grad.addColorStop(0.5, '#2c1530');
        grad.addColorStop(1, '#ff6e40');
    } else if (currentScore < 1000) {
        grad.addColorStop(0, '#020108');
        grad.addColorStop(0.5, '#110b29');
        grad.addColorStop(1, '#661642');
    } else {
        grad.addColorStop(0, '#000000');
        grad.addColorStop(0.6, '#060312');
        grad.addColorStop(1, '#0e0b24');
    }
    
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.restore();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    for (let i = 0; i < 40; i++) {
        let starX = (i * 12345) % CANVAS_WIDTH;
        let starY = (i * 54321) % (GROUND_Y - 80);
        ctx.fillRect(starX, starY, 1.5, 1.5);
    }
}

function drawGround() {
    ctx.save();
    
    // Asphalt
    ctx.fillStyle = '#06050b';
    ctx.fillRect(0, GROUND_Y, CANVAS_WIDTH, CANVAS_HEIGHT - GROUND_Y);
    
    // Sidewalk border line (Pink)
    ctx.fillStyle = '#ff2a85';
    ctx.fillRect(0, GROUND_Y, CANVAS_WIDTH, 4);
    
    // Curb depth
    ctx.fillStyle = '#171424';
    ctx.fillRect(0, GROUND_Y + 4, CANVAS_WIDTH, 8);
    
    // Road center markings
    ctx.fillStyle = '#ffbd00';
    let stripeWidth = 50;
    let stripeGap = 60;
    let totalLength = stripeWidth + stripeGap;
    let offsetX = (-distance) % totalLength;
    
    for (let x = offsetX; x < CANVAS_WIDTH + totalLength; x += totalLength) {
        ctx.fillRect(x, GROUND_Y + 28, stripeWidth, 5);
    }
    
    ctx.restore();
}

// ==========================================
// 3. PARTICLES ENGINE
// ==========================================
class Particle {
    constructor(x, y, vx, vy, size, color, maxLife) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.size = size;
        this.color = color;
        this.maxLife = maxLife;
        this.life = maxLife;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life--;
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.life / this.maxLife;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

function spawnSteam() {
    if (Math.random() < 0.25) {
        let x = CANVAS_WIDTH + 10;
        let y = GROUND_Y + 15 + Math.random() * 20;
        let vy = -0.5 - Math.random() * 0.8;
        let vx = -gameSpeed + (Math.random() - 0.5) * 0.5;
        let size = 5 + Math.random() * 12;
        particles.push(new Particle(x, y, vx, vy, size, 'rgba(255, 255, 255, 0.15)', 80));
    }
}

function spawnSparks(x, y, color) {
    for (let i = 0; i < 20; i++) {
        let vx = (Math.random() - 0.5) * 8;
        let vy = -3 - Math.random() * 6;
        let size = 2 + Math.random() * 4;
        let life = 30 + Math.random() * 20;
        particles.push(new Particle(x, y, vx, vy, size, color, life));
    }
}

// ==========================================
// 4. CHARACTER / PLAYER CLASS
// ==========================================
class Player {
    constructor(type) {
        this.type = type;
        const profile = CHAR_PROFILES[type];
        
        this.x = 80;
        this.y = GROUND_Y - profile.height;
        this.width = profile.width;
        this.height = profile.height;
        this.defaultHeight = profile.height;
        
        this.vy = 0;
        this.jumpForce = profile.jumpForce;
        this.gravity = profile.gravity;
        
        this.isJumping = false;
        this.isDucking = false;
        this.doubleJumped = false;
        
        this.runFrame = 0;
        
        document.getElementById('hud-avatar').innerText = profile.avatar;
    }

    jump() {
        if (!this.isJumping) {
            this.vy = -this.jumpForce;
            this.isJumping = true;
            this.doubleJumped = false;
            soundSystem.playJump();
        } else if (CHAR_PROFILES[this.type].doubleJumpAllowed && !this.doubleJumped) {
            this.vy = -this.jumpForce * 0.85;
            this.doubleJumped = true;
            soundSystem.playJump();
            spawnSparks(this.x + this.width / 2, this.y + this.height, '#ffbd00');
        } else if (CHAR_PROFILES[this.type].canHover) {
            this.vy = -this.jumpForce * 0.6;
            soundSystem.playJump();
        }
    }

    duck(isCrouching) {
        if (isCrouching) {
            if (!this.isDucking && !this.isJumping) {
                soundSystem.playDuck();
            }
            this.isDucking = true;
            this.height = this.defaultHeight * 0.6;
        } else {
            this.isDucking = false;
            this.height = this.defaultHeight;
        }
    }

    update() {
        let activeGravity = this.gravity;
        if (activeCoffeeTime > 0) activeGravity *= 0.85;

        this.vy += activeGravity;
        this.y += this.vy;

        let bottomLimit = GROUND_Y - this.height;
        if (this.y >= bottomLimit) {
            this.y = bottomLimit;
            this.vy = 0;
            this.isJumping = false;
            this.doubleJumped = false;
        }

        if (!this.isJumping) {
            this.runFrame += gameSpeed * 0.035;
        }

        if (activeCoffeeTime > 0 && Math.random() < 0.4) {
            particles.push(new Particle(
                this.x + Math.random() * this.width,
                this.y + Math.random() * this.height,
                -2,
                -1 + Math.random() * 2,
                2 + Math.random() * 3,
                'rgba(255, 42, 133, 0.8)',
                25
            ));
        }
    }

    draw() {
        ctx.save();
        
        if (activeCoffeeTime > 0) {
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#ff2a85';
        } else if (activePizzaTime > 0) {
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#ffbd00';
        }

        if (this.type === 'rexy') {
            this.drawRexy();
        } else if (this.type === 'pizza-rat') {
            this.drawPizzaRat();
        } else if (this.type === 'pigeon-pete') {
            this.drawPigeonPete();
        }

        ctx.restore();
    }

    drawRexy() {
        let isRightFootDown = Math.sin(this.runFrame) > 0;
        ctx.translate(this.x, this.y);
        ctx.fillStyle = '#00f0ff'; // Teal body

        // Tail
        ctx.beginPath();
        ctx.moveTo(0, this.height - 20);
        ctx.quadraticCurveTo(15, this.height - 15, 25, this.height - 35);
        ctx.lineTo(25, this.height - 20);
        ctx.quadraticCurveTo(15, this.height - 5, 0, this.height - 20);
        ctx.fill();

        ctx.fillRect(15, this.height - 45, 24, 28); // torso

        if (this.isDucking) {
            ctx.fillRect(25, this.height - 38, 25, 20); // neck
            ctx.fillRect(35, this.height - 43, 22, 16); // head
        } else {
            ctx.fillRect(28, this.height - 58, 12, 20);
            ctx.fillRect(26, this.height - 64, 28, 16);
        }

        // Cool sunglasses
        ctx.fillStyle = '#020108';
        let sunglassesX = this.isDucking ? 46 : 42;
        let sunglassesY = this.isDucking ? this.height - 40 : this.height - 61;
        ctx.fillRect(sunglassesX, sunglassesY, 11, 4);
        ctx.fillStyle = '#ff2a85';
        ctx.fillRect(sunglassesX + 4, sunglassesY + 1, 3, 2);

        // Red cap backwards
        ctx.fillStyle = '#ff2a85';
        let capX = this.isDucking ? 30 : 28;
        let capY = this.isDucking ? this.height - 47 : this.height - 68;
        ctx.beginPath();
        ctx.arc(capX + 12, capY + 4, 7, Math.PI, 0);
        ctx.fill();
        ctx.fillRect(capX + 1, capY + 2, 8, 2); // visor
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(capX + 5, capY + 2, 2, 2);

        // Running Legs
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        
        ctx.beginPath();
        ctx.moveTo(22, this.height - 18);
        ctx.lineTo(this.isJumping ? 18 : (isRightFootDown ? 28 : 16), this.height - 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(32, this.height - 18);
        ctx.lineTo(this.isJumping ? 34 : (isRightFootDown ? 20 : 36), this.height - 2);
        ctx.stroke();
    }

    drawPizzaRat() {
        let isScuttling = Math.sin(this.runFrame * 1.5) > 0;
        ctx.translate(this.x, this.y);

        ctx.strokeStyle = '#ffa0bc';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(3, this.height - 12);
        ctx.quadraticCurveTo(isScuttling ? -10 : -12, isScuttling ? this.height - 18 : this.height - 6, -18, isScuttling ? this.height - 8 : this.height - 14);
        ctx.stroke();

        ctx.fillStyle = '#8a85a0';
        ctx.beginPath();
        ctx.ellipse(25, this.height - 18, 18, 11, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillRect(41, this.height - 19, 5, 4);
        ctx.fillStyle = '#ffa0bc';
        ctx.fillRect(44, this.height - 18, 2, 2);

        ctx.fillStyle = '#8a85a0';
        ctx.beginPath();
        ctx.arc(28, this.height - 28, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffa0bc';
        ctx.beginPath();
        ctx.arc(28, this.height - 28, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#020108';
        ctx.fillRect(36, this.height - 24, 6, 4);

        ctx.fillStyle = '#ffa0bc';
        ctx.fillRect(isScuttling ? 15 : 20, this.height - 8, 3, 8);
        ctx.fillRect(isScuttling ? 22 : 17, this.height - 8, 3, 8);
        ctx.fillRect(isScuttling ? 30 : 33, this.height - 8, 3, 8);

        // Huge Pizza Slice on Rat's back
        ctx.save();
        ctx.translate(12, this.height - 35);
        ctx.rotate(-0.25);
        ctx.fillStyle = '#de8812';
        ctx.fillRect(0, 0, 5, 20);
        ctx.fillStyle = '#ffd400';
        ctx.beginPath();
        ctx.moveTo(5, 0);
        ctx.lineTo(24, 10);
        ctx.lineTo(5, 20);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ff2a85';
        ctx.fillRect(8, 5, 3, 3);
        ctx.fillRect(14, 9, 3, 3);
        ctx.fillRect(7, 12, 3, 3);
        ctx.restore();
    }

    drawPigeonPete() {
        let isFlapping = Math.sin(this.runFrame * 1.8) > 0;
        ctx.translate(this.x, this.y);

        ctx.strokeStyle = '#ff5a00';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(20, this.height - 14);
        ctx.lineTo(17, this.height - 2);
        ctx.moveTo(28, this.height - 14);
        ctx.lineTo(31, this.height - 2);
        ctx.stroke();

        ctx.fillStyle = '#7a869a';
        ctx.beginPath();
        ctx.ellipse(24, this.height - 24, 17, 13, 0.1, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#12b070';
        ctx.fillRect(29, this.height - 35, 9, 7);

        ctx.fillStyle = '#7a869a';
        ctx.beginPath();
        ctx.arc(36, this.height - 37, 7, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffbd00';
        ctx.beginPath();
        ctx.moveTo(42, this.height - 39);
        ctx.lineTo(48, this.height - 36);
        ctx.lineTo(42, this.height - 33);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#020108';
        ctx.fillRect(36, this.height - 40, 7, 3);

        ctx.fillStyle = '#596375';
        ctx.beginPath();
        if (isFlapping || this.isJumping) {
            ctx.ellipse(15, this.height - 27, 10, 14, -0.6, 0, Math.PI * 2);
        } else {
            ctx.ellipse(18, this.height - 23, 11, 8, 0.3, 0, Math.PI * 2);
        }
        ctx.fill();
    }
}

// ==========================================
// 5. OBSTACLES CLASS
// ==========================================
class Obstacle {
    constructor(type) {
        this.type = type;
        this.x = CANVAS_WIDTH + 50;
        
        if (type === 'hydrant') {
            this.width = 30;
            this.height = 42 + Math.random() * 12;
            this.y = GROUND_Y - this.height;
            this.isSpraying = Math.random() < 0.35;
        } else if (type === 'cab') {
            this.width = 75;
            this.height = 40;
            this.y = GROUND_Y - this.height;
            this.speedBoost = 2.5 + Math.random() * 2;
        } else if (type === 'flying-pigeon') {
            this.width = 36;
            this.height = 24;
            this.y = GROUND_Y - 55 - Math.random() * 25;
            this.flapSpeed = 0;
        }
    }

    update() {
        let actualSpeed = gameSpeed;
        if (this.type === 'cab') actualSpeed += this.speedBoost;
        
        this.x -= actualSpeed;
        
        if (this.type === 'hydrant' && this.isSpraying && Math.random() < 0.25) {
            particles.push(new Particle(
                this.x,
                this.y + 12,
                -gameSpeed - 2 - Math.random() * 3,
                -0.5 + Math.random() * 1,
                2 + Math.random() * 3,
                'rgba(0, 240, 255, 0.45)',
                20
            ));
        }

        if (this.type === 'flying-pigeon') {
            this.flapSpeed += 0.2;
        }
    }

    draw() {
        ctx.save();
        if (this.type === 'hydrant') this.drawHydrant();
        else if (this.type === 'cab') this.drawCab();
        else if (this.type === 'flying-pigeon') this.drawFlyingPigeon();
        ctx.restore();
    }

    drawHydrant() {
        ctx.translate(this.x, this.y);
        ctx.fillStyle = '#ff2a85';
        
        ctx.fillRect(0, this.height - 6, this.width, 6);
        ctx.fillRect(4, 10, this.width - 8, this.height - 16);
        ctx.beginPath();
        ctx.arc(this.width / 2, 10, (this.width - 8) / 2, Math.PI, 0);
        ctx.fill();
        
        ctx.fillStyle = '#ffbd00';
        ctx.fillRect(this.width / 2 - 3, 2, 6, 4);
        ctx.fillRect(0, 16, 4, 8);
        ctx.fillRect(this.width - 4, 16, 4, 8);
        ctx.fillRect(this.width / 2 - 5, 20, 10, 8);

        if (this.isSpraying) {
            ctx.strokeStyle = 'rgba(0, 240, 255, 0.5)';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(-2, 24);
            ctx.lineTo(-24, 22);
            ctx.moveTo(-4, 25);
            ctx.lineTo(-18, 28);
            ctx.stroke();
        }
    }

    drawCab() {
        ctx.translate(this.x, this.y);
        
        ctx.fillStyle = '#ffbd00';
        ctx.fillRect(0, 15, this.width, 20);
        ctx.fillRect(20, 3, 38, 14);
        
        ctx.fillStyle = '#06050b';
        ctx.fillRect(24, 6, 14, 9);
        ctx.fillRect(41, 6, 13, 9);

        ctx.fillStyle = activeCoffeeTime > 0 ? '#ff2a85' : '#ffffff';
        ctx.fillRect(32, 0, 14, 4);
        
        ctx.fillStyle = '#020108';
        let checkerX = 0;
        while (checkerX < this.width) {
            ctx.fillRect(checkerX, 15, 5, 4);
            checkerX += 10;
        }

        let wheelRotation = (distance * 0.15) % (Math.PI * 2);
        
        const drawWheel = (wx, wy) => {
            ctx.save();
            ctx.translate(wx, wy);
            ctx.rotate(wheelRotation);
            ctx.fillStyle = '#0a0914';
            ctx.beginPath();
            ctx.arc(0, 0, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-6, 0); ctx.lineTo(6, 0);
            ctx.moveTo(0, -6); ctx.lineTo(0, 6);
            ctx.stroke();
            ctx.restore();
        };

        drawWheel(16, 33);
        drawWheel(this.width - 16, 33);
    }

    drawFlyingPigeon() {
        let wingFlap = Math.sin(this.flapSpeed) > 0;
        ctx.translate(this.x, this.y);

        ctx.fillStyle = '#7a869a';
        ctx.beginPath();
        ctx.ellipse(this.width / 2, this.height / 2, 14, 8, -0.15, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(10, this.height / 2 - 3, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffbd00';
        ctx.fillRect(3, this.height / 2 - 4, 3, 2);

        ctx.fillStyle = '#596375';
        ctx.beginPath();
        if (wingFlap) {
            ctx.ellipse(this.width / 2 + 2, this.height / 2 - 8, 6, 12, 0.4, 0, Math.PI * 2);
        } else {
            ctx.ellipse(this.width / 2 + 2, this.height / 2 + 6, 6, 12, -0.4, 0, Math.PI * 2);
        }
        ctx.fill();
    }
}

// ==========================================
// 6. POWER-UPS CLASS
// ==========================================
class PowerUp {
    constructor() {
        this.x = CANVAS_WIDTH + 80;
        this.type = Math.random() < 0.5 ? 'coffee' : 'pizza';
        this.y = GROUND_Y - 50 - Math.random() * 65;
        this.width = 30;
        this.height = 30;
        this.bobOffset = Math.random() * 100;
    }

    update() {
        this.x -= gameSpeed;
    }

    draw() {
        ctx.save();
        let bobY = Math.sin((distance * 0.1) + this.bobOffset) * 5;
        ctx.translate(this.x, this.y + bobY);

        ctx.beginPath();
        ctx.arc(15, 15, 18, 0, Math.PI * 2);
        ctx.fillStyle = this.type === 'coffee' ? 'rgba(255, 110, 0, 0.15)' : 'rgba(255, 230, 0, 0.15)';
        ctx.fill();

        if (this.type === 'coffee') this.drawCoffee();
        else this.drawPizza();
        ctx.restore();
    }

    drawCoffee() {
        // Blue & White Greek Anthora Cup
        ctx.fillStyle = '#007fff';
        ctx.fillRect(5, 5, 20, 20);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(4, 5, 22, 3);
        ctx.fillRect(7, 24, 16, 2);
        ctx.fillStyle = '#ffd400';
        ctx.fillRect(5, 12, 20, 2);
        
        let steamPhase = (distance * 0.08) % 10;
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(10, 2 - steamPhase);
        ctx.quadraticCurveTo(8, -2 - steamPhase, 10, -5 - steamPhase);
        ctx.moveTo(18, 2 - steamPhase);
        ctx.quadraticCurveTo(16, -2 - steamPhase, 18, -5 - steamPhase);
        ctx.stroke();
    }

    drawPizza() {
        ctx.translate(5, 5);
        ctx.rotate(0.3);
        ctx.fillStyle = '#de8812';
        ctx.fillRect(0, 0, 4, 16);
        ctx.fillStyle = '#ffd400';
        ctx.beginPath();
        ctx.moveTo(4, 0);
        ctx.lineTo(20, 8);
        ctx.lineTo(4, 16);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ff2a85';
        ctx.fillRect(6, 4, 3, 3);
        ctx.fillRect(11, 7, 3, 3);
        ctx.fillRect(5, 10, 3, 3);
    }
}

// ==========================================
// 7. COLLISION & LOGIC LOOPS
// ==========================================
function checkCollisions() {
    obstacles.forEach((obs, index) => {
        let playerBox = {
            left: player.x + 8,
            right: player.x + player.width - 8,
            top: player.y + 6,
            bottom: player.y + player.height
        };
        
        let obsBox = {
            left: obs.x + 4,
            right: obs.x + obs.width - 4,
            top: obs.y + 4,
            bottom: obs.y + obs.height
        };

        if (playerBox.right > obsBox.left &&
            playerBox.left < obsBox.right &&
            playerBox.bottom > obsBox.top &&
            playerBox.top < obsBox.bottom) {
            
            if (activeCoffeeTime > 0) {
                spawnSparks(obs.x + obs.width / 2, obs.y + obs.height / 2, '#00f0ff');
                soundSystem.playPizza(); // smash
                obstacles.splice(index, 1);
                currentScore += 100;
            } else if (activePizzaTime > 0) {
                spawnSparks(obs.x + obs.width / 2, obs.y + obs.height / 2, '#ffbd00');
                soundSystem.playPizza(); // shield smash
                activePizzaTime = 0;
                document.getElementById('pizza-timer').classList.add('hidden');
                obstacles.splice(index, 1);
            } else {
                triggerGameOver();
            }
        }
    });

    powerups.forEach((pu, index) => {
        let playerBox = {
            left: player.x,
            right: player.x + player.width,
            top: player.y,
            bottom: player.y + player.height
        };

        let puBox = {
            left: pu.x,
            right: pu.x + pu.width,
            top: pu.y,
            bottom: pu.y + pu.height
        };

        if (playerBox.right > puBox.left &&
            playerBox.left < puBox.right &&
            playerBox.bottom > puBox.top &&
            playerBox.top < puBox.bottom) {
            
            spawnSparks(pu.x + 15, pu.y + 15, pu.type === 'coffee' ? '#ff9d00' : '#ffe600');
            
            if (pu.type === 'coffee') {
                coffeeCollected++;
                activeCoffeeTime = COFFEE_DURATION;
                activePizzaTime = 0;
                soundSystem.playCoffee();
                document.getElementById('coffee-timer').classList.remove('hidden');
                document.getElementById('pizza-timer').classList.add('hidden');
                document.getElementById('multiplier-badge').classList.remove('hidden');
            } else {
                pizzaEaten++;
                activePizzaTime = PIZZA_DURATION;
                activeCoffeeTime = 0;
                soundSystem.playPizza();
                document.getElementById('pizza-timer').classList.remove('hidden');
                document.getElementById('coffee-timer').classList.add('hidden');
                document.getElementById('multiplier-badge').classList.add('hidden');
            }

            powerups.splice(index, 1);
        }
    });
}

let obstacleSpawnTimer = 0;
let powerupSpawnTimer = 0;

function spawnGameItems() {
    obstacleSpawnTimer--;
    powerupSpawnTimer--;

    if (obstacleSpawnTimer <= 0) {
        let randomChoice = Math.random();
        let selectedType = 'hydrant';

        if (randomChoice < 0.45) selectedType = 'hydrant';
        else if (randomChoice < 0.78) selectedType = 'cab';
        else selectedType = 'flying-pigeon';

        obstacles.push(new Obstacle(selectedType));
        obstacleSpawnTimer = 65 + Math.random() * 80 - (gameSpeed * 2);
    }

    if (powerupSpawnTimer <= 0) {
        powerups.push(new PowerUp());
        powerupSpawnTimer = 220 + Math.random() * 180;
    }
}

// ==========================================
// 8. GAME CONTROL FLOW
// ==========================================
function startGame() {
    gameState = 'PLAYING';
    
    document.getElementById('menu-screen').classList.add('hidden');
    document.getElementById('gameover-screen').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');

    currentScore = 0;
    distance = 0;
    gameSpeed = INITIAL_SPEED;
    coffeeCollected = 0;
    pizzaEaten = 0;
    activeCoffeeTime = 0;
    activePizzaTime = 0;
    
    obstacles = [];
    powerups = [];
    particles = [];
    
    obstacleSpawnTimer = 100;
    powerupSpawnTimer = 160;

    document.getElementById('coffee-timer').classList.add('hidden');
    document.getElementById('pizza-timer').classList.add('hidden');
    document.getElementById('multiplier-badge').classList.add('hidden');

    player = new Player(currentCharacter);
    createBackgrounds();

    soundSystem.init();
    soundSystem.startMusic();
}

function triggerGameOver() {
    gameState = 'GAMEOVER';
    soundSystem.stopMusic();
    soundSystem.playCrash();

    if (currentScore > highScore) {
        highScore = currentScore;
        localStorage.setItem('nyc_dino_highscore', highScore);
        document.getElementById('high-score').innerText = padScore(highScore);
    }

    document.getElementById('final-score').innerText = padScore(currentScore);
    document.getElementById('final-hi-score').innerText = padScore(highScore);
    document.getElementById('final-coffee').innerText = coffeeCollected;
    document.getElementById('final-pizza').innerText = pizzaEaten;

    document.getElementById('gameover-screen').classList.remove('hidden');
}

function updateHUD() {
    distance++;
    
    let multiplier = 1;
    if (activeCoffeeTime > 0) multiplier = 3;

    if (distance % 5 === 0) {
        currentScore += 1 * multiplier;
        document.getElementById('current-score').innerText = padScore(currentScore);
        
        if (currentScore % 100 === 0 && currentScore > 0) {
            soundSystem.playPoint();
        }
    }

    if (activeCoffeeTime > 0) {
        activeCoffeeTime--;
        let ratio = activeCoffeeTime / COFFEE_DURATION;
        document.getElementById('coffee-bar').style.transform = `scaleX(${ratio})`;
        if (activeCoffeeTime === 0) {
            document.getElementById('coffee-timer').classList.add('hidden');
            document.getElementById('multiplier-badge').classList.add('hidden');
        }
    }

    if (activePizzaTime > 0) {
        activePizzaTime--;
        let ratio = activePizzaTime / PIZZA_DURATION;
        document.getElementById('pizza-bar').style.transform = `scaleX(${ratio})`;
        if (activePizzaTime === 0) {
            document.getElementById('pizza-timer').classList.add('hidden');
        }
    }
}

function padScore(score) {
    let str = score.toString();
    while (str.length < 5) str = '0' + str;
    return str;
}

// ==========================================
// 9. MAIN GAME LOOP
// ==========================================
function gameLoop() {
    if (gameState === 'PLAYING') {
        if (gameSpeed < MAX_SPEED) {
            gameSpeed += SPEED_ACCEL;
        }

        spawnSteam();

        player.update();
        backgroundLayers.forEach(layer => layer.update());
        
        obstacles.forEach((obs, index) => {
            obs.update();
            if (obs.x < -obs.width - 20) obstacles.splice(index, 1);
        });

        powerups.forEach((pu, index) => {
            pu.update();
            if (pu.x < -pu.width - 20) powerups.splice(index, 1);
        });

        particles.forEach((part, index) => {
            part.update();
            if (part.life <= 0) particles.splice(index, 1);
        });

        spawnGameItems();
        checkCollisions();
        updateHUD();
    }

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    drawSky();
    backgroundLayers.forEach(layer => layer.draw());
    particles.forEach(part => part.draw());
    drawGround();

    obstacles.forEach(obs => obs.draw());
    powerups.forEach(pu => pu.draw());
    
    if (gameState === 'PLAYING' || gameState === 'GAMEOVER') {
        player.draw();
    }

    requestAnimationFrame(gameLoop);
}

// ==========================================
// 10. EVENTS & BINDINGS SETUP
// ==========================================
function setupEventListeners() {
    window.addEventListener('keydown', (e) => {
        if (gameState === 'PLAYING') {
            if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
                e.preventDefault();
                player.jump();
            }
            if (e.code === 'ArrowDown' || e.code === 'KeyS') {
                e.preventDefault();
                player.duck(true);
            }
        }
        
        if (gameState === 'MENU' && e.code === 'Space') startGame();
        if (gameState === 'GAMEOVER' && e.code === 'Space') startGame();
    });

    window.addEventListener('keyup', (e) => {
        if (gameState === 'PLAYING') {
            if (e.code === 'ArrowDown' || e.code === 'KeyS') {
                player.duck(false);
            }
        }
    });

    // Touch support (Mobile auto-detect)
    const touchZones = document.getElementById('mobile-touch-zones');
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
        touchZones.classList.remove('hidden');
    }

    document.getElementById('touch-jump').addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (gameState === 'PLAYING') player.jump();
    });

    const duckZone = document.getElementById('touch-duck');
    duckZone.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (gameState === 'PLAYING') player.duck(true);
    });

    duckZone.addEventListener('touchend', (e) => {
        e.preventDefault();
        if (gameState === 'PLAYING') player.duck(false);
    });

    // Button actions
    document.getElementById('start-btn').addEventListener('click', () => startGame());
    document.getElementById('restart-btn').addEventListener('click', () => startGame());
    document.getElementById('menu-btn').addEventListener('click', () => {
        gameState = 'MENU';
        document.getElementById('gameover-screen').classList.add('hidden');
        document.getElementById('menu-screen').classList.remove('hidden');
        document.getElementById('hud').classList.add('hidden');
    });

    document.getElementById('audio-toggle-btn').addEventListener('click', () => soundSystem.toggleMute());

    // Character cards
    const cards = document.querySelectorAll('.character-card');
    cards.forEach(card => {
        card.addEventListener('click', () => {
            cards.forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            currentCharacter = card.getAttribute('data-char');
        });
    });
}

// ==========================================
// 11. INITIALIZATION ON PAGE LOAD
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
    canvas = document.getElementById('game-canvas');
    ctx = canvas.getContext('2d');

    const savedHighScore = localStorage.getItem('nyc_dino_highscore');
    if (savedHighScore) {
        highScore = parseInt(savedHighScore);
        document.getElementById('high-score').innerText = padScore(highScore);
    }

    setupEventListeners();
    createBackgrounds();
    gameLoop();
});
