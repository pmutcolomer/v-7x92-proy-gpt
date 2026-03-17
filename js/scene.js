import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { setupLighting } from './lighting.js';

function getViewportSize() {
    const viewport = window.visualViewport;
    return {
        width: Math.max(1, Math.round(viewport?.width || window.innerWidth || 1)),
        height: Math.max(1, Math.round(viewport?.height || window.innerHeight || 1))
    };
}

export function setupScene() {
    const scene = new THREE.Scene();
    const worldGroup = new THREE.Group();
    scene.add(worldGroup);

    const camera = new THREE.PerspectiveCamera(
        75,
        (() => { const { width, height } = getViewportSize(); return width / height; })(),
        0.1,
        1000
    );
    camera.position.set(0, 1.6, 3);

    const renderer = new THREE.WebGLRenderer({
        antialias: false,
        alpha: true,
        powerPreference: 'high-performance'
    });

    const { width, height } = getViewportSize();
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.touchAction = 'none';

    document.body.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 1, 0);
    controls.update();

    const lighting = setupLighting(scene);

    return {
        scene,
        camera,
        renderer,
        controls,
        worldGroup,
        ...lighting
    };
}
