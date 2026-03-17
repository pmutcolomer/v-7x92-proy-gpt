import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { applyCustomMaterials } from './materials.js';

const loader = new GLTFLoader();
let currentModel = null;
let currentLoadToken = 0;

const textureKeys = [
    'map',
    'aoMap',
    'alphaMap',
    'bumpMap',
    'normalMap',
    'displacementMap',
    'emissiveMap',
    'metalnessMap',
    'roughnessMap',
    'specularMap',
    'envMap',
    'clearcoatMap',
    'clearcoatNormalMap',
    'clearcoatRoughnessMap',
    'sheenColorMap',
    'sheenRoughnessMap',
    'transmissionMap',
    'thicknessMap'
];

function disposeMaterial(material, disposedTextures) {
    if (!material) return;

    textureKeys.forEach((key) => {
        const texture = material[key];
        if (!texture || typeof texture.dispose !== 'function' || disposedTextures.has(texture)) {
            return;
        }

        disposedTextures.add(texture);
        texture.dispose();
    });

    if (typeof material.dispose === 'function') {
        material.dispose();
    }
}

function disposeModel(model) {
    if (!model) return;

    const disposedTextures = new Set();
    const disposedMaterials = new Set();
    const disposedGeometries = new Set();

    model.traverse((child) => {
        if (!child.isMesh) return;

        if (child.geometry && !disposedGeometries.has(child.geometry)) {
            disposedGeometries.add(child.geometry);
            child.geometry.dispose();
        }

        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((material) => {
            if (!material || disposedMaterials.has(material)) return;
            disposedMaterials.add(material);
            disposeMaterial(material, disposedTextures);
        });
    });
}

export function loadModel(container, path, controls, options = {}) {
    const { onLoaded = null, onError = null } = options;
    const loadToken = ++currentLoadToken;

    if (currentModel) {
        container.remove(currentModel);
        disposeModel(currentModel);
        currentModel = null;
    }

    container.rotation.set(0, 0, 0);

    loader.load(
        path,
        (gltf) => {
            if (loadToken !== currentLoadToken) {
                disposeModel(gltf.scene);
                return;
            }

            currentModel = gltf.scene;
            applyCustomMaterials(currentModel);

            const box = new THREE.Box3().setFromObject(currentModel);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());

            currentModel.position.x = -center.x;
            currentModel.position.z = -center.z;
            currentModel.position.y = -box.min.y;

            container.add(currentModel);

            if (controls) {
                controls.target.set(0, size.y * 0.5, 0);
                controls.update();
            }

            if (typeof onLoaded === 'function') {
                onLoaded(currentModel, { box, size, center });
            }
        },
        undefined,
        (error) => {
            if (loadToken !== currentLoadToken) return;

            console.error('Error cargando el modelo:', error);
            if (typeof onError === 'function') {
                onError(error);
            }
        }
    );
}
