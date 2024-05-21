import * as turf from '@turf/turf'
import CoordinateSystem from './CoordinateSystem'

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
    let cartesian3 = null
    let pickPosition = null
    // * 如果点到有实体但没有模型的位置，拾取的坐标就有问题，是地表坐标
    // * 在模型上拾取位置时，有时会检测不到模型，从而拾取到地面高度，导致顶点在模型上被遮盖
    if (pick) {
        pickPosition = cartesian3ToDegrees(pick)
        if (pickModel) {
            if (pickModel.id && pickModel.id instanceof Cesium.Entity) {
                // ^ 实体
                if (pickPosition.altitude < -100) {
                    // ^ 在高程地形上的实体
                    cartesian3 = cartesian
                } else {
                    cartesian3 = pick
                }
            } else {
                // ^ 有模型
                cartesian3 = pick
            }
        } else {
            // ^ 无模型无实体
            cartesian3 = cartesian
        }
    }
    return {
        cartesian3,
        position: pickPosition,
        rayPosition,
        pickModel,
    }
}

/**
 * @description: 计算贝塞尔曲线
 * @param {*} points
 * @param {*} count
 * @return {*} positions
 */
export function getBezier(points, count) {
    const _count = count || 20
    const points3D = []
    const result = []
    for (let i = 0; i < points.length; i++) {
        const res = points[i]
        const point = {
            x: res.longitude,
            y: res.latitude,
            z: res.altitude
        }
        points3D.push(point)
    }
    const cbs = computeBezier(points3D, _count)
    for (let j = 0; j < cbs.length; j++) {
        result.push(cbs[j].x)
        result.push(cbs[j].y)
        result.push(cbs[j].z)
    }
    return Cesium.Cartesian3.fromDegreesArrayHeights(result)
}
function pointOnCubicBezier(cp, t) {
    let result = {}
    const length = cp.length
    const inteval = Math.floor(length / 4)
    const cx = 3.0 * (cp[inteval].x - cp[0].x)
    const bx = 3.0 * (cp[2 * inteval].x - cp[inteval].x) - cx
    const ax = cp[length - 1].x - cp[0].x - cx - bx
    const cy = 3.0 * (cp[inteval].y - cp[0].y)
    const by = 3.0 * (cp[2 * inteval].y - cp[inteval].y) - cy
    const ay = cp[length - 1].y - cp[0].y - cy - by
    const cz = 3.0 * (cp[inteval].z - cp[0].z)
    const bz = 3.0 * (cp[2 * inteval].z - cp[inteval].z) - cz
    const az = cp[length - 1].z - cp[0].z - cz - bz
    const tSquared = t * t
    const tCubed = tSquared * t
    result = {
        x: ax * tCubed + bx * tSquared + cx * t + cp[0].x,
        y: ay * tCubed + by * tSquared + cy * t + cp[0].y,
        z: az * tCubed + bz * tSquared + cz * t + cp[0].z
    }
    return result
}
function computeBezier(cp, numberOfPoints) {
    const curve = []
    const dt = 1.0 / (numberOfPoints - 1)
    for (let i = 0; i < numberOfPoints; i++) {
        curve[i] = pointOnCubicBezier(cp, i * dt)
    }
    return curve
}

/**
 * @description: 判断两个坐标是否在同一位置
 * @param {*} a
 * @param {*} b
 * @return {*}
 */
export function equalPosition(a, b) {
    let result = false
    if (
        a.longitude === b.longitude &&
        a.latitude === b.latitude &&
        a.altitude === b.altitude
    ) {
        result = true
    }
    return result
}

/**
 * @description: 获取当前相机信息
 * @return {*}
 */
export function getCameraPositionInfo() {
    // 获取相机姿态信息
    const head = viewer.scene.camera.heading
    const pitch = viewer.scene.camera.pitch
    const roll = viewer.scene.camera.roll
    const orientation = { head, pitch, roll }
    // 获取位置 wgs84 的地心坐标系，x, y 坐标值以弧度来表示
    const position = viewer.scene.camera.positionCartographic // with longitude and latitude expressed in radians and height in meters.

    // 以下方式也可以获取相机位置只是返回的坐标系不一样
    // const position = viewer.scene.camera.position // cartesian3 空间直角坐标系
    // const ellipsoid = scene.globe.ellipsoid
    // const position = ellipsoid.cartesianToCartographic(viewer.scene.camera.position)

    // 弧度转经纬度
    const longitude = parseFloat(Cesium.Math.toDegrees(position.longitude).toFixed(7))
    const latitude = parseFloat(Cesium.Math.toDegrees(position.latitude).toFixed(7))
    const altitude = parseFloat(position.height.toFixed(2))
    return {
        position: {
            longitude,
            latitude,
            altitude
        }, orientation
    }
}

