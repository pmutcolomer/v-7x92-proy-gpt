import * as THREE from 'three';

import { setupScene } from './scene.js';
import { setupPostProcessing } from './postprocessing.js';
import { loadModel } from './loader.js';
import { setupDebugUI } from './debug-ui.js';
import { loadQualityPresets, saveQualityPresets, resetQualityPreset } from './presets.js';
import { createQualityManager } from './quality-manager.js';

const {
    scene,
    camera,
    renderer,
    controls,
    worldGroup,
    ...lighting
} = setupScene();

const post = setupPostProcessing(scene, camera, renderer);

let isAutoRotating = false;
let currentQualityPreset = 'quality';
let qualityPresets = null;
let debugUI = null;
let manager = null;

const clock = new THREE.Clock();

function getViewportSize() {
    const viewport = window.visualViewport;
    return {
        width: Math.max(1, Math.round(viewport?.width || window.innerWidth || 1)),
        height: Math.max(1, Math.round(viewport?.height || window.innerHeight || 1))
    };
}

function ensureRuntimeStatusElement() {
    let el = document.getElementById('runtime-status');

    if (!el) {
        el = document.createElement('div');
        el.id = 'runtime-status';
        el.style.cssText = [
            'position:fixed',
            'top:16px',
            'left:16px',
            'max-width:420px',
            'padding:10px 14px',
            'border-radius:12px',
            'background:rgba(0,0,0,0.66)',
            'color:#fff',
            'font:12px/1.4 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif',
            'z-index:1200',
            'pointer-events:none',
            'display:none',
            'backdrop-filter: blur(10px)'
        ].join(';');

        document.body.appendChild(el);
    }

    return el;
}

function setStatus(message, type = 'info') {
    const el = ensureRuntimeStatusElement();

    if (!message) {
        el.style.display = 'none';
        el.textContent = '';
        el.dataset.type = '';
        return;
    }

    el.textContent = message;
    el.style.display = 'block';
    el.dataset.type = type;
}

function syncSimpleUiFromState() {
    if (!manager) return;

    const state = manager.getState();

    const presetSelect = document.getElementById('quality-preset');
    if (presetSelect) {
        presetSelect.value = currentQualityPreset;
    }

    const exposureSlider = document.getElementById('exposure-slider');
    if (exposureSlider) {
        exposureSlider.value = state.rendering.exposure;
    }

    const lightIntensity = document.getElementById('light-intensity');
    if (lightIntensity) {
        lightIntensity.value = state.lighting.dirIntensity;
    }

    const lightAngle = document.getElementById('light-angle');
    if (lightAngle) {
        lightAngle.value = Math.atan2(
            lighting.dirLight.position.z,
            lighting.dirLight.position.x
        );
    }

    const shadowSlider = document.getElementById('shadow-slider');
    if (shadowSlider) {
        shadowSlider.value = state.shadowCatcher.opacity;
    }

    const rotationSlider = document.getElementById('model-rotation');
    if (rotationSlider) {
        rotationSlider.value = ((THREE.MathUtils.radToDeg(worldGroup.rotation.y) % 360) + 360) % 360;
    }

    const autoRotateCheckbox = document.getElementById('auto-rotate');
    if (autoRotateCheckbox) {
        autoRotateCheckbox.checked = isAutoRotating;
    }
}

function applyQualityPreset(name, syncUi = true) {
    const preset = qualityPresets?.[name];
    if (!preset || !manager) return;

    currentQualityPreset = name;
    manager.applyState(preset);

    if (syncUi) {
        syncSimpleUiFromState();
    }

    debugUI?.refreshFromState?.();
}

async function saveCurrentPreset() {
    if (!qualityPresets || !manager) return;

    qualityPresets[currentQualityPreset] = manager.getState();
    await saveQualityPresets(qualityPresets);

    debugUI?.refreshFromState?.();
    setStatus(`Preset "${currentQualityPreset}" guardado.`);
}

async function resetCurrentPresetToDefault() {
    if (!qualityPresets) return;

    qualityPresets = await resetQualityPreset(qualityPresets, currentQualityPreset);
    await saveQualityPresets(qualityPresets);

    applyQualityPreset(currentQualityPreset);
    setStatus(`Preset "${currentQualityPreset}" reseteado.`);
}

