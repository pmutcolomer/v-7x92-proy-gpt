import {
    applyMaterialRuntimeSettings,
    getDefaultAnisotropyForQuality,
    getMaterialQuality,
    setMaterialQuality
} from './materials.js';
import {
    forEachMeshMaterial,
    getFirstMaterialValue,
    getFirstTextureAnisotropy,
    clamp
} from './utils.js';

export function createQualityManager({
    scene,
    camera,
    renderer,
    controls,
    worldGroup,
    lighting,
    post
}) {
    let renderScale = 1;

    function getEffectivePixelRatio(scale = renderScale) {
        const devicePixelRatio = window.devicePixelRatio || 1;
        const cappedBaseDpr = Math.min(devicePixelRatio, 2);
        return clamp(cappedBaseDpr * scale, 0.5, 3);
    }

    function updateRenderTargets() {
        const pixelRatio = getEffectivePixelRatio();
        const width = window.innerWidth;
        const height = window.innerHeight;

        renderer.setPixelRatio(pixelRatio);
        renderer.setSize(width, height);
        post.resize(width, height, pixelRatio);
    }

    function setRenderScale(scale) {
        renderScale = clamp(scale, 0.25, 2);
        updateRenderTargets();
    }

    function setShadowResolution(size) {
        lighting.setShadowMapSize(size);
        renderer.shadowMap.needsUpdate = true;
        lighting.shadowMaterial.needsUpdate = true;
    }

    function applyEnvironmentIntensity(value) {
        applyMaterialRuntimeSettings(worldGroup, {
            quality: getMaterialQuality(),
            anisotropy: getMaterialsState().anisotropy,
            envMapIntensity: value
        });
    }

    function applyMaterialSettings({ quality, anisotropy, envMapIntensity } = {}) {
        if (quality) {
            setMaterialQuality(quality);
        }

        applyMaterialRuntimeSettings(worldGroup, {
            quality: getMaterialQuality(),
            anisotropy,
            envMapIntensity
        });
    }

    function getMaterialsState() {
        return {
            quality: getMaterialQuality(),
            anisotropy: getFirstTextureAnisotropy(
                worldGroup,
                getDefaultAnisotropyForQuality(getMaterialQuality())
            )
        };
    }

    function getEnvironmentState() {
        return {
            backgroundEnabled: lighting.isBackgroundEnabled(),
            environmentEnabled: lighting.isEnvironmentEnabled(),
            intensity: getFirstMaterialValue(worldGroup, 'envMapIntensity', 1)
        };
    }

    function getPostState() {
        let smaaThreshold = 0.1;
        if (typeof post.smaaPass.getEdgeDetectionMaterial === 'function') {
            const edgeMaterial = post.smaaPass.getEdgeDetectionMaterial();
            if (edgeMaterial?.uniforms?.threshold) {
                smaaThreshold = edgeMaterial.uniforms.threshold.value;
            }
        }

        return {
            ssaoEnabled: post.ssaoPass.enabled,
            ssaoRadius: post.ssaoPass.kernelRadius,
            ssaoMinDistance: post.ssaoPass.minDistance,
            ssaoMaxDistance: post.ssaoPass.maxDistance,
            bloomEnabled: post.bloomPass.enabled,
            bloomStrength: post.bloomPass.strength,
            bloomRadius: post.bloomPass.radius,
            bloomThreshold: post.bloomPass.threshold,
            smaaEnabled: post.smaaPass.enabled,
            smaaThreshold,
            vignetteEnabled: post.vignettePass.enabled,
            vignetteOffset: post.vignettePass.uniforms.offset.value,
            vignetteDarkness: post.vignettePass.uniforms.darkness.value
        };
    }

    function getState() {
        const environment = getEnvironmentState();
        const materials = getMaterialsState();

        return {
            renderScale,
            materialQuality: materials.quality,
            rendering: {
                exposure: renderer.toneMappingExposure,
                toneMapping: renderer.toneMapping
            },
            camera: {
                fov: camera.fov,
                near: camera.near,
                far: camera.far
            },
            lighting: {
                ambientIntensity: lighting.ambientLight.intensity,
                ambientColor: `#${lighting.ambientLight.color.getHexString()}`,
                dirIntensity: lighting.dirLight.intensity,
                dirColor: `#${lighting.dirLight.color.getHexString()}`,
                dirPosition: {
                    x: lighting.dirLight.position.x,
                    y: lighting.dirLight.position.y,
                    z: lighting.dirLight.position.z
                }
            },
            environment,
            shadows: {
                algorithm: renderer.shadowMap.type,
                mapSize: lighting.dirLight.shadow.mapSize.x,
                radius: lighting.dirLight.shadow.radius,
                bias: lighting.dirLight.shadow.bias,
                normalBias: lighting.dirLight.shadow.normalBias,
                boxSize: Math.abs(lighting.dirLight.shadow.camera.right),
                near: lighting.dirLight.shadow.camera.near,
                far: lighting.dirLight.shadow.camera.far
            },
            shadowCatcher: {
                opacity: lighting.shadowMaterial.opacity,
                color: `#${lighting.shadowMaterial.color.getHexString()}`,
                visible: lighting.shadowPlane.visible,
                y: lighting.shadowPlane.position.y,
                scale: lighting.shadowPlane.scale.x
            },
            materials: {
                anisotropy: materials.anisotropy
            },
            post: getPostState()
        };
    }

    function applyState(state = {}, options = {}) {
        const { syncControls = true } = options;

        if (typeof state.renderScale === 'number') {
            setRenderScale(state.renderScale);
        }

        if (state.rendering) {
            if (typeof state.rendering.exposure === 'number') {
                renderer.toneMappingExposure = state.rendering.exposure;
            }
            if (typeof state.rendering.toneMapping === 'number') {
                renderer.toneMapping = state.rendering.toneMapping;
            }
        }

        if (state.camera) {
            if (typeof state.camera.fov === 'number') camera.fov = state.camera.fov;
            if (typeof state.camera.near === 'number') camera.near = state.camera.near;
            if (typeof state.camera.far === 'number') camera.far = state.camera.far;
            camera.updateProjectionMatrix();
        }

        if (state.lighting) {
            if (typeof state.lighting.ambientIntensity === 'number') {
                lighting.ambientLight.intensity = state.lighting.ambientIntensity;
            }
            if (state.lighting.ambientColor) {
                lighting.ambientLight.color.set(state.lighting.ambientColor);
            }
            if (typeof state.lighting.dirIntensity === 'number') {
                lighting.dirLight.intensity = state.lighting.dirIntensity;
            }
            if (state.lighting.dirColor) {
                lighting.dirLight.color.set(state.lighting.dirColor);
            }
            if (state.lighting.dirPosition) {
                lighting.dirLight.position.set(
                    state.lighting.dirPosition.x,
                    state.lighting.dirPosition.y,
                    state.lighting.dirPosition.z
                );
                lighting.dirLight.target.updateMatrixWorld();
            }
        }

        if (state.environment) {
            if (typeof state.environment.backgroundEnabled === 'boolean') {
                lighting.setBackgroundEnabled(state.environment.backgroundEnabled);
            }
            if (typeof state.environment.environmentEnabled === 'boolean') {
                lighting.setEnvironmentEnabled(state.environment.environmentEnabled);
            }
        }

        const anisotropy = state.materials?.anisotropy;
        const envMapIntensity = state.environment?.intensity;
        const quality = state.materialQuality;

        if (quality || anisotropy !== undefined || envMapIntensity !== undefined) {
            applyMaterialSettings({ quality, anisotropy, envMapIntensity });
        }

        if (state.shadows) {
            if (typeof state.shadows.algorithm === 'number') {
                renderer.shadowMap.type = state.shadows.algorithm;
                renderer.shadowMap.needsUpdate = true;
            }
            if (typeof state.shadows.mapSize === 'number') {
                setShadowResolution(state.shadows.mapSize);
            }
            if (typeof state.shadows.radius === 'number') {
                lighting.dirLight.shadow.radius = state.shadows.radius;
            }
            if (typeof state.shadows.bias === 'number') {
                lighting.dirLight.shadow.bias = state.shadows.bias;
            }
            if (typeof state.shadows.normalBias === 'number') {
                lighting.dirLight.shadow.normalBias = state.shadows.normalBias;
            }
            if (typeof state.shadows.near === 'number') {
                lighting.dirLight.shadow.camera.near = state.shadows.near;
            }
            if (typeof state.shadows.far === 'number') {
                lighting.dirLight.shadow.camera.far = state.shadows.far;
            }
            if (typeof state.shadows.boxSize === 'number') {
                const shadowCamera = lighting.dirLight.shadow.camera;
                shadowCamera.left = -state.shadows.boxSize;
                shadowCamera.right = state.shadows.boxSize;
                shadowCamera.top = state.shadows.boxSize;
                shadowCamera.bottom = -state.shadows.boxSize;
            }
            lighting.dirLight.shadow.camera.updateProjectionMatrix();
        }

        if (state.shadowCatcher) {
            if (typeof state.shadowCatcher.opacity === 'number') {
                lighting.shadowMaterial.opacity = state.shadowCatcher.opacity;
            }
            if (state.shadowCatcher.color) {
                lighting.shadowMaterial.color.set(state.shadowCatcher.color);
            }
            if (typeof state.shadowCatcher.visible === 'boolean') {
                lighting.shadowPlane.visible = state.shadowCatcher.visible;
            }
            if (typeof state.shadowCatcher.y === 'number') {
                lighting.shadowPlane.position.y = state.shadowCatcher.y;
            }
            if (typeof state.shadowCatcher.scale === 'number') {
                lighting.shadowPlane.scale.setScalar(state.shadowCatcher.scale);
            }
            lighting.shadowMaterial.needsUpdate = true;
        }

        if (state.post) {
            if (typeof state.post.ssaoEnabled === 'boolean') post.ssaoPass.enabled = state.post.ssaoEnabled;
            if (typeof state.post.ssaoRadius === 'number') post.ssaoPass.kernelRadius = state.post.ssaoRadius;
            if (typeof state.post.ssaoMinDistance === 'number') post.ssaoPass.minDistance = state.post.ssaoMinDistance;
            if (typeof state.post.ssaoMaxDistance === 'number') post.ssaoPass.maxDistance = state.post.ssaoMaxDistance;

            if (typeof state.post.bloomEnabled === 'boolean') post.bloomPass.enabled = state.post.bloomEnabled;
            if (typeof state.post.bloomStrength === 'number') post.bloomPass.strength = state.post.bloomStrength;
            if (typeof state.post.bloomRadius === 'number') post.bloomPass.radius = state.post.bloomRadius;
            if (typeof state.post.bloomThreshold === 'number') post.bloomPass.threshold = state.post.bloomThreshold;

            if (typeof state.post.smaaEnabled === 'boolean') post.smaaPass.enabled = state.post.smaaEnabled;
            if (typeof state.post.smaaThreshold === 'number' && typeof post.smaaPass.getEdgeDetectionMaterial === 'function') {
                const edgeMaterial = post.smaaPass.getEdgeDetectionMaterial();
                if (edgeMaterial?.uniforms?.threshold) {
                    edgeMaterial.uniforms.threshold.value = state.post.smaaThreshold;
                }
            }

            if (typeof state.post.vignetteEnabled === 'boolean') post.vignettePass.enabled = state.post.vignetteEnabled;
            if (typeof state.post.vignetteOffset === 'number') post.vignettePass.uniforms.offset.value = state.post.vignetteOffset;
            if (typeof state.post.vignetteDarkness === 'number') post.vignettePass.uniforms.darkness.value = state.post.vignetteDarkness;
        }

        forEachMeshMaterial(worldGroup, (material, mesh) => {
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            material.needsUpdate = true;
        });

        if (syncControls) {
            controls.update();
        }
    }

    function resize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        updateRenderTargets();
    }

    return {
        getState,
        applyState,
        setRenderScale,
        getRenderScale: () => renderScale,
        getEffectivePixelRatio,
        setShadowResolution,
        applyEnvironmentIntensity,
        applyMaterialSettings,
        resize
    };
}