/**
 * @description: 获取高程位置上的坐标
 * @param {*} position
 * @return {*}
 */
export function getTerrainPosition(position) {
    if (terrain) {
        const promise = Cesium.sampleTerrainMostDetailed(terrain, [
            Cesium.Cartographic.fromCartesian(
                Cesium.Cartesian3.fromDegrees(position.longitude, position.latitude, 0)
            )
        ])
        return Promise.resolve(promise).then(function (updatedPositions) {
            if (updatedPositions && updatedPositions.length > 0 && updatedPositions[0].height) {
                const _position = updatedPositions[0]
                return {
                    longitude: parseFloat(Cesium.Math.toDegrees(_position.longitude).toFixed(7)),
                    latitude: parseFloat(Cesium.Math.toDegrees(_position.latitude).toFixed(7)),
                    altitude: parseFloat(_position.height.toFixed(2))
                }
            } else {
                return position
            }
        })
    } else {
        return position
    }
}

/**
 * @description: 计算三角形面积
 * @param {*} pos1
 * @param {*} pos2
 * @param {*} pos3
 * @return {*} 三角形面积㎡
 */
export function computeArea4Triangle(pos1, pos2, pos3) {
    const a = Cesium.Cartesian3.distance(pos1, pos2)
    const b = Cesium.Cartesian3.distance(pos2, pos3)
    const c = Cesium.Cartesian3.distance(pos3, pos1)
    const S = (a + b + c) / 2
    return Math.sqrt(S * (S - a) * (S - b) * (S - c))
}

/**
 * @description: 根据坐标点集合计算多边形中心
 * @param {*} points [[117.7134477, 39.0776166], [117.7134755, 39.0776612], [117.7135393, 39.0776461], [117.7134477, 39.0776166]] 注意：polygon 首尾坐标要一致
 * @return {*}
 */
export function getPolygonCenter(points) {
    let result = 0
    if (points && points.length > 3) {
        const _polygon = turf.polygon([points])
        result = turf.centroid(_polygon)
    }
    return result
}

/**
 * @description: 根据坐标点集合计算多边形面积
 * @param {*} points [[117.7134477, 39.0776166], [117.7134755, 39.0776612], [117.7135393, 39.0776461], [117.7134477, 39.0776166]] 注意：polygon 首尾坐标要一致
 * @return {*}
 */
export function getPolygonArea(points) {
    let result = 0
    if (points && points.length > 3) {
        const _polygon = turf.polygon([points])
        result = turf.area(_polygon)
    }
    return +result.toFixed(2)
}

/**
 * @description: 根据多边形实体计算多边形中心点
 * @param {*} entity
 * @return {*}
 */
export function getPolygonCenterByEntity(entity) {
    if (entity && entity.polygon) {
        const _positions = entity.polygon.hierarchy.getValue(Cesium.JulianDate.now()).positions
        const _center = Cesium.BoundingSphere.fromPoints(_positions).center
        return _center
    }
}

/**
 * @description: 根据经纬度坐标点集合计算多边形中心点
 * @param {*} points
 * @return {*}
 */
export function getPolygonCenterByPoints(points) {
    const polygon = new Cesium.PolygonGeometry({
        polygonHierarchy: new Cesium.PolygonHierarchy(
            Cesium.Cartesian3.fromDegreesArrayHeights(points)
        )
    })
    const geometry = Cesium.PolygonGeometry.createGeometry(polygon)
    if (geometry && geometry.boundingSphere) {
        const center = geometry.boundingSphere.center
        return cartesianToLongAndLat(center)
    }
}

/**
 * @description: 根据两点计算朝向角度
 * @param {*} pointA
 * @param {*} pointB
 * @return {*}
 */
