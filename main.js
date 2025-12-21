
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { GUI } from 'lil-gui';

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
const loader = new FontLoader();

function populateFontDropdown() {
    const fontSelect = document.getElementById('font-select');
    if (!fontSelect) return;
    fontSelect.innerHTML = '';
    for (const fontName in FONTS) {
        const option = document.createElement('option');
        option.value = fontName;
        option.textContent = fontName;
        fontSelect.appendChild(option);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', populateFontDropdown);
} else {
    populateFontDropdown();
}

const refractionShader = {
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      void main() {
        vec3 objectNormal = vec3(normal);
        vec3 transformedNormal = normalMatrix * objectNormal;
        vNormal = normalize(transformedNormal);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPosition = -mvPosition.xyz;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform sampler2D envMap;
      uniform vec2 resolution;
      uniform float time;
      uniform float ior;
      uniform float chromaticAberration;
      uniform float opacity;
      uniform float fresnelBias;
      uniform float fresnelScale;
      uniform float fresnelPower;
      uniform float iridescenceIntensity;
      uniform float iridescenceSpeed;
      uniform vec3 glowColor;
      uniform float glowInternal;
      uniform float glowSharpness;
      uniform float emissiveIntensity;
      uniform vec3 rimColor;
      uniform float rimPower;
      uniform float rimStrength;
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      vec3 safeNormalize(vec3 v) {
        float len = length(v);
        if (len < 0.00001) return vec3(0.0, 0.0, 1.0);
        return v / len;
      }
      void main() {
        vec3 viewDir = safeNormalize(vViewPosition);
        vec3 normal = safeNormalize(vNormal);
        if (!gl_FrontFacing) normal = -normal;
        vec2 safeRes = max(resolution, vec2(1.0, 1.0));
        vec2 uv = gl_FragCoord.xy / safeRes;
        float NdotV = max(dot(normal, viewDir), 0.0);
        float fresnelFactor = clamp(1.0 - NdotV, 0.0001, 1.0);
        float fresnel = fresnelBias + fresnelScale * pow(max(fresnelFactor, 0.001), fresnelPower);
        fresnel = clamp(fresnel, 0.0, 1.0);
        vec2 distort = clamp(normal.xy * ior, -0.5, 0.5);
        float r = texture2D(envMap, clamp(uv - distort * (1.0 + chromaticAberration), 0.0, 1.0)).r;
        float g = texture2D(envMap, clamp(uv - distort, 0.0, 1.0)).g;
        float b = texture2D(envMap, clamp(uv - distort * (1.0 - chromaticAberration), 0.0, 1.0)).b;
        vec3 refractColor = vec3(r, g, b);
        float phase = fresnelFactor * 3.0 + time * iridescenceSpeed;
        vec3 irisColor = vec3(sin(phase * 6.28) * 0.5 + 0.5, 0.0, sin(phase * 6.28 + 2.0) * 0.5 + 0.5);
        irisColor = pow(clamp(irisColor, 0.0001, 1.0), vec3(0.6));
        vec3 finalColor = mix(refractColor, irisColor, fresnel * iridescenceIntensity);
        vec3 lightDir = normalize(vec3(0.5, 1.0, 1.0));
        vec3 halfVec = safeNormalize(lightDir + viewDir);
        float specular = pow(max(dot(normal, halfVec), 0.0001), 90.0);
        float NdotL = max(dot(normal, lightDir), 0.0);
        vec3 diffuse = vec3(NdotL) * 0.15;
        finalColor += vec3(specular) + diffuse;
        float glowFactor = pow(max(fresnelFactor, 0.001), glowSharpness);
        vec3 glow = glowColor * glowFactor * glowInternal;
        float rimFactor = pow(max(fresnelFactor, 0.001), rimPower);
        vec3 rim = rimColor * rimFactor * rimStrength;
        vec3 baseEmission = glowColor * emissiveIntensity;
        finalColor += glow + rim + baseEmission;
        gl_FragColor = vec4(finalColor, opacity);
      }
    `
};

AFRAME.registerComponent('particle-text', {
    schema: {
        text: { type: 'string', default: 'ATELIERNUM' },
        density: { type: 'number', default: 500 },
        particleSize: { type: 'number', default: 0.04 },
        duration: { type: 'number', default: 2000 },
        scatterRadius: { type: 'number', default: 3 },
        textSize: { type: 'number', default: 1 },
        font: { type: 'string', default: 'Droid Sans' }
    },

    init: function () {
        this.particles = [];
        this.isAssembled = true;
        this.animating = false;
        this.destinations = [];
        this.origins = [];
        this.font = null;
        
        // --- Texture Caching Setup ---
        this.videoEl = null;
        this.canvasEl = document.createElement('canvas');
        this.canvasCtx = this.canvasEl.getContext('2d');
        this.canvasTexture = new AFRAME.THREE.CanvasTexture(this.canvasEl);

        const THREE = AFRAME.THREE;
        
        this.material = new THREE.ShaderMaterial({
            uniforms: {
              envMap: { value: this.canvasTexture }, // Use cached canvas texture
              resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
              time: { value: 0.0 },
              ior: { value: 0.11357 },
              chromaticAberration: { value: 0.3770 },
              opacity: { value: 1 },
              fresnelBias: { value: 0.2197 },
              fresnelScale: { value: 5.0402 },
              fresnelPower: { value: 3.8825 },
              iridescenceIntensity: { value: 0.4547 },
              iridescenceSpeed: { value: 1.2799 },
              glowColor: { value: new THREE.Color('#ffffff') },
              glowInternal: { value: 0.0992 },
              glowSharpness: { value: 1.9875 },
              emissiveIntensity: { value: 0.1672 },
              rimColor: { value: new THREE.Color('#ffffff') },
              rimPower: { value: 2.5 },
              rimStrength: { value: 0.8 },
            },
            vertexShader: refractionShader.vertexShader,
            fragmentShader: refractionShader.fragmentShader,
            transparent: false,
            //side: THREE.DoubleSide, // Critical for shader correctness
            depthWrite: false,     // Critical for transparency
            depthTest: true
        });

        this.setupEventListeners();
        this.loadFont();
        this.initGui();
    },

    initGui: function() {
        const gui = new GUI();
        const uniforms = this.material.uniforms;

        gui.add(uniforms.chromaticAberration, 'value', 0, 1).name('Chromatic Aberration');
        gui.add(uniforms.opacity, 'value', 0, 1).name('Opacity');
        gui.add(uniforms.fresnelBias, 'value', 0, 1).name('Fresnel Bias');
        gui.add(uniforms.fresnelScale, 'value', 0, 10).name('Fresnel Scale');
        gui.add(uniforms.fresnelPower, 'value', 0, 10).name('Fresnel Power');
        gui.add(uniforms.iridescenceIntensity, 'value', 0, 1).name('Iridescence Intensity');
        gui.add(uniforms.iridescenceSpeed, 'value', 0, 5).name('Iridescence Speed');
        gui.addColor(uniforms.glowColor, 'value').name('Glow Color');
        gui.add(uniforms.glowInternal, 'value', 0, 1).name('Glow Internal');
        gui.add(uniforms.glowSharpness, 'value', 0, 5).name('Glow Sharpness');
        gui.add(uniforms.emissiveIntensity, 'value', 0, 1).name('Emissive Intensity');
        gui.addColor(uniforms.rimColor, 'value').name('Rim Color');
        gui.add(uniforms.rimPower, 'value', 0, 10).name('Rim Power');
        gui.add(uniforms.rimStrength, 'value', 0, 2).name('Rim Strength');
        gui.hide()
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
    },

    loadFont: function() {
        const fontUrl = FONTS[this.data.font];
        loader.load(fontUrl, (font) => {
            this.font = font;
            this.generateParticlesFromFont(font);
        });
    },

    generateParticlesFromFont: function (font) {
        const THREE = AFRAME.THREE;
        this.particles.forEach(p => {
            if (p.geometry) p.geometry.dispose();
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

        allPoints.forEach(p => {
            const noiseFactor = 0.008;
            const targetX = p.x - center.x + (Math.random() - 0.5) * noiseFactor;
            const targetY = p.y - center.y + (Math.random() - 0.5) * noiseFactor;
            const targetZ = 0 + (Math.random() - 0.5) * noiseFactor*15;

            const radius = Math.random() * this.data.scatterRadius;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos((Math.random() * 2) - 1);
            
            const startX = radius * Math.sin(phi) * Math.cos(theta);
            const startY = radius * Math.sin(phi) * Math.sin(theta);
            const startZ = radius * Math.cos(phi);
            
            this.destinations.push({x: targetX, y: targetY, z: targetZ});
            this.origins.push({x: startX, y: startY, z: startZ});

            // Apply size variation
            const sizeVariation = 0.1 + Math.random() * 1.4;
            const finalParticleSize = this.data.particleSize * sizeVariation;
            const sphereGeom = new THREE.IcosahedronGeometry(finalParticleSize, 0);

            const particle = document.createElement('a-entity');
            const mesh = new THREE.Mesh(sphereGeom, this.material);

            // Store random rotation speed AND a random initial rotation offset
            mesh.userData.rotationSpeed = {
                x: (Math.random() +0.15) * (Math.random()> 0.5 ? .8 : -.8),
                y: (Math.random() +0.15) * (Math.random()> 0.5 ? .8 : -.8),
                z: (Math.random() +0.15) * (Math.random()> 0.5 ? .8 : -.8),
            };
            mesh.userData.rotationOffset = {
                x: Math.random() * Math.PI ,
                y: Math.random() * Math.PI ,
                z: Math.random() * Math.PI ,
            };

            particle.setObject3D('mesh', mesh);

            particle.addEventListener('loaded', () => {
                if (this.isAssembled) {
                    particle.object3D.position.set(targetX, targetY, targetZ);
                } else {
                    particle.object3D.position.set(startX, startY, startZ);
                }
            });

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

    tick: function (time, timeDelta) {
        // --- Robust Video Texture Handling ---
        if (!this.videoEl) {
            this.videoEl = document.getElementById('arjs-video');
        }

        if (this.videoEl && this.videoEl.readyState >= 2 && this.videoEl.videoWidth > 0) {
            if (this.canvasEl.width !== this.videoEl.videoWidth || this.canvasEl.height !== this.videoEl.videoHeight) {
                this.canvasEl.width = this.videoEl.videoWidth;
                this.canvasEl.height = this.videoEl.videoHeight;
            }
            this.canvasCtx.drawImage(this.videoEl, 0, 0, this.canvasEl.width, this.canvasEl.height);
            this.canvasTexture.needsUpdate = true;
        }

        // Update other shader uniforms
        if (window.innerWidth > 0 && window.innerHeight > 0) {
            this.material.uniforms.resolution.value.set(window.innerWidth, window.innerHeight);
        }
        this.material.uniforms.time.value = time * 0.001; 

        // Animate particle positions
        if (this.animating) {
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
        
        // Apply continuous rotation to all particles using setAttribute
        const timeInSeconds = time / 500;
        const radToDeg = 180 / Math.PI;

        for (let i = 0; i < this.particles.length; i++) {
            const particle = this.particles[i];
            const mesh = particle.getObject3D('mesh');

            if (mesh && mesh.userData.rotationSpeed) {
                const speed = mesh.userData.rotationSpeed;
                const offset = mesh.userData.rotationOffset;

                const rotX = (offset.x + (timeInSeconds * speed.x)) * radToDeg;
                const rotY = (offset.y + (timeInSeconds * speed.y)) * radToDeg;
                const rotZ = (offset.z + (timeInSeconds * speed.z)) * radToDeg;

                particle.setAttribute('rotation', { x: rotX, y: rotY, z: rotZ });
            }
        }
    }
});
