import * as THREE from 'three';
import { clamp, forEachMeshMaterial } from './utils.js';

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
    'clearcoatMap',
    'clearcoatNormalMap',
    'clearcoatRoughnessMap',
    'sheenColorMap',
    'sheenRoughnessMap',
    'transmissionMap',
    'thicknessMap'
];

const qualityProfiles = {
    low: {
        precision: 'mediump',
        anisotropy: 4,
        minFilter: THREE.LinearFilter
    },
    medium: {
        precision: 'highp',
        anisotropy: 8,
        minFilter: THREE.LinearMipmapLinearFilter
    },
    max: {
        precision: 'highp',
        anisotropy: 16,
        minFilter: THREE.LinearMipmapLinearFilter
    }
};

let currentQuality = 'max';

export function setMaterialQuality(level) {
    if (qualityProfiles[level]) {
        currentQuality = level;
    }
}

export function getMaterialQuality() {
    return currentQuality;
}

export function getDefaultAnisotropyForQuality(level = currentQuality) {
    return qualityProfiles[level]?.anisotropy ?? qualityProfiles.max.anisotropy;
}

export function applyMaterialRuntimeSettings(group, options = {}) {
    const quality = qualityProfiles[options.quality || currentQuality] ? (options.quality || currentQuality) : currentQuality;
    const profile = qualityProfiles[quality];
    const anisotropy = clamp(
        options.anisotropy ?? profile.anisotropy,
        1,
        qualityProfiles.max.anisotropy
    );
    const envMapIntensity = options.envMapIntensity;

    forEachMeshMaterial(group, (material, mesh) => {
        if (material.type === 'ShadowMaterial') return;

        mesh.castShadow = true;
        mesh.receiveShadow = true;

        material.precision = profile.precision;

        if (typeof envMapIntensity === 'number' && 'envMapIntensity' in material) {
            material.envMapIntensity = envMapIntensity;
        }

        textureKeys.forEach((key) => {
            const texture = material[key];
            if (!texture) return;

            if (typeof texture.anisotropy === 'number') {
                texture.anisotropy = anisotropy;
            }

            if (key === 'map') {
                texture.minFilter = profile.minFilter;
            }

            texture.needsUpdate = true;
        });

        material.needsUpdate = true;
    });
}

export const applyCustomMaterials = applyMaterialRuntimeSettings;