export function getHeadingDegByTwoPoints(pointA, pointB) {
    const point1 = turf.point([pointA.longitude, pointA.latitude])
    const point2 = turf.point([pointB.longitude, pointB.latitude])
    const result = parseFloat(turf.bearing(point1, point2)) // 当前镜头与目标位角度
    return result
}

/**
 * @description: 根据起点和 yaw pitch 计算终点
 * @param {*} point
 * @param {*} heading
 * @param {*} action
 * @param {*} distance
 * @return {*}
 */
export function getEndPointByYawPitch(point, heading, action, distance) {
    const { scene } = viewer
    let position = new Cesium.Cartesian3.fromDegrees(
        point.longitude,
        point.latitude,
        point.altitude
    )
    const dir = getVector(
        {
            longitude: point.longitude,
            latitude: point.latitude,
            altitude: point.altitude
        },
        parseFloat(heading + action.yaw)
    )
    const forward_l = distance * Math.cos((action.pitch * Math.PI) / 180)
    position = translateByDirection(position, dir, forward_l)
    const y_offset = distance * Math.sin((action.pitch * Math.PI) / 180)
    const cartographic = scene.globe.ellipsoid.cartesianToCartographic(position)
    const lat = Cesium.Math.toDegrees(cartographic.latitude)
    const lon = Cesium.Math.toDegrees(cartographic.longitude)
    position = new Cesium.Cartesian3.fromDegrees(
        lon,
        lat,
        point.altitude - y_offset
    )
    return position
}

/**
 * @description: 切换到俯视
 * @param {*} position
 * @param {*} cb
 * @return {*}
 */
export function toOverlooking(position, cb) {
    viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(position.longitude, position.latitude, position.altitude),
        orientation: {
            heading: Cesium.Math.toRadians(0.0),
            pitch: Cesium.Math.toRadians(-90.0),
            roll: 0
        },
        duration: 1,
        complete: function (e) {
            if (cb) {
                cb()
            }
        }
    })
}

/**
 * @description: 顶点组成线段，并计算中点及距离
 * @param {*} array
 * @return {*}
 */
export function verticesToLines(array) {
    const result = []
    for (let index = 0; index < array.length; index++) {
        const element1 = array[index]
        const element2 = array[index + 1]
        const _distance = getTwoCartesianPointDistance(element1, element2)
        if (element1 && element2) {
            result.push({
                distance: _distance,
                center: getTwoCartesianPointCenter(element1, element2),
                start: element1,
                end: element2
            })
        }
    }
    return result
}

/**
 * @description: 数组前一项和后一项组成一个新数组（把航点两两组成线段，并计算线段的距离）
 * @param {*} array
 * @return {*}
 */
export function makeLineSegment(array) {
    const result = []
    for (let index = 0; index < array.length; index++) {
        const element1 = array[index]
        const element2 = array[index + 1]
        const _distance = getTwoPointDistance(element1, element2)
        if (element1 && element2) {
            result.push({
                distance: _distance,
                center: getTwoPointCenter(element1, element2),
                points: [element1, element2]
            })
        }
    }
    return result
}

/**
 * @description: 空间多点连线距离计算函数
 * @param {*} positions
 * @return {*}
 */
export function getSpaceDistance(positions) {
    let distance = 0
    for (let i = 0; i < positions.length - 1; i++) {
        const point1cartographic = Cesium.Cartographic.fromCartesian(positions[i])
        const point2cartographic = Cesium.Cartographic.fromCartesian(
            positions[i + 1]
        )
        const geodesic = new Cesium.EllipsoidGeodesic()
        geodesic.setEndPoints(point1cartographic, point2cartographic)
        const s = geodesic.surfaceDistance
        distance = distance + s
    }
    return distance.toFixed(2)
}

/**
 * @description: 验证经，纬，高度是否合法
 * @param {*} position
 * @return {Boolean}
 */
