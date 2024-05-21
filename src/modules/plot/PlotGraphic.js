/* eslint-disable no-unused-vars */
// 标绘图形（塔加载）
import { decrypt, encrypt } from '@/utils/common/jsencrypt.js'
import tool from '@/utils/tool'
import {
  GetTerrainPosition,
  GetMouseEarthPosition,
  cartesianToLongAndLat
} from '../common'
import {
  DecryptPlotData,
  setEntityLabelText,
  formatGraphicLabelText
} from './common'
// import { opacityAnimate } from '../EntityAnimate'
import {
  getAreaDraw,
  getTowerData,
  getNoFlyZoneDataFun,
  getPlotDetailsById,
  getNoFlyZoneCheckByDrawArea
} from '@/utils/hushi/httpData'
import * as utils from '@/utils'
import store from '@/store'
import Vue from 'vue'
import {
  uniq,
  // findIndex,
  debounce,
  flattenDeep,
  cloneDeep,
  intersection,
  pullAll
} from 'lodash'
import {
  lineString,
  bbox,
  bboxPolygon,
  area,
  pointGrid
} from '@turf/turf'

let flyEntity = null
let highlightBaseEntity = null
let plotGraphicBaseEntity = null
let PlotPolylineCollection = null
let PlotPointCollection = null
let PlotLabelCollection = null
const entityIds = []
let noFlyZoneEntityIds = []
const usePrimitive = false
const primitivesObject = {}
const plotGraphicBasePrimitive = null
const firePointsObject = {} // 着火点图形集合

function addTextPrimitive(options) {
  const { id, position, text, font, colorValue, outline } = options
  const _fillColor = colorValue && colorValue.hex8 ? new Cesium.Color.fromCssColorString(colorValue.hex8) : new Cesium.Color.fromCssColorString('#fff')
  const _outlineColor = colorValue && colorValue.hex8 ? new Cesium.Color.fromCssColorString(colorValue.hex8) : new Cesium.Color.fromCssColorString('#000')
  if (PlotLabelCollection && PlotLabelCollection instanceof Cesium.LabelCollection) {
    PlotLabelCollection.add({
      id: id,
      position: Cesium.Cartesian3.fromDegrees(
        position.longitude,
        position.latitude,
        position.altitude
      ),
      text: text,
      font: font || '30px sans-serif',
      fillColor: _fillColor,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      outlineWidth: outline ? 2 : 0,
      outlineColor: _outlineColor,
      distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0.0, 30000.0),
      scaleByDistance: new Cesium.NearFarScalar(1.0e2, 0.6, 0.7e4, 0.5)
    })
  }
}

function addPointPrimitive(options) {
  const { id, position, colorValue } = options
  const _color = colorValue && colorValue.hex8 ? Cesium.Color.fromCssColorString(colorValue.hex8) : Cesium.Color.RED
  if (PlotPointCollection && PlotPointCollection instanceof Cesium.PointPrimitiveCollection) {
    PlotPointCollection.add({
      id: id,
      position: Cesium.Cartesian3.fromDegrees(
        position.longitude,
        position.latitude,
        position.altitude
      ),
      pixelSize: 20.0,
      color: _color,
      distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0.0, 30000.0),
      scaleByDistance: new Cesium.NearFarScalar(1.0e2, 0.6, 0.7e4, 0.5)
    })
  }
}

function addPolylinePrimitive(options) {
  const { id, positions, colorValue } = options
  const _color = colorValue ? Cesium.Color.fromCssColorString(colorValue.hex8) : Cesium.Color.fromCssColorString('#0000ff')
  if (PlotPolylineCollection && PlotPolylineCollection instanceof Cesium.PolylineCollection) {
    PlotPolylineCollection.add({
      id: id,
      positions: Cesium.Cartesian3.fromDegreesArrayHeights(positions),
      width: 5,
      material: Cesium.Material.fromType('Color', {
        color: _color
      }),
      distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0.0, 30000.0),
      scaleByDistance: new Cesium.NearFarScalar(1.0e2, 0.6, 0.7e4, 0.5)
    })
  }
}

function addPolygonPrimitive(options) {
  const { id, hierarchy, colorValue } = options
  const color = colorValue
    ? new Cesium.ColorGeometryInstanceAttribute.fromColor(
      Cesium.Color.fromCssColorString(colorValue.hex8)
    )
    : new Cesium.ColorGeometryInstanceAttribute.fromColor(
      Cesium.Color.fromCssColorString('#0000ff').withAlpha(0.4)
    )
  const instance = new Cesium.GeometryInstance({
    geometry: new Cesium.PolygonGeometry({
      polygonHierarchy: new Cesium.PolygonHierarchy(
        Cesium.Cartesian3.fromDegreesArrayHeights(hierarchy)
      ),
      perPositionHeight: true,
      closeTop: true,
      closeBottom: true,
      arcType: Cesium.ArcType.RHUMB,
      vertexFormat: Cesium.EllipsoidSurfaceAppearance.VERTEXT_FORMAT
    }),
    id: id,
    attributes: {
      color: color,
      show: new Cesium.ShowGeometryInstanceAttribute(true)
    }
  })

  // 多个 GeometryInstance 放在一个 GroundPrimitive 中会出现颜色覆盖的问题（在 Primitive 中正常）
  // if (plotGraphicBasePrimitive && plotGraphicBasePrimitive.geometryInstances) {
  //   plotGraphicBasePrimitive.geometryInstances.push(
  //     instance
  //   )
  // }

  // 一个 GroundPrimitive 放一个 GeometryInstance
  const primitive = new Cesium.GroundPrimitive({
    geometryInstances: [instance],
    appearance: new Cesium.PerInstanceColorAppearance({
      flat: true, // 当true时，片段着色中使用平面着色，这意味着不考虑照明。
      // translucent: true // 当true时，几何体将显示为半透明
      // closed: true
    })
  })
  primitivesObject[id] = primitive
  viewer.scene.primitives.add(primitive)
}

function addTextEntity(options) {
  const { id, position, text, font, colorValue, visible } = options
  if (alreadyExists(id)) {
    return
  }
  entityIds.push(id)
  const _font = font || '30px sans-serif'
  const _fillColor = colorValue && colorValue.hex8 ? new Cesium.Color.fromCssColorString(colorValue.hex8) : new Cesium.Color.fromCssColorString('#17E980')
  const entity = viewer.entities.add({
    id: id,
    name: 'plotGraphic',
    position: Cesium.Cartesian3.fromDegrees(position.longitude, position.latitude, position.altitude),
    parent: plotGraphicBaseEntity,
    label: {
      text: text,
      font: _font,
      fillColor: _fillColor,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0.0, 50000.0),
      scaleByDistance: new Cesium.NearFarScalar(1.0e2, 0.6, 0.7e4, 0.5),
      show: visible
    }
  })
  return entity
}

