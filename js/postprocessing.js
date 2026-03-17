import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { VignetteShader } from 'three/addons/shaders/VignetteShader.js';

export function setupPostProcessing(scene, camera, renderer) {
    const composer = new EffectComposer(renderer);

    composer.addPass(new RenderPass(scene, camera));

    const ssaoPass = new SSAOPass(scene, camera, window.innerWidth, window.innerHeight);
    ssaoPass.kernelRadius = 16;
    ssaoPass.minDistance = 0.005;
    ssaoPass.maxDistance = 0.1;
    composer.addPass(ssaoPass);

    const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        0.5,
        0.4,
        0.85
    );
    composer.addPass(bloomPass);

    const smaaPass = new SMAAPass(window.innerWidth, window.innerHeight);
    smaaPass.enabled = true;
    composer.addPass(smaaPass);

    const vignettePass = new ShaderPass(VignetteShader);
    vignettePass.uniforms.offset.value = 1.0;
    vignettePass.uniforms.darkness.value = 1.1;
    composer.addPass(vignettePass);

    composer.addPass(new OutputPass());

    function resize(width, height, pixelRatio) {
        composer.setPixelRatio(pixelRatio);
        composer.setSize(width, height);
        ssaoPass.setSize(width * pixelRatio, height * pixelRatio);
        bloomPass.setSize(width * pixelRatio, height * pixelRatio);
    }

    function render() {
        composer.render();
    }

    return {
        composer,
        ssaoPass,
        bloomPass,
        smaaPass,
        vignettePass,
        resize,
        render
    };
}
