import { Pane } from 'tweakpane';
import { getFirstTextureAnisotropy } from './utils.js';

export function setupDebugUI({
    scene,
    camera,
    renderer,
    worldGroup,
    lighting,
    post,
    manager,
    presetTools = null
}) {
    const pane = new Pane({ title: 'STUDIO ENGINE PRO', expanded: false });

    const state = manager.getState();

    const renderParams = { renderScale: state.renderScale };
    const cameraParams = { ...state.camera };
    const lightColors = {
        ambient: state.lighting.ambientColor,
        sun: state.lighting.dirColor,
        shadow: state.shadowCatcher.color
    };
    const envParams = { ...state.environment };
    const shadowParams = {
        algorithm: state.shadows.algorithm,
        mapSize: state.shadows.mapSize,
        bias: state.shadows.bias,
        normalBias: state.shadows.normalBias,
        radius: state.shadows.radius,
        size: state.shadows.boxSize,
        near: state.shadows.near,
        far: state.shadows.far
    };
    const catcherParams = { ...state.shadowCatcher };
    const materialParams = {
        quality: state.materialQuality,
        anisotropy: state.materials.anisotropy
    };
    const postParams = { ...state.post };
    const finalOutput = { ...state.rendering };
    const presetParams = {
        activePreset: presetTools?.getCurrentPresetName?.() || 'quality'
    };

    if (presetTools) {
        const presetFolder = pane.addFolder({ title: 'Preset Tools', expanded: false });
        presetFolder.addBinding(presetParams, 'activePreset', {
            options: {
                Rendimiento: 'performance',
                Calidad: 'quality',
                Pro: 'pro'
            },
            label: 'Active Preset'
        }).on('change', (ev) => presetTools.applyPreset?.(ev.value));

        presetFolder.addButton({ title: 'Guardar preset actual' }).on('click', () => presetTools.saveCurrentPreset?.());
        presetFolder.addButton({ title: 'Resetear preset actual' }).on('click', () => presetTools.resetCurrentPreset?.());
    }

    const renderFolder = pane.addFolder({ title: 'Rendering', expanded: false });
    renderFolder.addBinding(renderParams, 'renderScale', {
        min: 0.25,
        max: 2,
        step: 0.05,
        label: 'Render Scale'
    }).on('change', (ev) => {
        manager.setRenderScale(ev.value);
        refreshFromState();
    });

    const cameraFolder = pane.addFolder({ title: 'Camera', expanded: false });
    ['fov', 'near', 'far'].forEach((key) => {
        const config = key === 'fov'
            ? { min: 20, max: 100, step: 1 }
            : key === 'near'
                ? { min: 0.01, max: 10, step: 0.01 }
                : { min: 10, max: 5000, step: 1 };

        cameraFolder.addBinding(cameraParams, key, config).on('change', () => {
            manager.applyState({ camera: { ...cameraParams } });
            refreshFromState();
        });
    });

    const lightingFolder = pane.addFolder({ title: 'Lighting', expanded: false });
    const ambientFolder = lightingFolder.addFolder({ title: 'Ambient Light', expanded: false });
    ambientFolder.addBinding(lighting.ambientLight, 'intensity', { min: 0, max: 3 }).on('change', refreshFromState);
    ambientFolder.addBinding(lightColors, 'ambient', { label: 'Color' }).on('change', (ev) => {
        lighting.ambientLight.color.set(ev.value);
        refreshFromState();
    });

    const sunFolder = lightingFolder.addFolder({ title: 'Directional Light (Sun)', expanded: false });
    sunFolder.addBinding(lighting.dirLight, 'intensity', { min: 0, max: 10 }).on('change', refreshFromState);
    sunFolder.addBinding(lightColors, 'sun', { label: 'Color' }).on('change', (ev) => {
        lighting.dirLight.color.set(ev.value);
        refreshFromState();
    });
    sunFolder.addBinding(lighting.dirLight, 'position', {
        x: { min: -15, max: 15 },
        y: { min: 0, max: 15 },
        z: { min: -15, max: 15 }
    }).on('change', refreshFromState);

    const envFolder = lightingFolder.addFolder({ title: 'Environment', expanded: false });
    envFolder.addBinding(envParams, 'backgroundEnabled', { label: 'Show Background' }).on('change', (ev) => {
        lighting.setBackgroundEnabled(ev.value);
        refreshFromState();
    });
    envFolder.addBinding(envParams, 'environmentEnabled', { label: 'Use Environment' }).on('change', (ev) => {
        lighting.setEnvironmentEnabled(ev.value);
        refreshFromState();
    });
    envFolder.addBinding(envParams, 'intensity', {
        min: 0,
        max: 5,
        step: 0.01,
        label: 'HDR Intensity'
    }).on('change', (ev) => {
        manager.applyEnvironmentIntensity(ev.value);
        refreshFromState();
    });

    const shadowFolder = lightingFolder.addFolder({ title: 'Shadow Map Settings', expanded: false });
    shadowFolder.addBinding(shadowParams, 'algorithm', {
        options: { Basic: 0, PCF: 1, 'PCF Soft': 2, VSM: 3 },
        label: 'Algorithm'
    }).on('change', () => {
        manager.applyState({ shadows: { algorithm: shadowParams.algorithm } });
        refreshFromState();
    });
    shadowFolder.addBinding(shadowParams, 'mapSize', {
        options: { 512: 512, 1024: 1024, 2048: 2048, 4096: 4096 },
        label: 'Shadow Resolution'
    }).on('change', (ev) => {
        manager.setShadowResolution(ev.value);
        refreshFromState();
    });
    ['bias', 'normalBias', 'radius', 'size', 'near', 'far'].forEach((key) => {
        const config = {
            bias: { min: -0.005, max: 0.005, step: 0.0001 },
            normalBias: { min: -0.05, max: 0.05, step: 0.001 },
            radius: { min: 0, max: 25, step: 0.1, label: 'Blur (Radius)' },
            size: { min: 0.1, max: 20, step: 0.1, label: 'Shadow Box Size' },
            near: { min: 0.01, max: 10, step: 0.01, label: 'Near' },
            far: { min: 1, max: 200, step: 1, label: 'Far' }
        }[key];

        shadowFolder.addBinding(shadowParams, key, config).on('change', () => {
            manager.applyState({
                shadows: {
                    bias: shadowParams.bias,
                    normalBias: shadowParams.normalBias,
                    radius: shadowParams.radius,
                    boxSize: shadowParams.size,
                    near: shadowParams.near,
                    far: shadowParams.far
                }
            });
            refreshFromState();
        });
    });

    const catcherFolder = lightingFolder.addFolder({ title: 'Shadow Catcher (Floor)', expanded: false });
    catcherFolder.addBinding(catcherParams, 'opacity', { min: 0, max: 1 }).on('change', () => {
        manager.applyState({ shadowCatcher: { opacity: catcherParams.opacity } });
        refreshFromState();
    });
    catcherFolder.addBinding(lightColors, 'shadow', { label: 'Shadow Tint' }).on('change', (ev) => {
        manager.applyState({ shadowCatcher: { color: ev.value } });
        refreshFromState();
    });
    catcherFolder.addBinding(catcherParams, 'visible', { label: 'Visible' }).on('change', () => {
        manager.applyState({ shadowCatcher: { visible: catcherParams.visible } });
        refreshFromState();
    });
    catcherFolder.addBinding(catcherParams, 'y', { min: -2, max: 2, step: 0.01, label: 'Position Y' }).on('change', () => {
        manager.applyState({ shadowCatcher: { y: catcherParams.y } });
        refreshFromState();
    });
    catcherFolder.addBinding(catcherParams, 'scale', { min: 0.1, max: 20, step: 0.1, label: 'Scale' }).on('change', () => {
        manager.applyState({ shadowCatcher: { scale: catcherParams.scale } });
        refreshFromState();
    });

    const materialFolder = pane.addFolder({ title: 'Materials', expanded: false });
    materialFolder.addBinding(materialParams, 'quality', {
        options: { Low: 'low', Medium: 'medium', 'Max Quality': 'max' },
        label: 'Material Quality'
    }).on('change', (ev) => {
        manager.applyMaterialSettings({ quality: ev.value, anisotropy: materialParams.anisotropy, envMapIntensity: envParams.intensity });
        refreshFromState();
    });
    materialFolder.addBinding(materialParams, 'anisotropy', {
        min: 1,
        max: 16,
        step: 1,
        label: 'Texture Sharpness'
    }).on('change', (ev) => {
        manager.applyMaterialSettings({ anisotropy: ev.value, envMapIntensity: envParams.intensity });
        refreshFromState();
    });

    const postFolder = pane.addFolder({ title: 'Post-Processing', expanded: false });
    const ssaoFolder = postFolder.addFolder({ title: 'Ambient Occlusion (SSAO)', expanded: true });
    ['ssaoEnabled', 'ssaoRadius', 'ssaoMinDistance', 'ssaoMaxDistance'].forEach((key) => {
        const config = {
            ssaoEnabled: { label: 'Enable SSAO' },
            ssaoRadius: { min: 0, max: 32, label: 'Radius' },
            ssaoMinDistance: { min: 0, max: 0.01, step: 0.0001 },
            ssaoMaxDistance: { min: 0, max: 0.3, step: 0.01 }
        }[key];
        ssaoFolder.addBinding(postParams, key, config).on('change', () => {
            manager.applyState({ post: { [keyToPostState(key)]: postParams[key] } });
            refreshFromState();
        });
    });

    const bloomFolder = postFolder.addFolder({ title: 'Bloom', expanded: false });
    ['bloomEnabled', 'bloomStrength', 'bloomRadius', 'bloomThreshold'].forEach((key) => {
        const config = {
            bloomEnabled: {},
            bloomStrength: { min: 0, max: 3 },
            bloomRadius: { min: 0, max: 1 },
            bloomThreshold: { min: 0, max: 1 }
        }[key];
        bloomFolder.addBinding(postParams, key, config).on('change', () => {
            manager.applyState({ post: { [keyToPostState(key)]: postParams[key] } });
            refreshFromState();
        });
    });

    const aaFolder = postFolder.addFolder({ title: 'Anti-Aliasing (SMAA)', expanded: false });
    aaFolder.addBinding(postParams, 'smaaEnabled', { label: 'Enable SMAA' }).on('change', () => {
        manager.applyState({ post: { smaaEnabled: postParams.smaaEnabled } });
        refreshFromState();
    });
    aaFolder.addBinding(postParams, 'smaaThreshold', {
        min: 0,
        max: 0.5,
        step: 0.01,
        label: 'Edge Detection'
    }).on('change', () => {
        manager.applyState({ post: { smaaThreshold: postParams.smaaThreshold } });
        refreshFromState();
    });

    const vignetteFolder = postFolder.addFolder({ title: 'Vignette', expanded: false });
    ['vignetteEnabled', 'vignetteOffset', 'vignetteDarkness'].forEach((key) => {
        const config = {
            vignetteEnabled: {},
            vignetteOffset: { min: 0, max: 3, step: 0.01 },
            vignetteDarkness: { min: 0, max: 3, step: 0.01 }
        }[key];
        vignetteFolder.addBinding(postParams, key, config).on('change', () => {
            manager.applyState({ post: { [keyToPostState(key)]: postParams[key] } });
            refreshFromState();
        });
    });

    const finalFolder = postFolder.addFolder({ title: 'Final Output', expanded: false });
    finalFolder.addBinding(finalOutput, 'exposure', { min: 0, max: 4, label: 'Exposure' }).on('change', () => {
        manager.applyState({ rendering: { exposure: finalOutput.exposure } });
        refreshFromState();
    });
    finalFolder.addBinding(finalOutput, 'toneMapping', {
        options: { None: 0, Linear: 1, Reinhard: 2, Cineon: 3, ACES: 4 }
    }).on('change', () => {
        manager.applyState({ rendering: { toneMapping: finalOutput.toneMapping } });
        refreshFromState();
    });

    function keyToPostState(key) {
        return key;
    }

    function refreshFromState() {
        const nextState = manager.getState();

        renderParams.renderScale = nextState.renderScale;
        cameraParams.fov = camera.fov;
        cameraParams.near = camera.near;
        cameraParams.far = camera.far;

        lightColors.ambient = nextState.lighting.ambientColor;
        lightColors.sun = nextState.lighting.dirColor;
        lightColors.shadow = nextState.shadowCatcher.color;

        envParams.backgroundEnabled = nextState.environment.backgroundEnabled;
        envParams.environmentEnabled = nextState.environment.environmentEnabled;
        envParams.intensity = nextState.environment.intensity;

        shadowParams.algorithm = nextState.shadows.algorithm;
        shadowParams.mapSize = nextState.shadows.mapSize;
        shadowParams.bias = nextState.shadows.bias;
        shadowParams.normalBias = nextState.shadows.normalBias;
        shadowParams.radius = nextState.shadows.radius;
        shadowParams.size = nextState.shadows.boxSize;
        shadowParams.near = nextState.shadows.near;
        shadowParams.far = nextState.shadows.far;

        catcherParams.opacity = nextState.shadowCatcher.opacity;
        catcherParams.visible = nextState.shadowCatcher.visible;
        catcherParams.y = nextState.shadowCatcher.y;
        catcherParams.scale = nextState.shadowCatcher.scale;

        materialParams.quality = nextState.materialQuality;
        materialParams.anisotropy = getFirstTextureAnisotropy(worldGroup, nextState.materials.anisotropy);

        Object.assign(postParams, nextState.post);
        finalOutput.exposure = renderer.toneMappingExposure;
        finalOutput.toneMapping = renderer.toneMapping;

        if (presetTools?.getCurrentPresetName) {
            presetParams.activePreset = presetTools.getCurrentPresetName();
        }

        pane.refresh();
    }

    return {
        pane,
        refreshFromState
    };
}
