/**
 * @description: 世界坐标转经纬度
 * @param {*} position cartesian3
 */
export function cartesian3ToDegrees(cartesian3) {
    const cartographic = Cesium.Ellipsoid.WGS84.cartesianToCartographic(cartesian3)
    const longitude = Cesium.Math.toDegrees(cartographic.longitude)
    const latitude = Cesium.Math.toDegrees(cartographic.latitude)
    const data = {
        longitude: longitude,
        latitude: latitude,
        altitude: cartographic.height
    }
    return data
}

/**
 * @description: 屏幕坐标查出对应的三维坐标并检测是否有模型或实体
 * @param {*} position {"x":725,"y":258}
 */
export function screenTo3D(position) {
    // We use `viewer.scene.pickPosition` here instead of `viewer.camera.pickEllipsoid` so that
    // we get the correct point when mousing over terrain.

    const ray = viewer.camera.getPickRay(position)
    const cartesian = viewer.scene.globe.pick(ray, viewer.scene)
    if (!cartesian) {
        return
    }
    let rayPosition = viewer.scene.pickFromRay(ray, [])
    if (!rayPosition) {
        rayPosition = viewer.camera.pickEllipsoid(position, viewer.scene.globe.ellipsoid)
    } else {
        rayPosition = rayPosition.position
    }

    const pick = viewer.scene.pickPosition(position)
    const pickModel = viewer.scene.pick(position)
    // const cartographic = Cesium.Cartographic.fromCartesian(cartesian)
    // const heightString = viewer.scene.globe.getHeight(cartographic) // 获取拾取点的高程
    let earthPosition = null
    // * 如果点到有实体但没有模型的位置，拾取的坐标就有问题，是地表坐标
    // * 在模型上拾取位置时，有时会检测不到模型，从而拾取到地面高度，导致顶点在模型上被遮盖
    if (pick) {
        const pickPosition = cartesian3ToDegrees(pick)
        if (pickModel) {
            if (pickModel.id && pickModel.id instanceof Cesium.Entity) {
                // ^ 实体
                if (pickPosition.altitude < -100) {
                    // ^ 在高程地形上的实体
                    earthPosition = cartesian
                } else {
                    earthPosition = pick
                }
            } else {
                // ^ 有模型
                earthPosition = pick
            }
        } else {
            // ^ 无模型无实体
            earthPosition = cartesian
        }
    }
    return {
        rayPosition,
        earthPosition,
        pickModel,
    }
}