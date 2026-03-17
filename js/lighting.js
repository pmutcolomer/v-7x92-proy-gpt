import * as THREE from 'three';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';

export function setupLighting(scene) {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(5, 10, 5);
    dirLight.castShadow = true;
    dirLight.name = 'sunLight';
    dirLight.shadow.camera.left = -5;
    dirLight.shadow.camera.right = 5;
    dirLight.shadow.camera.top = 5;
    dirLight.shadow.camera.bottom = -5;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 50;
    dirLight.shadow.mapSize.set(2048, 2048);
    scene.add(dirLight);

    const lightTarget = new THREE.Object3D();
    scene.add(lightTarget);
    dirLight.target = lightTarget;

    const shadowMaterial = new THREE.ShadowMaterial({
        opacity: 0.4,
        color: 0x000000
    });

    const shadowPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(200, 200),
        shadowMaterial
    );
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.receiveShadow = true;
    scene.add(shadowPlane);

    let environmentMap = null;
    let backgroundEnabled = true;
    let environmentEnabled = true;

    const applyEnvironmentState = () => {
        scene.background = backgroundEnabled ? environmentMap : null;
        scene.environment = environmentEnabled ? environmentMap : null;
    };

    const exrLoader = new EXRLoader();
    exrLoader.load(
        'textures/skybox.exr',
        (texture) => {
            texture.mapping = THREE.EquirectangularReflectionMapping;
            environmentMap = texture;
            applyEnvironmentState();
        },
        undefined,
        (error) => {
            console.warn('No se pudo cargar textures/skybox.exr. Se continúa sin HDRI.', error);
        }
    );

    function setShadowMapSize(size) {
        dirLight.shadow.mapSize.set(size, size);
        if (dirLight.shadow.map) {
            dirLight.shadow.map.dispose();
            dirLight.shadow.map = null;
        }
    }

    function updateLight(angle, intensity) {
        dirLight.position.x = Math.cos(angle) * 7;
        dirLight.position.z = Math.sin(angle) * 7;
        dirLight.intensity = intensity;
        dirLight.target.updateMatrixWorld();
    }

    return {
        dirLight,
        ambientLight,
        shadowMaterial,
        shadowPlane,
        lightTarget,
        getEnvironmentMap: () => environmentMap,
        isBackgroundEnabled: () => backgroundEnabled,
        isEnvironmentEnabled: () => environmentEnabled,
        setBackgroundEnabled: (enabled) => {
            backgroundEnabled = !!enabled;
            applyEnvironmentState();
        },
        setEnvironmentEnabled: (enabled) => {
            environmentEnabled = !!enabled;
            applyEnvironmentState();
        },
        setShadowMapSize,
        updateLight
    };
}