function bindUi() {
    const ui = document.getElementById('ui');
    const openMenuBtn = document.getElementById('open-menu');
    const closeMenuBtn = document.getElementById('close-menu');
    const mobileHandle = ui?.querySelector('.mobile-handle');
    const uiHeader = ui?.querySelector('.ui-header');
    const uiContent = ui?.querySelector('.ui-content');
    const scrollZone = ui?.querySelector('.scroll-grab-zone');
    const scrollTrack = ui?.querySelector('.scroll-track');
    const scrollThumb = ui?.querySelector('.scroll-thumb');
    const mobileMediaQuery = window.matchMedia('(max-width: 768px)');

    const isMobileSheet = () => mobileMediaQuery.matches;

    const setMobileSheetState = (expanded) => {
        if (!ui || !isMobileSheet()) return;

        ui.classList.remove('hidden');
        ui.classList.toggle('mobile-expanded', expanded);
        ui.classList.toggle('mobile-collapsed', !expanded);

        if (openMenuBtn) {
            openMenuBtn.style.display = 'none';
        }
    };

    const syncResponsiveUiMode = () => {
        if (!ui) return;

        if (isMobileSheet()) {
            setMobileSheetState(false);
        } else {
            ui.classList.remove('mobile-expanded', 'mobile-collapsed');
            ui.classList.remove('hidden');

            if (openMenuBtn) {
                openMenuBtn.style.display = 'none';
            }
        }

        requestAnimationFrame(() => {
            uiContent?.dispatchEvent(new Event('scroll'));
        });
    };

    const bind = (id, eventName, handler) => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener(eventName, handler);
        }
    };

    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');

    tabButtons.forEach((button) => {
        button.addEventListener('click', () => {
            const targetId = button.dataset.tab;
            const targetPane = document.getElementById(targetId);

            tabButtons.forEach((btn) => btn.classList.remove('active'));
            tabPanes.forEach((pane) => pane.classList.remove('active'));

            button.classList.add('active');
            targetPane?.classList.add('active');

            if (uiContent) {
                uiContent.scrollTop = 0;
            }

            requestAnimationFrame(() => {
                uiContent?.dispatchEvent(new Event('scroll'));
            });

            if (isMobileSheet()) {
                setMobileSheetState(true);
            }
        });
    });

    closeMenuBtn?.addEventListener('click', (event) => {
        event.stopPropagation();

        if (isMobileSheet()) {
            setMobileSheetState(false);
            return;
        }

        ui?.classList.add('hidden');
        if (ui) {
            ui.style.display = '';
        }
        if (openMenuBtn) {
            openMenuBtn.style.display = 'block';
        }
    });

    bind('open-menu', 'click', () => {
        if (isMobileSheet()) {
            setMobileSheetState(true);
            return;
        }

        ui?.classList.remove('hidden');
        if (ui) {
            ui.style.display = '';
        }
        if (openMenuBtn) {
            openMenuBtn.style.display = 'none';
        }
    });

    const expandMobileSheet = () => {
        if (isMobileSheet() && ui?.classList.contains('mobile-collapsed')) {
            setMobileSheetState(true);
        }
    };

    mobileHandle?.addEventListener('click', expandMobileSheet);
    uiHeader?.addEventListener('click', (event) => {
        if (event.target === closeMenuBtn) return;
        expandMobileSheet();
    });

    let touchStartY = 0;
    let touchEndY = 0;

    const trackStart = (event) => {
        touchStartY = event.touches[0]?.clientY ?? 0;
        touchEndY = touchStartY;
    };

    const trackMove = (event) => {
        touchEndY = event.touches[0]?.clientY ?? touchEndY;
    };

    const trackEnd = () => {
        if (!isMobileSheet()) return;

        const deltaY = touchEndY - touchStartY;

        if (deltaY <= -30) {
            setMobileSheetState(true);
        } else if (deltaY >= 30) {
            setMobileSheetState(false);
        }
    };

    [mobileHandle, uiHeader].forEach((element) => {
        element?.addEventListener('touchstart', trackStart, { passive: true });
        element?.addEventListener('touchmove', trackMove, { passive: true });
        element?.addEventListener('touchend', trackEnd, { passive: true });
    });

    if (scrollZone && uiContent && scrollTrack && scrollThumb) {
        let startY = 0;
        let startScroll = 0;
        let draggingScrollZone = false;

        const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

        const updateCustomScrollbar = () => {
            if (!isMobileSheet()) return;

            const contentHeight = uiContent.clientHeight;
            const scrollHeight = uiContent.scrollHeight;
            const scrollTop = uiContent.scrollTop;
            const trackHeight = scrollTrack.clientHeight;

            if (!contentHeight || !scrollHeight || !trackHeight) return;

            const maxScroll = Math.max(scrollHeight - contentHeight, 0);

            if (maxScroll <= 0) {
                scrollThumb.style.opacity = '0';
                scrollThumb.style.transform = 'translateY(0px)';
                scrollThumb.style.height = `${trackHeight}px`;
                return;
            }

            scrollThumb.style.opacity = '1';

            const visibleRatio = contentHeight / scrollHeight;
            const thumbHeight = clamp(trackHeight * visibleRatio, 28, trackHeight);
            const maxThumbTravel = trackHeight - thumbHeight;
            const scrollRatio = scrollTop / maxScroll;
            const thumbY = maxThumbTravel * scrollRatio;

            scrollThumb.style.height = `${thumbHeight}px`;
            scrollThumb.style.transform = `translateY(${thumbY}px)`;
        };

        const scrollFromTouch = (clientY) => {
            const delta = clientY - startY;
            const contentHeight = uiContent.clientHeight;
            const scrollHeight = uiContent.scrollHeight;
            const trackHeight = scrollTrack.clientHeight;
            const thumbHeight = scrollThumb.offsetHeight || 28;

            const maxScroll = Math.max(scrollHeight - contentHeight, 0);
            const maxThumbTravel = Math.max(trackHeight - thumbHeight, 1);

            if (maxScroll <= 0) return;

            const scrollPerPixel = maxScroll / maxThumbTravel;
            uiContent.scrollTop = startScroll + (delta * scrollPerPixel);
        };

        uiContent.addEventListener('scroll', updateCustomScrollbar, { passive: true });
        window.addEventListener('resize', updateCustomScrollbar, { passive: true });
        window.addEventListener('orientationchange', updateCustomScrollbar, { passive: true });

        scrollZone.addEventListener('touchstart', (e) => {
            const touch = e.touches?.[0];
            if (!touch) return;

            startY = touch.clientY;
            startScroll = uiContent.scrollTop;
            draggingScrollZone = true;
            updateCustomScrollbar();
        }, { passive: true });

        scrollZone.addEventListener('touchmove', (e) => {
            if (!draggingScrollZone) return;

            const touch = e.touches?.[0];
            if (!touch) return;

            scrollFromTouch(touch.clientY);
            updateCustomScrollbar();
            e.preventDefault();
        }, { passive: false });

        const endScrollZoneDrag = () => {
            draggingScrollZone = false;
        };

        scrollZone.addEventListener('touchend', endScrollZoneDrag, { passive: true });
        scrollZone.addEventListener('touchcancel', endScrollZoneDrag, { passive: true });

        requestAnimationFrame(updateCustomScrollbar);

        const tabsObserver = new MutationObserver(() => {
            requestAnimationFrame(updateCustomScrollbar);
        });

        tabsObserver.observe(uiContent, {
            subtree: true,
            childList: true,
            attributes: true,
            attributeFilter: ['class', 'style']
        });
    }

    mobileMediaQuery.addEventListener?.('change', syncResponsiveUiMode);
    window.addEventListener('orientationchange', syncResponsiveUiMode, { passive: true });
    syncResponsiveUiMode();

    bind('auto-rotate', 'change', (event) => {
        isAutoRotating = event.target.checked;
    });

    bind('model-rotation', 'input', (event) => {
        isAutoRotating = false;

        const autoRotateCheckbox = document.getElementById('auto-rotate');
        if (autoRotateCheckbox) {
            autoRotateCheckbox.checked = false;
        }

        worldGroup.rotation.y = THREE.MathUtils.degToRad(parseFloat(event.target.value) || 0);
        debugUI?.refreshFromState?.();
    });

    bind('quality-preset', 'change', (event) => {
        applyQualityPreset(event.target.value);
    });

    bind('exposure-slider', 'input', (event) => {
        manager?.applyState({
            rendering: {
                exposure: parseFloat(event.target.value)
            }
        });
        debugUI?.refreshFromState?.();
    });

    bind('light-intensity', 'input', (event) => {
        lighting.dirLight.intensity = parseFloat(event.target.value);
        debugUI?.refreshFromState?.();
    });

    bind('light-angle', 'input', (event) => {
        lighting.updateLight(
            parseFloat(event.target.value),
            lighting.dirLight.intensity
        );
        debugUI?.refreshFromState?.();
    });

    bind('shadow-slider', 'input', (event) => {
        manager?.applyState({
            shadowCatcher: {
                opacity: parseFloat(event.target.value)
            }
        });
        debugUI?.refreshFromState?.();
    });
}