export function positionIsLegal(position) {
    const noZero = /^(([1-9]\d*)(\.\d+)?)$|^0\.\d*[1-9]$/
    const regLongitude = /^[\\-\\+]?(0?\d{1,2}(\.\d{1,15})*|1[0-7]?\d{1}(\.\d{1,15})*|180(\.0{1,15})*)$/
    const regLatitude = /^[\\-\\+]?([0-8]?\d{1}(\.\d{1,15})*|90(\.0{1,15})*)$/
    const regAltitude = /^(\-|\+)?\d+(\.\d+)?$/
    let result = false
    if (position.longitude === 0 && position.latitude === 0) {
        // ^ 初次添加的设备经纬度为 0，也需要加载出来，做位置打点
        result = true
    } else if (
        Object.hasOwnProperty.call(position, 'longitude') &&
        Object.hasOwnProperty.call(position, 'latitude') &&
        Object.hasOwnProperty.call(position, 'altitude')
    ) {
        const longitudeFlag = noZero.test(position.longitude) && regLongitude.test(position.longitude)
        const latitudeFlag = noZero.test(position.latitude) && regLatitude.test(position.latitude)
        const altitudeFlag = regAltitude.test(position.altitude)
        if (longitudeFlag && latitudeFlag && altitudeFlag) {
            result = true
        }
    } else if (Object.hasOwnProperty.call(position, 'longitude') &&
        Object.hasOwnProperty.call(position, 'latitude') &&
        !Object.hasOwnProperty.call(position, 'altitude')) {
        const longitudeFlag = noZero.test(position.longitude) && regLongitude.test(position.longitude)
        const latitudeFlag = noZero.test(position.latitude) && regLatitude.test(position.latitude)
        if (longitudeFlag && latitudeFlag) {
            result = true
        }
    }
    return result
}

/**
 * @description: 根据两个点（Cartesian3）找出中点
 * @param {*} pointA
 * @param {*} pointB
 * @return {*}
 */
export function getTwoCartesianPointCenter(pointA, pointB) {
    if (!pointA || !pointB) {
        return
    }
    const center = new Cesium.Cartesian3(
        (pointA.x + pointB.x) / 2,
        (pointA.y + pointB.y) / 2,
        (pointA.z + pointB.z) / 2
    )
    return center
}

/**
 * @description: 根据两个点找出中点
 * @param {*} pointA
 * @param {*} pointB
 * @return {*}
 */
export function getTwoPointCenter(pointA, pointB) {
    if (!pointA || !pointB) {
        return
    }
    const _pointA = Cesium.Cartesian3.fromDegrees(
        parseFloat(pointA.longitude),
        parseFloat(pointA.latitude),
        parseFloat(pointA.altitude)
    )
    const _pointB = Cesium.Cartesian3.fromDegrees(
        parseFloat(pointB.longitude),
        parseFloat(pointB.latitude),
        parseFloat(pointB.altitude)
    )
    const center = new Cesium.Cartesian3(
        parseFloat((_pointA.x + _pointB.x)) / 2,
        parseFloat((_pointA.y + _pointB.y)) / 2,
        parseFloat((_pointA.z + _pointB.z)) / 2
    )
    return cartesianToLongAndLat(center)
}

/**
 * @description: 计算两点（Cartesian3）距离
 * @param {*} pointA
 * @param {*} pointB
 * @return {*}
 */
export function getTwoCartesianPointDistance(pointA, pointB) {
    if (!pointA || !pointB) {
        return
    }
    const _distance = Cesium.Cartesian3.distance(
        pointA,
        pointB
    ).toFixed(2)
    return _distance
}

/**
 * @description: 计算两点距离
 * @param {*} pointA
 * @param {*} pointB
 * @return {*}
 */
export function getTwoPointDistance(pointA, pointB) {
    if (!pointA || !pointB) {
        return
    }
    const _distance = Cesium.Cartesian3.distance(
        Cesium.Cartesian3.fromDegrees(
            parseFloat(pointA.longitude),
            parseFloat(pointA.latitude),
            parseFloat(pointA.altitude)
        ),
        Cesium.Cartesian3.fromDegrees(
            parseFloat(pointB.longitude),
            parseFloat(pointB.latitude),
            parseFloat(pointB.altitude)
        )
    ).toFixed(2)
    return parseFloat(_distance)
}

/**
 * @description: 计算两点距离
 * @param {*} a Cartesian3
 * @param {*} b Cartesian3
 * @return {*}
 */
export function GetTwoPointDistance(a, b) {
    if (!a || !b) {
        return
    }
    const _distance = Cesium.Cartesian3.distance(a, b).toFixed(2)
    return _distance
}

/**
 * @description: 计算两点间中心位置
 * @param {*} a Cartesian3
 * @param {*} b Cartesian3
 * @return {*} Cartesian3
 */