function addPointEntity(options) {
  const { id, position, label, colorValue, visible, firePoint } = options
  if (alreadyExists(id)) {
    return
  }
  entityIds.push(id)
  const pointColor = colorValue && colorValue.hex8 ? Cesium.Color.fromCssColorString(colorValue.hex8) : Cesium.Color.RED
  const entity = viewer.entities.add({
    id: id,
    name: 'plotGraphic',
    position: Cesium.Cartesian3.fromDegrees(position.longitude, position.latitude, position.altitude),
    parent: plotGraphicBaseEntity,
    point: {
      color: pointColor,
      // heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0.0, 50000.0),
      scaleByDistance: new Cesium.NearFarScalar(1.0e2, 1.0, 0.7e4, 0.8),
      pixelSize: 14,
      outlineWidth: 2,
      outlineColor: Cesium.Color.fromCssColorString('#fff'),
      show: visible
    },
    label: {
      text: label,
      font: '30px sans-serif',
      // pixelOffset: new Cesium.Cartesian2(0.0, 45.0),
      // heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      fillColor: Cesium.Color.fromCssColorString('#fff'),
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      outlineWidth: 2,
      outlineColor: Cesium.Color.fromCssColorString('#000'),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0.0, 50000.0),
      scaleByDistance: new Cesium.NearFarScalar(1.0e2, 0.6, 0.7e4, 0.5),
      show: visible
    }
  })
  if (firePoint) {
    // 着火点
    entity.point.show = false
    firePointsObject[id] = viewer.scene.primitives.add(new Cesium.ParticleSystem({
      image: './smoke.png',
      imageSize: new Cesium.Cartesian2(20, 20),
      startColor: new Cesium.Color(1, 0.6588235294117647, 0.07450980392156863, 1),
      endColor: new Cesium.Color(0, 0, 0, 0.1),
      startScale: 2.0,
      endScale: 5.0,
      particleLife: 1.0,
      speed: 5.0,
      emitter: new Cesium.CircleEmitter(0.8),
      modelMatrix: entity.computeModelMatrix(viewer.clock.startTime, new Cesium.Matrix4()),
      lifetime: 16.0,
      particleSize: 57,
      emissionRate: 21,
      emitterRadius: 4
    }))
  }
  return entity
}

function addPolylineLabelEntity(options) {
  const { id, position, label, visible } = options
  if (alreadyExists(id)) {
    return
  }
  entityIds.push(id)
  const entity = viewer.entities.add({
    id: id,
    name: 'plotGraphic',
    position: Cesium.Cartesian3.fromDegrees(position.longitude, position.latitude, position.altitude),
    parent: plotGraphicBaseEntity,
    label: {
      text: label,
      font: '30px sans-serif',
      // heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      fillColor: Cesium.Color.fromCssColorString('#fff'),
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      outlineWidth: 2,
      outlineColor: Cesium.Color.fromCssColorString('#000'),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0.0, 50000.0),
      scaleByDistance: new Cesium.NearFarScalar(1.0e2, 0.6, 0.7e4, 0.5),
      show: visible
    }
  })
  return entity
}

// function addVerticesEntity (options) {
//   const { id, list, colorValue, type } = options
//   if (list && list.length > 0) {
//     list.map((point, index) => {
//       const _id = `${id}_${type}_vertices_${index}`
//       if (alreadyExists(_id)) {
//         return
//       }
//       const pointColor = colorValue && colorValue.hex ? Cesium.Color.fromCssColorString(colorValue.hex) : Cesium.Color.RED
//       const entity = viewer.entities.add({
//         id: _id,
//         name: 'plotGraphic',
//         position: Cesium.Cartesian3.fromDegrees(point.longitude, point.latitude, point.altitude),
//         parent: plotGraphicBaseEntity,
//         point: {
//           color: pointColor,
//           // heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
//           distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0.0, 30000.0),
//           scaleByDistance: new Cesium.NearFarScalar(1.0e2, 1.0, 0.7e4, 0.8),
//           pixelSize: 14,
//           outlineWidth: 2,
//           outlineColor: Cesium.Color.fromCssColorString('#fff')
//         }
//       })
//       return entity
//     })
//   }
// }

function addPolygonWallEntity(options) {
  const { id, position, positions, colorValue, maximumHeights, minimumHeights, label, visible } = options
  if (alreadyExists(id)) {
    return
  }
  entityIds.push(id)
  const color = colorValue && colorValue.hex8 ? Cesium.Color.fromCssColorString(colorValue.hex8) : Cesium.Color.WHITE.withAlpha(0.6)
  const entity = viewer.entities.add({
    name: 'plotGraphic',
    id: id,
    parent: plotGraphicBaseEntity,
    position: Cesium.Cartesian3.fromDegrees(position.longitude, position.latitude, position.altitude),
    label: {
      text: label,
      font: '30px sans-serif',
      fillColor: Cesium.Color.fromCssColorString('#fff'),
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      outlineWidth: 2,
      outlineColor: Cesium.Color.fromCssColorString('#000'),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0.0, 50000.0),
      scaleByDistance: new Cesium.NearFarScalar(1.0e2, 0.6, 0.7e4, 0.5),
      show: false
    },
    wall: {
      positions: Cesium.Cartesian3.fromDegreesArray(positions),
      maximumHeights: maximumHeights,
      minimumHeights: minimumHeights,
      material: new Cesium.DynamicWallMaterialProperty({
        color: color,
        trailImage: require('@/assets/images/fence.png'),
        duration: 1000
      }),
      show: visible
    }
  })
  return entity
}

function addPolygonEntity(options, isNoFlyZone) {
  const { id, dynamicPositions, position, label, colorValue, visible, zIndex } = options
  if (alreadyExists(id)) {
    return
  }
  if (!isNoFlyZone) entityIds.push(id)
  if (isNoFlyZone) noFlyZoneEntityIds.push(id)
  const polygonColor = colorValue && colorValue.hex8 ? Cesium.Color.fromCssColorString(colorValue.hex8) : Cesium.Color.WHITE.withAlpha(0.6)
  const entity = viewer.entities.add({
    id: id,
    name: 'plotGraphic',
    position: Cesium.Cartesian3.fromDegrees(position.longitude, position.latitude, position.altitude),
    parent: plotGraphicBaseEntity,
    polygon: {
      // hierarchy: hierarchy,
      hierarchy: dynamicPositions,
      // extrudedHeight: 200,
      // perPositionHeight: true,
      // heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      zIndex: zIndex || 0,
      material: new Cesium.ColorMaterialProperty(
        polygonColor
      ),
      show: visible
    },
    label: {
      text: label,
      font: '30px sans-serif',
      fillColor: Cesium.Color.fromCssColorString('#fff'),
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      outlineWidth: 2,
      outlineColor: Cesium.Color.fromCssColorString('#000'),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      // heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      // eyeOffset: new Cesium.Cartesian3(0, 0, -10000),
      distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0.0, 50000.0),
      scaleByDistance: new Cesium.NearFarScalar(1.0e2, 0.6, 0.7e4, 0.5),
      show: visible
    }
  })
  return entity
}

function addPolylineEntity(options) {
  const { id, position, polyLinePositions, label, colorValue, visible } = options
  if (alreadyExists(id)) {
    return
  }
  entityIds.push(id)
  const _polylineColor = colorValue && colorValue.hex8 ? Cesium.Color.fromCssColorString(colorValue.hex8) : Cesium.Color.RED
  const entity = viewer.entities.add({
    id: id,
    name: 'plotGraphic',
    parent: plotGraphicBaseEntity,
    position: Cesium.Cartesian3.fromDegrees(position.longitude, position.latitude, position.altitude),
    polyline: {
      // heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      positions: polyLinePositions,
      material: _polylineColor,
      depthFailMaterial: new Cesium.PolylineDashMaterialProperty({
        _polylineColor
      }),
      width: 5,
      show: visible
    },
    label: {
      text: label,
      font: '30px sans-serif',
      fillColor: Cesium.Color.fromCssColorString('#fff'),
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      outlineWidth: 2,
      outlineColor: Cesium.Color.fromCssColorString('#000'),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0.0, 50000.0),
      scaleByDistance: new Cesium.NearFarScalar(1.0e2, 0.6, 0.7e4, 0.5),
      show: visible
    }
  })
  return entity
}