async function loadUiShell() {
    const response = await fetch('ui.html', { cache: 'no-store' });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    document.body.insertAdjacentHTML('beforeend', await response.text());
    bindUi();
}

async function loadModelsList() {
    const modelSelect = document.getElementById('model-select');

    try {
        const response = await fetch('meshes/list.json', { cache: 'no-store' });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const models = await response.json();

        if (!Array.isArray(models) || models.length === 0) {
            throw new Error('meshes/list.json está vacío o tiene formato inválido');
        }

        if (modelSelect) {
            modelSelect.innerHTML = models
                .map((model) => `<option value="meshes/${model.file}">${model.name}</option>`)
                .join('');

            modelSelect.addEventListener('change', (event) => {
                setStatus('Cargando modelo...', 'info');

                loadModel(worldGroup, event.target.value, controls, {
                    onLoaded: () => {
                        worldGroup.rotation.set(0, 0, 0);
                        isAutoRotating = false;

                        const autoRotateCheckbox = document.getElementById('auto-rotate');
                        if (autoRotateCheckbox) {
                            autoRotateCheckbox.checked = false;
                        }

                        applyQualityPreset(currentQualityPreset, false);
                        syncSimpleUiFromState();
                        setStatus('');

                        requestAnimationFrame(() => {
                            document.querySelector('.ui-content')?.dispatchEvent(new Event('scroll'));
                        });
                    },
                    onError: () => {
                        setStatus('No se pudo cargar el modelo seleccionado.', 'error');
                    }
                });
            });
        }

        setStatus('Cargando modelo inicial...', 'info');

        loadModel(worldGroup, `meshes/${models[0].file}`, controls, {
            onLoaded: () => {
                worldGroup.rotation.set(0, 0, 0);
                isAutoRotating = false;
                applyQualityPreset(currentQualityPreset, false);
                syncSimpleUiFromState();
                setStatus('');

                requestAnimationFrame(() => {
                    document.querySelector('.ui-content')?.dispatchEvent(new Event('scroll'));
                });
            },
            onError: () => {
                setStatus('No se pudo cargar el modelo inicial.', 'error');
            }
        });
    } catch (error) {
        if (modelSelect) {
            modelSelect.innerHTML = '<option>No hay modelos disponibles</option>';
        }

        setStatus('No se encontró meshes/list.json o no hay modelos disponibles.', 'warning');
        console.warn(error);
    }
}

