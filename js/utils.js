export function forEachMeshMaterial(root, callback) {
    if (!root) return;

    root.traverse((child) => {
        if (!child.isMesh || !child.material) return;

        const materials = Array.isArray(child.material)
            ? child.material
            : [child.material];

        materials.forEach((material) => {
            if (material) {
                callback(material, child);
            }
        });
    });
}

export function getFirstMaterialValue(root, key, fallback) {
    let found = fallback;

    forEachMeshMaterial(root, (material) => {
        if (found !== fallback) return;
        if (material[key] !== undefined) {
            found = material[key];
        }
    });

    return found;
}

export function getFirstTextureAnisotropy(root, fallback = 1) {
    let found = fallback;

    forEachMeshMaterial(root, (material) => {
        if (found !== fallback) return;
        if (material.map && typeof material.map.anisotropy === 'number') {
            found = material.map.anisotropy;
        }
    });

    return found;
}

export function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}