function alreadyExists(id) {
  if (viewer.entities.getById(id)) {
    return true
  } else {
    return false
  }
}

function addTextGraphic(options) {
  const { id, data, plotName, visible } = options
  if (usePrimitive) {
    addTextPrimitive({
      id: `${id}_plotText`,
      position: data.centerPoint,
      text: formatGraphicLabelText('text', {
        name: plotName
      }),
      font: data.labelFont,
      colorValue: data.colorValue
    })
  } else {
    addTextEntity({
      id: `${id}_plotText`,
      position: data.centerPoint,
      text: formatGraphicLabelText('text', {
        name: plotName
      }),
      font: data.labelFont,
      colorValue: data.colorValue,
      visible
    })
  }
}

function addPointGraphic(options) {
  const { id, data, plotName, visible } = options
  const currentPlotId = store.state.plotting.currentPlotId
  let text = ''
  if (id === currentPlotId) {
    text = formatGraphicLabelText('point', {
      name: plotName,
      longitude: data.centerPoint.longitude,
      latitude: data.centerPoint.latitude,
      altitude: data.centerPoint.altitude
    })
  } else {
    text = formatGraphicLabelText('point', {
      name: plotName
    })
  }
  if (usePrimitive) {
    addPointPrimitive({
      id: `${id}_plotPoint`,
      position: data.centerPoint,
      colorValue: data.colorValue
    })
    addTextPrimitive({
      id: `${id}_plotPoint_label`,
      position: data.centerPoint,
      text: formatGraphicLabelText('point', {
        name: plotName
      }),
      outline: true
    })
  } else {
    addPointEntity({
      id: `${id}_plotPoint`,
      position: data.centerPoint,
      label: text,
      colorValue: data.colorValue,
      visible,
      firePoint: data.firePoint
    })
  }
}

function addPolylineGraphic(options) {
  const { id, data, plotName, index, visible } = options
  const currentPlotId = store.state.plotting.currentPlotId
  let text = ''
  if (id === currentPlotId) {
    text = formatGraphicLabelText('polyline', {
      name: plotName,
      value: data.activeShapeComputed
    })
  } else {
    text = formatGraphicLabelText('polyline', {
      name: plotName
    })
  }
  if (usePrimitive) {
    const positions = []
    if (data && data.activeShapePoints && data.activeShapePoints.length > 0) {
      data.activeShapePoints.map((point) => {
        positions.push(point.longitude)
        positions.push(point.latitude)
        positions.push(point.altitude)
      })
      addPolylinePrimitive({
        id: `${id}_plotPolyline`,
        positions,
        colorValue: data.colorValue
      })
    }
    addTextPrimitive({
      id: `${id}_plotPolyline_label`,
      position: data.centerPoint,
      text: formatGraphicLabelText('polyline', {
        name: plotName
      }),
      outline: true
    })
    if (data.activeSubLine && data.activeSubLine.length > 0) {
      data.activeSubLine.map((line, lineIndex) => {
        addTextPrimitive({
          id: `${id}_plotPolyline_label_${lineIndex}`,
          position: line.centerPoint,
          text: formatGraphicLabelText('polyline', {
            name: ''
          }),
          outline: true
        })
      })
    }
  } else {
    addPolylineLabelEntity({
      id: `${id}_plotPolyline`,
      position: data.centerPoint,
      label: text,
      visible
    })
    // addVerticesEntity({
    //   id: id,
    //   list: data.verticesPosition || data.activeShapePoints,
    //   colorValue: data.colorValue,
    //   type: 'plotPolyline'
    // })
    if (data.activeSubLine && data.activeSubLine.length > 0) {
      data.activeSubLine.map((line, lineIndex) => {
        const positions = Cesium.Cartesian3.fromDegreesArrayHeights(
          [
            line.start.longitude, line.start.latitude, line.start.altitude,
            line.end.longitude, line.end.latitude, line.end.altitude
          ]
        )
        let lineText = ''
        if (id === currentPlotId) {
          lineText = formatGraphicLabelText('polyline', {
            subValue: line.distance
          })
        }
        addPolylineEntity({
          id: `${id}_plotPolyline_${lineIndex}`,
          position: line.centerPoint,
          polyLinePositions: positions,
          label: lineText,
          colorValue: data.colorValue,
          zIndex: index,
          visible
        })
      })
    }
  }
}

function addPolygonGraphic(options, isNoFlyZone) {
  const { id, data, plotName, index, visible } = options
  const currentPlotId = store.state.plotting.currentPlotId
  let text = ''
  if (id === currentPlotId) {
    text = formatGraphicLabelText('polygon', {
      name: plotName,
      value: data.activeShapeComputed
    })
  } else {
    text = formatGraphicLabelText('polygon', {
      name: plotName
    })
  }
  const vertices = data.verticesPosition || data.activeShapePoints || []
  const _hierarchy = []
  const _wallPositions = []
  const _minimumHeights = []
  if (vertices.length > 0) {
    for (let index = 0; index < vertices.length; index++) {
      const point = vertices[index]
      if (usePrimitive) {
        _hierarchy.push(point.longitude)
        _hierarchy.push(point.latitude)
        _hierarchy.push(point.altitude)
      } else {
        _hierarchy.push(Cesium.Cartesian3.fromDegrees(
          point.longitude,
          point.latitude,
          point.altitude
        ))
        _wallPositions.push(point.longitude)
        _wallPositions.push(point.latitude)
        _minimumHeights.push(point.altitude)
      }
    }
    _wallPositions.push(vertices[0].longitude)
    _wallPositions.push(vertices[0].latitude)
    _minimumHeights.push(vertices[0].altitude)
  }
  if (_hierarchy.length > 0) {
    if (usePrimitive) {
      addPolygonPrimitive({
        id: `${id}_plotPolygon`,
        hierarchy: _hierarchy,
        colorValue: data.colorValue
      })
      addTextPrimitive({
        id: `${id}_plotPolygon_label`,
        position: data.centerPoint,
        text: formatGraphicLabelText('polygon', {
          name: plotName
        }),
        outline: true
      })
    } else {
      if (data.plotClass === 'scenicSpot') {
        // 文旅，景区标注
        const baseHeight = 20
        const maximumHeights = _minimumHeights.map(_ => _ + baseHeight)
        addPolygonWallEntity({
          id: `${id}_scenicSpotPlotWall`,
          position: data.centerPoint,
          positions: _wallPositions,
          maximumHeights: maximumHeights,
          minimumHeights: _minimumHeights,
          label: text,
          colorValue: data.colorValue,
          zIndex: index,
          visible
        })
      } else {
        const dynamicPositions = new Cesium.CallbackProperty(function () {
          return new Cesium.PolygonHierarchy(_hierarchy)
        }, false) // 使贴地多边形在模型上有立体效果
        const center = data.centerPoint
        const max = _minimumHeights.sort()[_minimumHeights.length - 1] || data.centerPoint.altitude || 0
        center.altitude = max
        addPolygonEntity({
          id: `${id}_plotPolygon`,
          hierarchy: _hierarchy,
          dynamicPositions: dynamicPositions,
          position: center,
          label: text,
          colorValue: data.colorValue,
          zIndex: index,
          visible
        }, isNoFlyZone)
        // addVerticesEntity({
        //   id: id,
        //   list: data.verticesPosition || data.activeShapePoints,
        //   colorValue: data.colorValue,
        //   type: 'plotPolygon'
        // })
      }
    }
  }
}