function handleViewportResize() {
    if (manager) {
        manager.resize();
    } else {
        const { width, height } = getViewportSize();

        camera.aspect = width / height;
        camera.updateProjectionMatrix();

        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(width, height);
    }

    if (typeof renderer.clear === 'function') {
        renderer.clear();
    }

    controls.update();

    requestAnimationFrame(() => {
        document.querySelector('.ui-content')?.dispatchEvent(new Event('scroll'));
    });
}

function animate() {
    function loop() {
        requestAnimationFrame(loop);

        const delta = clock.getDelta();

        if (isAutoRotating) {
            worldGroup.rotation.y += delta * 0.6;

            const slider = document.getElementById('model-rotation');
            if (slider) {
                slider.value = ((THREE.MathUtils.radToDeg(worldGroup.rotation.y) % 360) + 360) % 360;
            }
        }

        controls.update();
        post.render();
    }

    loop();
}

async function init() {
    try {
        qualityPresets = await loadQualityPresets();

        await loadUiShell().catch((error) => {
            console.error('No se pudo cargar ui.html:', error);
            setStatus('ui.html no está disponible. El visor sigue funcionando sin ese panel.', 'warning');
        });

        manager = createQualityManager({
            scene,
            camera,
            renderer,
            controls,
            worldGroup,
            lighting,
            post
        });

        applyQualityPreset(currentQualityPreset);
        syncSimpleUiFromState();

        debugUI = setupDebugUI({
            scene,
            camera,
            renderer,
            worldGroup,
            lighting,
            post,
            manager,
            presetTools: {
                getCurrentPresetName: () => currentQualityPreset,
                applyPreset: (name) => applyQualityPreset(name),
                saveCurrentPreset,
                resetCurrentPreset: resetCurrentPresetToDefault
            }
        });

        debugUI?.refreshFromState?.();

        await loadModelsList();
        animate();
    } catch (error) {
        console.error('Initialization error:', error);
        setStatus('Fallo al inicializar el visor.', 'error');
    }
}

let resizeRaf = 0;

function scheduleViewportResize() {
    if (resizeRaf) return;

    resizeRaf = window.requestAnimationFrame(() => {
        resizeRaf = 0;
        handleViewportResize();
        syncSimpleUiFromState();
        debugUI?.refreshFromState?.();
    });
}

window.addEventListener('resize', scheduleViewportResize, { passive: true });
window.addEventListener('orientationchange', scheduleViewportResize, { passive: true });
window.visualViewport?.addEventListener('resize', scheduleViewportResize, { passive: true });
window.visualViewport?.addEventListener('scroll', scheduleViewportResize, { passive: true });

init();
