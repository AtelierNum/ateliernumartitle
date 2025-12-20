import { FontLoader } from 'three/addons/loaders/FontLoader.js';

const FONTS = {
    'Droid Sans': 'https://unpkg.com/three@0.125.0/examples/fonts/droid/droid_sans_regular.typeface.json',
    'Droid Serif': 'https://unpkg.com/three@0.125.0/examples/fonts/droid/droid_serif_regular.typeface.json',
    'Helvetiker': 'https://unpkg.com/three@0.125.0/examples/fonts/helvetiker_regular.typeface.json',
    'Optimer': 'https://unpkg.com/three@0.125.0/examples/fonts/optimer_regular.typeface.json',
    'Gentilis': 'https://unpkg.com/three@0.125.0/examples/fonts/gentilis_regular.typeface.json',
    'Creepster': 'https://components.ai/api/v1/typefaces/creepster/normal/400',
    'Gugi': 'https://components.ai/api/v1/typefaces/gugi/normal/400',
    'Bungee Airline' : 'https://components.ai/api/v1/typefaces/bungee-hairline/normal/400',
    'Gwendolyn' : 'https://components.ai/api/v1/typefaces/gwendolyn/normal/400'
  };

// Global reference for the loader
const loader = new FontLoader();

// Initial UI Setup (Outside the component to ensure it runs immediately)
function populateFontDropdown() {
    const fontSelect = document.getElementById('font-select');
    if (!fontSelect) return;

    fontSelect.innerHTML = ''; // Clear "Loading..."
    for (const fontName in FONTS) {
        const option = document.createElement('option');
        option.value = fontName;
        option.textContent = fontName;
        fontSelect.appendChild(option);
    }
}

// Ensure the dropdown is populated as soon as the DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', populateFontDropdown);
} else {
    populateFontDropdown();
}

AFRAME.registerComponent('particle-text', {
    schema: {
        text: { type: 'string', default: 'ATELIERNUM' },
        density: { type: 'number', default: 600 },
        particleSize: { type: 'number', default: 0.04 },
        duration: { type: 'number', default: 2000 },
        scatterRadius: { type: 'number', default: 3 },
        textSize: { type: 'number', default: 1 },
        font: { type: 'string', default: 'Droid Sans' },
        color: { type: 'color', default: '#00f2ff' }
    },

    init: function () {
        console.log('Particle Text Component Init');
        this.particles = [];
        this.isAssembled = true;
        this.animating = false;
        this.destinations = [];
        this.origins = [];
        this.font = null;

        const THREE = AFRAME.THREE;
        this.material = new THREE.MeshStandardMaterial({
            color: this.data.color,
            metalness: 0.8,
            roughness: 0.2,
            emissive: this.data.color,
            emissiveIntensity: 0.5
        });

        this.setupEventListeners();
        this.loadFont();
    },

    setupEventListeners: function() {
        const button = document.getElementById('explode-button');
        if (button) {
            button.onclick = () => this.toggleAnimation();
        }

        const fontSelect = document.getElementById('font-select');
        if (fontSelect) {
            fontSelect.onchange = (e) => {
                this.el.setAttribute('particle-text', 'font', e.target.value);
            };
        }
    },

    update: function (oldData) {
        if (Object.keys(oldData).length === 0) return;

        if (this.data.font !== oldData.font) {
            this.loadFont();
            return;
        }

        if (this.font && (
            this.data.text !== oldData.text ||
            this.data.textSize !== oldData.textSize ||
            this.data.density !== oldData.density ||
            this.data.particleSize !== oldData.particleSize
        )) {
            this.generateParticlesFromFont(this.font);
        }

        if (this.data.color !== oldData.color) {
            this.material.color.set(this.data.color);
            this.material.emissive.set(this.data.color);
        }
    },

    loadFont: function() {
        const fontUrl = FONTS[this.data.font];
        console.log(`Loading font: ${this.data.font}`);
        
        loader.load(fontUrl, (font) => {
            console.log('Font loaded successfully');
            this.font = font;
            this.generateParticlesFromFont(font);
        }, undefined, (err) => {
            console.error('Failed to load font:', err);
        });
    },

    generateParticlesFromFont: function (font) {
        const THREE = AFRAME.THREE;
        
        // Cleanup
        this.particles.forEach(p => {
            if (p.parentNode) p.parentNode.removeChild(p);
        });
        this.particles = [];
        this.destinations = [];
        this.origins = [];

        const shapes = font.generateShapes(this.data.text, this.data.textSize);
        const allPaths = [];
        let totalLength = 0;

        shapes.forEach(shape => {
            allPaths.push(shape);
            totalLength += shape.getLength();
            shape.holes.forEach(hole => {
                allPaths.push(hole);
                totalLength += hole.getLength();
            });
        });

        if (totalLength === 0) return;

        const allPoints = [];
        const boundingBox = new THREE.Box2();
        const targetStep = totalLength / this.data.density;

        allPaths.forEach(path => {
            const pathLen = path.getLength();
            if (pathLen === 0) return;
            const numPoints = Math.max(1, Math.round(pathLen / targetStep));
            const points = path.getSpacedPoints(numPoints);
            allPoints.push(...points);
        });

        allPoints.forEach(p => boundingBox.expandByPoint(p));
        const center = new THREE.Vector2();
        boundingBox.getCenter(center);
        
        const sphereGeom = new THREE.SphereGeometry(this.data.particleSize, 6, 6);

        allPoints.forEach(p => {
            const targetX = p.x - center.x;
            const targetY = p.y - center.y;
            const targetZ = 0;

            const radius = Math.random() * this.data.scatterRadius;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos((Math.random() * 2) - 1);
            
            const startX = radius * Math.sin(phi) * Math.cos(theta);
            const startY = radius * Math.sin(phi) * Math.sin(theta);
            const startZ = radius * Math.cos(phi);
            
            this.destinations.push({x: targetX, y: targetY, z: targetZ});
            this.origins.push({x: startX, y: startY, z: startZ});

            const particle = document.createElement('a-entity');
            
            particle.addEventListener('loaded', () => {
                particle.object3D.position.set(targetX, targetY, targetZ);
            });

            const mesh = new THREE.Mesh(sphereGeom, this.material);
            particle.setObject3D('mesh', mesh);
            
            this.el.appendChild(particle);
            this.particles.push(particle);
        });
    },

    toggleAnimation: function() {
        this.isAssembled = !this.isAssembled;
        this.startTime = Date.now();
        this.animating = true;

        const button = document.getElementById('explode-button');
        if (button) {
            button.textContent = this.isAssembled ? 'Explode' : 'Re-assemble';
        }
    },

    tick: function () {
        if (!this.animating) return;

        const now = Date.now();
        const progress = Math.min((now - this.startTime) / this.data.duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3);

        for (let i = 0; i < this.particles.length; i++) {
            const particle = this.particles[i];
            const dest = this.destinations[i];
            const orig = this.origins[i];
            
            if (!particle.object3D) continue;

            let cx, cy, cz;
            if (this.isAssembled) {
                cx = orig.x + (dest.x - orig.x) * ease;
                cy = orig.y + (dest.y - orig.y) * ease;
                cz = orig.z + (dest.z - orig.z) * ease;
            } else {
                cx = dest.x + (orig.x - dest.x) * ease;
                cy = dest.y + (orig.y - dest.y) * ease;
                cz = dest.z + (orig.z - dest.z) * ease;
            }

            particle.object3D.position.set(cx, cy, cz);
        }

        if (progress >= 1) {
            this.animating = false;
        }
    }
});