function clearPlotGraphicBasePrimitive() {
  if (plotGraphicBasePrimitive) {
    viewer.scene.primitives.remove(plotGraphicBasePrimitive)
  }
  for (const key in primitivesObject) {
    if (Object.hasOwnProperty.call(primitivesObject, key)) {
      const primitive = primitivesObject[key]
      viewer.scene.primitives.remove(primitive)
    }
  }
  if (PlotPolylineCollection) {
    PlotPolylineCollection.removeAll()
    viewer.scene.primitives.remove(PlotPolylineCollection)
  }
  if (PlotPointCollection) {
    PlotPointCollection.removeAll()
    viewer.scene.primitives.remove(PlotPointCollection)
  }
  if (PlotLabelCollection) {
    PlotLabelCollection.removeAll()
    viewer.scene.primitives.remove(PlotLabelCollection)
  }
}

function addPlotGraphicBasePrimitive() {
  // plotGraphicBasePrimitive = new Cesium.GroundPrimitive({
  //   geometryInstances: [],
  //   appearance: new Cesium.PerInstanceColorAppearance({
  //     flat: true, // 当true时，片段着色中使用平面着色，这意味着不考虑照明。
  //     translucent: true // 当true时，几何体将显示为半透明
  //     // closed: true
  //   })
  // })
  // viewer.scene.primitives.add(plotGraphicBasePrimitive)
  PlotPolylineCollection = new Cesium.PolylineCollection()
  viewer.scene.primitives.add(PlotPolylineCollection)
  PlotPointCollection = new Cesium.PointPrimitiveCollection()
  viewer.scene.primitives.add(PlotPointCollection)
  PlotLabelCollection = new Cesium.LabelCollection()
  viewer.scene.primitives.add(PlotLabelCollection)
}

function addPlotGraphicBaseEntity() {
  if (!plotGraphicBaseEntity) {
    viewer.entities.remove(viewer.entities.getById('plotGraphicBaseEntity'))
    plotGraphicBaseEntity = new Cesium.Entity({
      id: 'plotGraphicBaseEntity',
      show: true
    })
    viewer.entities.add(plotGraphicBaseEntity)
  }
}

function addHighlightBaseEntity() {
  if (!highlightBaseEntity) {
    viewer.entities.remove(viewer.entities.getById('highlightBaseEntity'))
    highlightBaseEntity = new Cesium.Entity({
      id: 'highlightBaseEntity',
      show: true
    })
    viewer.entities.add(highlightBaseEntity)
  }
}

async function getPlotDataById(id, flag) {
  if (!id) return
  const data = await getPlotDetailsById({
    id: id
  })
  if (data) {
    return DecryptPlotData(data)
  }
}

// 淹没分析
export async function FloodAnalysis(id, status) {
  if (id) {
    const _data = await getPlotDataById(id)
    if (!data) {
      return
    }
    const _entitiesIds = uniq(entityIds).filter(_ =>
      _.indexOf(id) > -1
    )
    if (_entitiesIds && _entitiesIds.length > 0) {
      _entitiesIds.map(id => {
        const entity = viewer.entities.getById(id)
        if (entity && entity instanceof Cesium.Entity) {
          if (entity.id.indexOf('plotPolygon') > -1) {
            if (entity.polygon) {
              const positions = entity.polygon.hierarchy.getValue(Cesium.JulianDate.now()).positions
              buildPolygonGrid(entity, positions, status, _data)
            }
          }
        }
      })
    }
  }
}

// 创建 polygon 外接矩形，并生成点格网，返回所有格网点坐标
function buildPolygonGrid(entity, positions, status, data) {
  const tempPoints = []
  for (let i = 0; i < positions.length; i++) {
    const cartographic = viewer.scene.globe.ellipsoid.cartesianToCartographic(positions[i])
    const lat = Cesium.Math.toDegrees(cartographic.latitude)
    const lng = Cesium.Math.toDegrees(cartographic.longitude)
    tempPoints.push([lng, lat])
  }
  // 生成外接矩形
  const line = lineString(tempPoints)
  const _bbox = bbox(line)
  const _bboxPolygon = bboxPolygon(_bbox)
  const _area = area(_bboxPolygon)
  // 生成格网
  // 计算网格点之间的距离，尽量保证范围内有1万个左右格网点。
  const cellSide = Math.sqrt(_area / 1000000) / 100
  const options = { units: 'kilometers' }
  const grid = pointGrid(_bbox, cellSide, options)
  const gridPositions = []
  grid.features.forEach(f => {
    gridPositions.push(Cesium.Cartographic.fromDegrees(f.geometry.coordinates[0], f.geometry.coordinates[1]))
  })
  const promise = Cesium.sampleTerrainMostDetailed(terrain, gridPositions)
  let maxHeight = 0
  let minHeight = 10000.0
  Promise.resolve(promise).then(function (updatedPositions) {
    for (let i = 0; i < updatedPositions.length; i++) {
      const height = updatedPositions[i].height
      // 获取格网点处地形高度
      minHeight = height < minHeight ? height : minHeight
      maxHeight = height > maxHeight ? height : maxHeight
    }
    const value = {
      minHeight, maxHeight
    }
    let waterHeight = value.minHeight
    const targertWaterHeight = value.maxHeight
    if (status) {
      entity.polygon.perPositionHeight = true
      entity.polygon.material = new Cesium.Color.fromBytes(64, 157, 253, 150)
      entity.polygon.extrudedHeight = new Cesium.CallbackProperty(function () {
        waterHeight += 0.5
        if (waterHeight > targertWaterHeight) {
          waterHeight = targertWaterHeight
        }
        return waterHeight
      }, false)
    } else {
      entity.polygon.perPositionHeight = false
      entity.polygon.material = new Cesium.ColorMaterialProperty(
        data.objectInfo.colorValue && data.objectInfo.colorValue.hex8 ? Cesium.Color.fromCssColorString(data.objectInfo.colorValue.hex8) : Cesium.Color.WHITE.withAlpha(0.6)
      )
      delete entity.polygon.extrudedHeight
    }
    return value
  })
}

// 切换播放景区标注音频文件
export async function HandleScenicSpotAudio(data) {
  const id = store.state.rocker.currentScenicSpot
  id === data.id ? store.commit('rocker/updateCurrentScenicSpot', '')
    : store.commit('rocker/updateCurrentScenicSpot', data.id)
  const _id = store.state.rocker.currentScenicSpot
  const _data = await getPlotDataById(_id)
  const audioDom = document.getElementById('plotAudio')
  const bgAudioDom = document.getElementById('rockerBgAudio')
  audioDom.addEventListener('ended', function () {
    store.commit('rocker/updateCurrentScenicSpot', '')
    bgAudioDom.volume = 1
  })
  bgAudioDom.volume = 1
  audioDom.pause()
  if (_data && _data.objectInfo && _data.objectInfo.audioData && _data.objectInfo.audioData.url) {
    setTimeout(() => {
      audioDom.src = _data.objectInfo.audioData.url
      audioDom.play()
      bgAudioDom.volume = 0.2
    })
  }
}

