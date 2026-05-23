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
       
