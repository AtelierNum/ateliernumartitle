# AR Particle Text Effect - Blueprint

## Overview
An augmented reality (AR) application that displays text as a collection of interactive particles when a specific marker is detected. Users can explode and re-assemble the text, and choose from various fonts.

## Features
- **AR Marker Detection:** Uses AR.js to detect barcode markers (Value 0).
- **Particle Text:** Generates text using particles based on selected fonts.
- **Interactivity:** "Explode" button to scatter particles and "Re-assemble" to bring them back.
- **Font Selection:** Dropdown menu to switch between different typefaces.
- **Modern Web Standards:** Built using A-Frame, Three.js, and ES Modules.

## Technical Implementation
- **A-Frame:** Framework for the 3D/AR scene.
- **AR.js:** For marker tracking via the webcam.
- **Three.js FontLoader:** Loads typeface JSON files to generate text geometry.
- **Custom A-Frame Component (`particle-text`):** Manages particle lifecycle, animation, and font loading.

## Recent Changes & Fixes
- **Simplified Materials:** Moved from `MeshPhysicalMaterial` to `MeshStandardMaterial` for better compatibility and performance.
- **Library Alignment:** Synchronized `FontLoader` version (0.150.0) with A-Frame 1.4.2's internal Three.js version.
- **Improved Reliability:** Updated font URLs and added detailed logging for debugging.

## Current Steps
1.  **Update `index.html`:** Ensure correct library versions and script loading order.
2.  **Update `main.js`:** Simplify material, fix font URLs, and add debug logs.
3.  **Verify UI:** Ensure the font dropdown is correctly populated.