// hushiCesiumClick 选中标绘图形
export async function ClickPlotGraphic(id, cockpitOpen, movement) {
  const _startPointSetting = store.state.plotting.startPointSetting
  const _rockerVisible = store.state.rocker.visible
  if (!id || _startPointSetting) return
  if (movement) {
    // 航线规划高度范围设置（最小值为点击处所拾取到的海拔值）
    let earthPosition = null
    try {
      earthPosition = GetMouseEarthPosition(movement.position).earthPosition
    } catch (error) {
      console.log(error)
    }
    if (earthPosition) {
      const _position = cartesianToLongAndLat(earthPosition)
      const _height = _position.altitude > 0 ? _position.altitude : 0
      store.commit('plotting/updateParamsHeight', _height)
    }
  }

  // const _graphic_id = id.split('_')[0]
  // const graphicData = await getPlotDataById(parseFloat(_graphic_id), 'ClickPlotGraphic')
  // let isNoFlyZone = false
  // if (graphicData && graphicData.objectInfo && graphicData.objectInfo.plotClassValue == 9) {
  //   isNoFlyZone = true
  // }
  // if (isNoFlyZone) return

  const _plottingStatus = store.state.plotting.editStatus
  if (_plottingStatus) {
    // 编辑状态， 禁止对标绘进行高亮，生成航线操作
    return
  }
  if (
    (
      id.indexOf('_plotPoint') > -1 ||
      id.indexOf('_plotPolyline') > -1 ||
      id.indexOf('_plotPolygon') > -1 ||
      id.indexOf('_plotText') > -1 ||
      id.indexOf('_plotHighlightGraphic') > -1
    )
  ) {
    const _id = id.split('_')[0]
    const _data = await getPlotDataById(parseFloat(_id), 'ClickPlotGraphic')
    if (!_data) {
      return
    }
    if (id.indexOf('_plot') > -1) {
      // 仅点击标绘实体，更新 id
      store.commit('plotting/updateClickFromMap', true)
      store.state.plotting.currentPlotId === parseInt(_id)
        ? store.commit('plotting/updateCurrentPlotId', '')
        : store.commit('plotting/updateCurrentPlotId', parseInt(_id))
      if (store.state.plotting.currentPlotId) {
        store.commit('plotting/updateCurrentPlotData', _data)
      } else {
        store.commit('plotting/updateCurrentPlotData', null)
      }
    }

    if (id.indexOf('_plotText') > -1) {
      return
    }
    if (cockpitOpen && !store.state.plotting.status && !_rockerVisible) {
      const _entitiesIds = uniq(entityIds).filter(_ =>
        _.indexOf(_id) > -1
      )
      if (_entitiesIds && _entitiesIds.length > 0) {
        const firstId = _entitiesIds[0]
        const _entity = viewer.entities.getById(firstId)
        if (_entity && _entity instanceof Cesium.Entity) {
          const _graphic_id = id.split('_')[0]
          const graphicData = await getPlotDataById(parseFloat(_graphic_id), 'ClickPlotGraphic')
          let isNoFlyZone = false
          if (graphicData && graphicData.objectInfo && graphicData.objectInfo.plotClassValue == 9) {
            isNoFlyZone = true
          }
          if (isNoFlyZone) return

          const reqBody = {}
          reqBody.latLngs = _data.objectInfo && _data.objectInfo.verticesPosition ? _data.objectInfo.verticesPosition.map(item => {
            return [Number(item.latitude.toFixed(7)) + 90, Number(item.longitude.toFixed(7)) + 180]
          }) : []
          let notAllowFly = false
          await getNoFlyZoneCheckByDrawArea(reqBody).then(res => {
            notAllowFly = res
            if (res) {
              // 检测到 与 禁飞区相交或者包含
              ClearHighlightGraphic()
              Vue.prototype.$confirm(
                Vue.prototype.$language('droneControl.noFlyZoneDetectedRerouteTip'),
                '提示',
                {
                  confirmButtonText: Vue.prototype.$language('confirm'),
                  closeOnClickModal: false,
                  showClose: false,
                  showCancelButton: false,
                  dangerouslyUseHTMLString: true,
                  type: 'warning',
                }
              ).then(() => { }).catch(() => { })
            }
          })
          if (notAllowFly) return

          // 非绘制状态且是启动界面，才能获取航线
          if (_data.objectInfo && (_data.objectInfo.verticesPosition || _data.objectInfo.activeShapePoints)) {
            store.commit('plotting/updateVerticesData', {})
            const vertices = _data.objectInfo.verticesPosition || _data.objectInfo.activeShapePoints
            const type = _data.objectInfo.drawingMode
            const _obj = cloneDeep({
              type,
              vertices
            })
            if (store.state.plotting.currentPlotId) {
              const heights = vertices.map(_ => _.altitude)
              const max = heights.sort()[heights.length - 1]
              store.commit('plotting/updateParamsHeight', max)
              store.commit('plotting/updateVerticesData', _obj)
            }
          }
        }
      }
    }
  }
}

export function SetHighlightGraphicVisible(visible) {
  if (highlightBaseEntity && highlightBaseEntity._children && highlightBaseEntity._children.length > 0) {
    highlightBaseEntity._children.map((entity) => {
      if (entity) {
        entity.show = visible
      }
    })
  }
}

export function ClearHighlightGraphic() {
  if (highlightBaseEntity) {
    if (highlightBaseEntity._children && highlightBaseEntity._children.length > 0) {
      highlightBaseEntity._children.map((entity) => {
        if (entity) {
          viewer.entities.remove(entity)
        }
      })
    }
  }
}

export function ClearHighlightGraphic2() {
  viewer.entities.remove(viewer.entities.getById('plotHighlightGraphicTravel'))
}

export function AddHighlightGraphic2() {
  ClearHighlightGraphic2
  addHighlightWallEntity({
    id: 'plotHighlightGraphicTravel',
    positions: [
      117.7158586,
      39.1077548,
      117.7180225,
      39.1089694,
      117.7200969,
      39.1077407,
      117.7167689,
      39.1045799,
      117.7143602,
      39.10514,
      117.7158586,
      39.1077548,
    ],
    minimumHeights: [
      -6,
      -6,
      -6,
      -6,
      -6,
      -6
    ],
    maximumHeights: [
      20,
      20,
      30,
      30,
      30,
      30
    ],
    parent: highlightBaseEntity,
    // color: '#FCB71880'
    color: '#20E8E980'
  }) // 北塘古镇

  // addHighlightWallEntity({
  //   id: 'plotHighlightGraphicTravel',
  //   positions: [
  //     117.71430729999997,
  //     39.0785898,
  //     117.71398120000003,
  //     39.077950799999996,
  //     117.7148249,
  //     39.077757399999996,
  //     117.71517560000001,
  //     39.0783878,
  //     117.71430729999997,
  //     39.0785898
  //   ],
  //   minimumHeights: [
  //     -6,
  //     -6,
  //     -6,
  //     -6,
  //     -6
  //   ],
  //   maximumHeights: [
  //     10,
  //     10,
  //     10,
  //     10,
  //     10
  //   ],
  //   // color: '#FCB71880'
  //   color: '#20E8E980'
  // })
}