export function getCenterPointByToPoint(a, b) {
    const center = new Cesium.Cartesian3(
        (a.x + b.x) / 2,
        (a.y + b.y) / 2,
        (a.z + b.z) / 2
    )
    return center
}

/**
 * @description: cartesian3 坐标转换为屏幕坐标
 * @param {*} position
 * @return {*}
 */
export function cartesian3ToWindowPosition(position) {
    const result = Cesium.SceneTransforms.wgs84ToWindowCoordinates(
        viewer.scene,
        position
    )
    return result
}

/**
 * @description: 经纬度转为笛卡尔坐标
 * @param {*} position
 * @return {*}
 */
export function positionToCartesian3(position) {
    const result = Cesium.Cartesian3.fromDegrees(position.longitude, position.latitude, position.altitude)
    return result
}

/**
 * @description: 经纬度转换为屏幕坐标
 * @param {*} position
 * @return {*}
 */
export function positionToWindowPosition(position) {
    const _position = Cesium.Cartesian3.fromDegrees(position.longitude, position.latitude, position.altitude)
    const result = Cesium.SceneTransforms.wgs84ToWindowCoordinates(
        viewer.scene,
        _position
    )
    return result
}

/**
 * @description: 计算向量
 * @param {*} point
 * @param {*} yaw
 * @return {*}
 */
export function getVector(point, yaw) {
    const A = new Cesium.Cartesian3.fromDegrees(
        parseFloat(point.longitude),
        parseFloat(point.latitude),
        parseFloat(point.altitude)
    )
    const B = new Cesium.Cartesian3.fromDegrees(
        parseFloat(point.longitude),
        parseFloat(point.latitude) + 0.0001,
        parseFloat(point.altitude)
    )

    // 计算B的地面法向量
    const chicB = Cesium.Cartographic.fromCartesian(B)
    chicB.height = 0
    const dB = Cesium.Cartographic.toCartesian(chicB)
    const normaB = Cesium.Cartesian3.normalize(
        Cesium.Cartesian3.subtract(dB, B, new Cesium.Cartesian3()),
        new Cesium.Cartesian3()
    )

    // 构造基于B的法向量旋转90度的矩阵
    const Q = Cesium.Quaternion.fromAxisAngle(normaB, Cesium.Math.toRadians(yaw))
    const m3 = Cesium.Matrix3.fromQuaternion(Q)
    const m4 = Cesium.Matrix4.fromRotationTranslation(m3)

    // 计算A点相对B点的坐标A1
    const A1 = Cesium.Cartesian3.subtract(B, A, new Cesium.Cartesian3())

    // 对A1应用旋转矩阵
    const p = Cesium.Matrix4.multiplyByPoint(m4, A1, new Cesium.Cartesian3())
    return p
}

/**
 * @description: 根据起点，方向和偏移计算终点
 * @param {*} point
 * @param {*} yaw
 * @return {*}
 */
export function translateByDirection(start, direction, offset) {
    const normalize = Cesium.Cartesian3.normalize(
        direction,
        new Cesium.Cartesian3()
    )

    // 根据偏移量求偏移向量
    const scalerNormalize = Cesium.Cartesian3.multiplyByScalar(
        normalize,
        offset,
        new Cesium.Cartesian3()
    )
    return Cesium.Cartesian3.add(start, scalerNormalize, new Cesium.Cartesian3())
}

/**
 * @description: 屏幕坐标转换成经纬坐标（地理坐标）
 * @param {*} position
 * @return {*}
 */
export function getGeographicPosition(position) {
    const ray1 = viewer.camera.getPickRay(position)
    const cartesian = viewer.scene.globe.pick(ray1, viewer.scene)
    if (!cartesian) {
        return
    }
    const pick = viewer.scene.pickPosition(position)
    if (pick) {
        const pickPosition = cartesianToLongAndLat(pick)
        return pickPosition
    }
}

// 坐标系转换
export function gausstoLogLat(x, y) {
    return CoordinateSystem.gausstoLogLat(x, y)
}

export function wgs84togcj02(longitude, latitude) {
    return CoordinateSystem.wgs84togcj02(longitude, latitude)
}

export function gcj02towgs84(longitude, latitude) {
    return CoordinateSystem.gcj02towgs84(longitude, latitude)
}