export async function AddHighlightGraphic(currentPlot) {
  // 实体高亮效果
  // 用顶点数据，生成距各顶点指定距离的外围点，绘制 wall，加动画效果
  ClearHighlightGraphic()
  const data = currentPlot
  if (!currentPlot || !currentPlot.id || !data || !data.objectInfo) return
  const verticesPosition = data.objectInfo.verticesPosition || data.objectInfo.activeShapePoints
  if (!verticesPosition || verticesPosition.length <= 0 || verticesPosition.length > 100) return
  const baseHeight = 10
  const positions = []
  const minimumHeights = []
  verticesPosition.map(item => {
    positions.push(item.longitude)
    positions.push(item.latitude)
    minimumHeights.push(item.altitude)
  })
  addHighlightBaseEntity()
  if (data.objectInfo.drawingMode === 'polygon') {
    GetTerrainPosition({
      longitude: verticesPosition[0].longitude,
      latitude: verticesPosition[0].latitude,
      altitude: verticesPosition[0].altitude,
    }, async position => {
      if (position.altitude <= 0 || verticesPosition.length > 10) {
        // 方式一：使用顶点（关闭高程地形或未检测到高程）
        positions.push(verticesPosition[0].longitude)
        positions.push(verticesPosition[0].latitude)
        minimumHeights.push(verticesPosition[0].altitude)
        const maximumHeights = minimumHeights.map(_ => _ + baseHeight)
        viewer.entities.removeById(currentPlot.id + '_plotHighlightGraphic')
        addHighlightWallEntity({
          id: currentPlot.id + '_plotHighlightGraphic',
          positions: positions,
          minimumHeights: minimumHeights,
          maximumHeights: maximumHeights,
          parent: highlightBaseEntity,
          color: data.objectInfo.colorValue.hex8
        })
      } else {
        // 方式二：开启高程地形
        // 用 sampleTerrainMostDetailed 在每条边上生成若干个点，绘制 wall，实现高低起伏的效果
        const res = await calculateHeightByTerrain(verticesPosition)
        if (!res || res <= 0) return
        const positions = []
        const _res = flattenDeep(res)
        _res.map(point => {
          positions.push(point.longitude)
          positions.push(point.latitude)
        })
        const minimumHeights = _res.map(_ => _.altitude)
        const maximumHeights = minimumHeights.map(_ => _ + baseHeight)
        viewer.entities.removeById(currentPlot.id + '_plotHighlightGraphic')
        addHighlightWallEntity({
          id: currentPlot.id + '_plotHighlightGraphic',
          positions: positions,
          minimumHeights: minimumHeights,
          maximumHeights: maximumHeights,
          parent: highlightBaseEntity,
          color: data.objectInfo.colorValue.hex8
        })
      }
    })
  } else {
    const maximumHeights = minimumHeights.map(_ => _ + baseHeight)
    viewer.entities.removeById(currentPlot.id + '_plotHighlightGraphic')
    addHighlightWallEntity({
      id: currentPlot.id + '_plotHighlightGraphic',
      positions: positions,
      minimumHeights: minimumHeights,
      maximumHeights: maximumHeights,
      parent: highlightBaseEntity,
      color: data.objectInfo.colorValue.hex8
    })
  }
}

/**
 * 根据经纬度，利用api Cesium.sampleTerrainMostDetailed,精确计算经纬度对应的海拔高度
 * @returns {Promise}
 * @param verticesPosition  数据格式：[{longitude:118,latitude:38,altitude:100}]
 * @param interpolationNum  经纬度插值数量
 */
export function calculateHeightByTerrain(verticesPosition, interpolationNum = 100) {
  const lineArray = []
  for (let index = 0; index < verticesPosition.length; index++) {
    const element1 = verticesPosition[index]
    const element2 = verticesPosition[index + 1]
    if (element1 && element2) {
      lineArray.push([element1, element2])
    }
  }
  lineArray.push([verticesPosition[verticesPosition.length - 1], verticesPosition[0]])
  return Promise.all(
    lineArray.map(point => {
      return new Promise(resolve => {
        const start = Cesium.Cartesian3.fromDegrees(
          point[0].longitude,
          point[0].latitude,
          point[0].altitude
        )
        const end = Cesium.Cartesian3.fromDegrees(
          point[1].longitude,
          point[1].latitude,
          point[1].altitude
        )
        const positions2 = [Cesium.Cartographic.fromCartesian(start)]
        const count = interpolationNum
        for (let i = 1; i < count; i++) {
          const cart = Cesium.Cartesian3.lerp(
            start,
            end,
            i / count,
            new Cesium.Cartesian3()
          )
          positions2.push(Cesium.Cartographic.fromCartesian(cart))
        }
        positions2.push(Cesium.Cartographic.fromCartesian(end))
        if (!terrain) return
        const promise = Cesium.sampleTerrainMostDetailed(
          terrain,
          positions2
        )
        Promise.resolve(promise).then(function (updatedPositions) {
          const result = updatedPositions.map(_ => {
            return {
              longitude: Cesium.Math.toDegrees(_.longitude),
              latitude: Cesium.Math.toDegrees(_.latitude),
              altitude: _.height
            }
          })
          resolve(result)
        })
      })
    })
  )
}

function addHighlightWallEntity(options) {
  const { id, positions, maximumHeights, minimumHeights, color, parent } = options
  viewer.entities.add({
    name: 'plotGraphic',
    id: id,
    parent: parent,
    wall: {
      positions: Cesium.Cartesian3.fromDegreesArray(positions),
      maximumHeights: maximumHeights,
      minimumHeights: minimumHeights,
      // disableDepthTestDistance: Number.POSITIVE_INFINITY,
      // heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      material: new Cesium.DynamicWallMaterialProperty({
        color: Cesium.Color.fromCssColorString(color),
        trailImage: require('@/assets/images/fence.png'),
        duration: 1000
      })
    }
  })
}

function handleSetPrimitiveLabelValue(graphic, data, type, flag) {
  let text = ''
  if (flag && flag === 'reset') {
    if (type === 'plotPoint') {
      text = formatGraphicLabelText('point', {
        name: data.towerName
      })
    } else if (type === 'plotPolyline') {
      if (graphic.id.split('_').length === 3) {
        text = formatGraphicLabelText('polyline', {
          name: data.towerName
        })
      } else {
        text = ``
      }
    } else if (type === 'plotPolygon') {
      text = formatGraphicLabelText('polygon', {
        name: data.towerName
      })
    }
  } else {
    if (type === 'plotPoint') {
      text = formatGraphicLabelText('point', {
        name: data.towerName,
        longitude: data.objectInfo.centerPoint.longitude,
        latitude: data.objectInfo.centerPoint.latitude,
        altitude: data.objectInfo.centerPoint.altitude
      })
    } else if (type === 'plotPolyline') {
      if (graphic.id.split('_').length === 3) {
        text = formatGraphicLabelText('polyline', {
          name: data.towerName,
          value: data.objectInfo.activeShapeComputed
        })
      } else if (graphic.id.split('_').length === 4) {
        const list = graphic.id.split('_')
        const index = list[list.length - 1]
        if (index > -1) {
          text = formatGraphicLabelText('polyline', {
            subValue: data.objectInfo.activeSubLine[index].distance
          })
        }
      }
    } else if (type === 'plotPolygon') {
      text = formatGraphicLabelText('polygon', {
        name: data.towerName,
        value: data.objectInfo.activeShapeComputed
      })
    }
  }
  graphic.text = text
}

function handleSetEntityLabelValue(entity, data, type, flag) {
  let text = ''
  if (flag && flag === 'reset') {
    if (type === 'plotPoint') {
      text = formatGraphicLabelText('point', {
        name: data.towerName
      })
    } else if (type === 'plotPolyline') {
      if (entity.id.split('_').length === 2) {
        text = formatGraphicLabelText('polyline', {
          name: data.towerName
        })
      } else {
        text = ``
      }
    } else if (type === 'plotPolygon') {
      text = formatGraphicLabelText('polygon', {
        name: data.towerName
      })
    }
  } else {
    if (type === 'plotPoint') {
      text = formatGraphicLabelText('point', {
        name: data.towerName,
        longitude: data.objectInfo.centerPoint.longitude,
        latitude: data.objectInfo.centerPoint.latitude,
        altitude: data.objectInfo.centerPoint.altitude
      })
    } else if (type === 'plotPolyline') {
      if (entity.id.split('_').length === 2) {
        text = formatGraphicLabelText('polyline', {
          name: data.towerName,
          value: data.objectInfo.activeShapeComputed
        })
      } else if (entity.id.split('_').length === 3) {
        const list = entity.id.split('_')
        const index = list[list.length - 1]
        if (index > -1) {
          text = formatGraphicLabelText('polyline', {
            subValue: data.objectInfo.activeSubLine[index].distance
          })
        }
      }
    } else if (type === 'plotPolygon') {
      text = formatGraphicLabelText('polygon', {
        name: data.towerName,
        value: data.objectInfo.activeShapeComputed
      })
    }
  }
  setEntityLabelText(entity, text)
}

export async function SetGraphicLabelValueComplete(currentPlot, oldPlot) {
  const labels = PlotLabelCollection && PlotLabelCollection._labels && PlotLabelCollection._labels.length > 0 ? PlotLabelCollection._labels : []
  if (currentPlot && currentPlot.id) {
    if (usePrimitive) {
      const _labels = labels.filter(_ =>
        _.id.indexOf(currentPlot.id) > -1
      )
      if (_labels.length > 0) {
        _labels.map(label => {
          let type = ''
          if (label.id.indexOf('plotPoint') > -1) {
            type = 'plotPoint'
          } else if (label.id.indexOf('plotPolyline') > -1) {
            type = 'plotPolyline'
          } else if (label.id.indexOf('plotPolygon') > -1) {
            type = 'plotPolygon'
          }
          if (type) {
            handleSetPrimitiveLabelValue(label, currentPlot, type)
          }
        })
      }
    } else {
      const _entitiesIds = uniq(entityIds).filter(_ =>
        _.indexOf(currentPlot.id) > -1
      )
      if (_entitiesIds && _entitiesIds.length > 0) {
        _entitiesIds.map(id => {
          const entity = viewer.entities.getById(id)
          if (entity) {
            let type = ''
            if (id.indexOf('plotPoint') > -1) {
              type = 'plotPoint'
            } else if (id.indexOf('plotPolyline') > -1) {
              type = 'plotPolyline'
            } else if (id.indexOf('plotPolygon') > -1) {
              type = 'plotPolygon'
            }
            if (type) {
              handleSetEntityLabelValue(entity, currentPlot, type)
            }
          }
        })
      }
    }
  }
  if (oldPlot && oldPlot.id) {
    if (usePrimitive) {
      const _labels = labels.filter(_ =>
        _.id.indexOf(oldPlot.id) > -1
      )
      if (_labels.length > 0) {
        _labels.map(label => {
          let type = ''
          if (label.id.indexOf('plotPoint') > -1) {
            type = 'plotPoint'
          } else if (label.id.indexOf('plotPolyline') > -1) {
            type = 'plotPolyline'
          } else if (label.id.indexOf('plotPolygon') > -1) {
            type = 'plotPolygon'
          }
          if (type) {
            handleSetPrimitiveLabelValue(label, oldPlot, type, 'reset')
          }
        })
      }
    } else {
      const _entitiesIds = uniq(entityIds).filter(_ =>
        _.indexOf(oldPlot.id) > -1
      )
      if (_entitiesIds && _entitiesIds.length > 0) {
        _entitiesIds.map(id => {
          const entity = viewer.entities.getById(id)
          if (entity) {
            let type = ''
            if (id.indexOf('plotPoint') > -1) {
              type = 'plotPoint'
            } else if (id.indexOf('plotPolyline') > -1) {
              type = 'plotPolyline'
            } else if (id.indexOf('plotPolygon') > -1) {
              type = 'plotPolygon'
            }
            if (type) {
              handleSetEntityLabelValue(entity, oldPlot, type, 'reset')
            }
          }
        })
      }
    }
  }
}

export function RemoveFlyEntity() {
  if (flyEntity && flyEntity instanceof Cesium.Entity) {
    viewer.entities.remove(flyEntity)
  }
}

function createFlyEntity(position, positions) {
  const entity = viewer.entities.add({
    position: position,
    point: new Cesium.PointGraphics({
      color: new Cesium.Color.fromCssColorString('#fff').withAlpha(0.0)
    }),
    polyline: {
      positions: positions,
      material: new Cesium.PolylineDashMaterialProperty({
        color: new Cesium.Color.fromCssColorString('#fff').withAlpha(0.0)
      })
    }
  })
  return entity
}

// 标绘列表处选中标绘，视角跳转
export function ChoosePlotGraphic(data) {
  RemoveFlyEntity()
  const vertices = data.objectInfo.verticesPosition || data.objectInfo.activeShapePoints || []
  const position = Cesium.Cartesian3.fromDegrees(data.objectInfo.centerPoint.longitude, data.objectInfo.centerPoint.latitude, data.objectInfo.centerPoint.altitude)
  const list = []
  vertices.map(_ => {
    list.push(_.longitude)
    list.push(_.latitude)
    list.push(_.altitude)
  })
  const positions = Cesium.Cartesian3.fromDegreesArrayHeights(list)
  flyEntity = createFlyEntity(position, positions)
  viewer.flyTo(flyEntity, {
    duration: 1
  })
}

export function SetAllPlotGraphicVisible(visible) {
  for (let index = 0; index < entityIds.length; index++) {
    const id = entityIds[index]
    viewer.entities.getById(id) ? viewer.entities.getById(id).show = visible : void (0)

    // 着火点
    firePointsObject[id] ? firePointsObject[id].show = visible : void (0)
  }
}

export function SetPlotGraphicVisible(id, visible) {
  const ids = entityIds.filter(
    _ => id === parseInt(_.split('_')[0])
  )
  for (let index = 0; index < ids.length; index++) {
    const id = ids[index]
    viewer.entities.getById(id) ? viewer.entities.getById(id).show = visible : void (0)

    // 着火点
    firePointsObject[id] ? firePointsObject[id].show = visible : void (0)
  }
}

export function SetPlotsGraphicVisible(ids) {
  if (!entityIds || entityIds.length <= 0) return
  // 先隐藏所有图形
  entityIds.map(id => {
    viewer.entities.getById(id) ? viewer.entities.getById(id).show = false : void (0)

    // 着火点
    firePointsObject[id] ? firePointsObject[id].show = false : void (0)
  })
  const showEntityIds = entityIds.filter(
    _ => ids.indexOf(parseInt(_.split('_')[0])) > -1
  )
  let _showEntityIds = showEntityIds
  if (store.state.plotting.editStatus && store.state.plotting.currentPlotId) {
    // 不包括当前正在编辑的图形
    _showEntityIds = showEntityIds.filter(
      _ => _.indexOf(store.state.plotting.currentPlotId) === -1
    )
  }
  if (_showEntityIds && _showEntityIds.length > 0) {
    // 显示当前勾选的图形
    _showEntityIds.map(id => {
      viewer.entities.getById(id) ? viewer.entities.getById(id).show = true : void (0)

      // 着火点
      firePointsObject[id] ? firePointsObject[id].show = true : void (0)
    })
  }
}

const AddPlotGraphicDebounce = debounce(function (data) {
  if (!data) return
  const newIds = data.map(_ => _.id) // 新加载到的标绘
  const oldIds = uniq(entityIds.map(_ => parseInt(_.split('_')[0]))) // 已存在的标绘
  const pubIds = intersection(newIds, oldIds) // 兩次切換都有的
  const delIds = pullAll(oldIds, pubIds) // 需要刪除的（第二次未加載的）
  if (newIds.length === 0) {
    ClearPlotGraphic(oldIds)
  } else {
    ClearPlotGraphic(delIds)
  }
  if (usePrimitive) {
    clearPlotGraphicBasePrimitive()
    addPlotGraphicBasePrimitive()
  }
  addPlotGraphicBaseEntity()
  data.map((item, index) => {
    let objectInfo = {}
    if (Object.prototype.toString.call(item.objectInfo) === '[object Object]') {
      objectInfo = item.objectInfo
    } else {
      objectInfo = JSON.parse(item.objectInfo)
    }
    if (objectInfo) {
      if (objectInfo.activeShapePoints && objectInfo.activeShapePoints.length > 0) {
        const plotName = item.towerName
        if (objectInfo.drawingMode === 'polygon') {
          addPolygonGraphic({ id: item.id, data: objectInfo, plotName, index: data.length - index, visible: true })
        } else if (objectInfo.drawingMode === 'polyline') {
          addPolylineGraphic({ id: item.id, data: objectInfo, plotName, index, visible: true })
        } else if (objectInfo.drawingMode === 'point') {
          addPointGraphic({ id: item.id, data: objectInfo, plotName, index, visible: true })
        } else if (objectInfo.drawingMode === 'text') {
          addTextGraphic({ id: item.id, data: objectInfo, plotName, index, visible: true })
        }
      }
    }
  })
  const checkedIds = store.state.plotting.checkedIds
  SetPlotsGraphicVisible(checkedIds)
}, 400)

const AddNoFlyZoneGraphicDebounce = debounce(function (data) {
  if (!data) return
  if (!Vue.prototype.$vues.$store.state.noFlyZone.noFlyZoneStatus) return
  const newIds = data.map(_ => _.id) // 新加载到的禁飞区
  const oldIds = uniq(noFlyZoneEntityIds.map(_ => parseInt(_.split('_')[0]))) // 已存在的禁飞区
  const pubIds = intersection(newIds, oldIds) // 兩次切換都有的
  const delIds = pullAll(oldIds, pubIds) // 需要刪除的（第二次未加載的）
  if (newIds.length === 0) {
    ClearPlotGraphic(oldIds)
  } else {
    ClearPlotGraphic(delIds)
  }
  addPlotGraphicBaseEntity()
  data.map((item, index) => {
    let objectInfo = {}
    if (Object.prototype.toString.call(item.objectInfo) === '[object Object]') {
      objectInfo = item.objectInfo
    } else {
      objectInfo = JSON.parse(item.objectInfo)
    }
    if (objectInfo) {
      if (objectInfo.activeShapePoints && objectInfo.activeShapePoints.length > 0) {
        const plotName = item.towerName
        if (objectInfo.drawingMode === 'polygon') {
          addPolygonGraphic({ id: item.id, data: objectInfo, plotName, index: data.length - index, visible: true }, 'noFlyZone')
        }
      }
    }
  })
  // const checkedIds = store.state.plotting.checkedIds
  // SetPlotsGraphicVisible(checkedIds, 'noFlyZone')
}, 400)

export function ClearPlotGraphic(ids) {
  let _entityIds = []
  if (ids) {
    _entityIds = entityIds.filter(
      _ => ids.indexOf(parseInt((_.split('_')[0]))) > -1
    )
  } else {
    _entityIds = entityIds
  }
  for (let index = 0; index < _entityIds.length; index++) {
    const id = _entityIds[index]
    viewer.entities.getById(id) ? viewer.entities.remove(viewer.entities.getById(id)) : void (0)
    entityIds.splice(entityIds.indexOf(id), 1)

    // 着火点
    viewer.scene.primitives.remove(firePointsObject[id])
    delete firePointsObject[id]
  }

  let _noFlyZoneEntityIds = []
  if (ids) {
    _noFlyZoneEntityIds = noFlyZoneEntityIds.filter(
      _ => ids.indexOf(parseInt((_.split('_')[0]))) > -1
    )
  } else {
    _noFlyZoneEntityIds = noFlyZoneEntityIds
  }
  for (let index = 0; index < _noFlyZoneEntityIds.length; index++) {
    const id = _noFlyZoneEntityIds[index]
    viewer.entities.getById(id) ? viewer.entities.remove(viewer.entities.getById(id)) : void (0)
    noFlyZoneEntityIds.splice(noFlyZoneEntityIds.indexOf(id), 1)
  }
}
export function clearNoFlyZone() {
  noFlyZoneEntityIds.forEach((item, index) => {
    viewer.entities.getById(item) ? viewer.entities.remove(viewer.entities.getById(item)) : void (0)
  })
  noFlyZoneEntityIds = []
}

export function AddPlotGraphic(data) {
  AddPlotGraphicDebounce(data)
}
export function AddNoFlyZoneGraphic(data) {
  AddNoFlyZoneGraphicDebounce(data)
}

export function DeletePlotGraphic(id) {
  if (!id) return
  const _entitiesIds = entityIds.filter(_ =>
    _.indexOf(id) > -1
  )
  for (let index = 0; index < _entitiesIds.length; index++) {
    const id = _entitiesIds[index]
    viewer.entities.getById(id) ? viewer.entities.remove(viewer.entities.getById(id)) : void (0)
    entityIds.splice(entityIds.indexOf(id), 1)
  }
  viewer.scene.primitives.remove(firePointsObject[`${id}_plotPoint`])
  delete firePointsObject[`${id}_plotPoint`]
}

export async function GetPlotData(type) {
  let options = {}
  if (type && type === 'range') {
    const center = tool.getCameraCenterPosition()
    options = {
      longitude: encrypt().longitudeFunction(center.longitude),
      latitude: encrypt().latitudeFunction(center.latitude),
      radius: 3000,
      isQueryOwner: store.state.plotting.ownerData
    }
  }
  const data = await getAreaDraw({
    ...options,
  })
  if (!data) return
  data.reverse()
  const _data = []
  const groups = await Vue.prototype.$worker.run(
    function (data) {
      var result = []
      var count = Math.ceil(data.length / 10)
      for (let index = 0; index < count; index++) {
        result.push(data.slice(index * 10, (index + 1) * 10))
      }
      return result
    },
    [data]
  )
  for (let i = 0; i < groups.length; i++) {
    const list = groups[i]
    for (let j = 0; j < list.length; j++) {
      const item = list[j]
      _data.push(DecryptPlotData(item))
    }
  }
  if (type && type === 'range') {
    // 范围加载（图形）
    AddPlotGraphic(_data)
  } else {
    // 全量加载（列表）
  }
  return _data
}

export async function GetNoFlyZoneData() {
  let options = {}
  const center = tool.getCameraCenterPosition()
  options = {
    lng: encrypt().longitudeFunction(center.longitude),
    lat: encrypt().latitudeFunction(center.latitude),
    radius: 50000
  }
  const data = await getNoFlyZoneDataFun(options)
  if (!data) return
  data.reverse()
  const _data = []
  if (data) {
    data.map(_ => {
      _data.push(DecryptPlotData(_))
    })
  }
  return _data
}
