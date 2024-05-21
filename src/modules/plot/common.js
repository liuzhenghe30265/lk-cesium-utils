import { formatNumber } from '../common'

/**
 * @description: 标绘中格式化标注文字
 * @param {*} type
 * @param {*} data
 * @return {*}
 */
export function formatGraphicLabelText(type, data) {
  let text = ''
  if (type === 'point') {
    const name = data.name ? `${data.name}\n` : ''
    const long = data.longitude ? `经度：${formatNumber(data.longitude, 7)}\n` : ''
    const lat = data.latitude ? `纬度：${formatNumber(data.latitude, 7)}\n` : ''
    const alt = parseFloat(data.altitude) || parseFloat(data.altitude) === 0 ? `海拔：${formatNumber(data.altitude, 1)}m` : ''
    text = `${name}${long}${lat}${alt}`
  } else if (type === 'polyline') {
    const name = data.name ? `${data.name}\n` : ''
    const value = data.value && parseFloat(data.value)
      ? parseFloat(data.value) >= 1000
        ? `总距离：${formatNumber(data.value / 1000, 1)}千米`
        : `总距离：${data.value}米`
      : ''
    const subValue = data.subValue && parseFloat(data.subValue)
      ? parseFloat(data.subValue) >= 1000
        ? `${formatNumber(data.subValue / 1000, 1)}千米`
        : `${data.subValue}米`
      : ''
    text = `${name}${value}${subValue}`
  } else if (type === 'polygon') {
    const name = data.name ? `${data.name}\n` : ''
    const value = `${areaConversion(data.value)}`
    text = `${name}${value}`
  } else if (type === 'text') {
    const name = data.name ? `${sliceString(data.name, 10).join('\n')}` : ''
    text = `${name}`
  } else if (type === 'vertex') {
    const name = data.name ? `${data.name}\n` : ''
    text = `${name}`
  }
  return text
}
function areaConversion(value) {
  const useMu = true
  if (!value) return ''
  const mu = value ? formatNumber(parseFloat(value) / 666.6667, 2) + '亩' : ''
  const m2 = value ? formatNumber(value, 2) + '平方米' : ''
  const km2Value = formatNumber(parseFloat(value) / 1000000, 2)
  const km2 = value ? km2Value + '平方千米' : ''
  if (km2Value >= '0.1') {
    return `${useMu ? mu : ''}\n${km2}`
  } else {
    return `${useMu ? mu : ''}\n${m2}`
  }
}
function sliceString(str, length) {
  const result = []
  for (let i = 0; i < str.length; i += length) {
    result.push(str.slice(i, i + length))
  }
  return result
}

export function setEntityPolygonHierarchy(entity, hierarchy) {
  if (entity && entity.polygon) {
    entity.polygon.hierarchy = new Cesium.CallbackProperty(function () {
      return new Cesium.PolygonHierarchy(hierarchy)
    }, false)
  }
}

export function setEntityPolygonMaterial(entity, material) {
  if (entity && entity.polygon) {
    entity.polygon.material = material
  }
}

export function setEntityPolylinePositions(entity, positions) {
  if (entity && entity.polyline) {
    entity.polyline.positions = new Cesium.CallbackProperty(function () {
      return positions
    }, false)
  }
}

export function setEntityPolylineMaterial(entity, material) {
  if (entity && entity.polyline) {
    entity.polyline.material = material
  }
}

export function setEntityLabelFillColor(entity, fillColor) {
  if (entity && entity.label) {
    entity.label.fillColor = fillColor
  }
}

export function setEntityLabelFont(entity, font) {
  if (entity && entity.label) {
    entity.label.font = font
  }
}

export function setEntityLabelText(entity, value) {
  if (entity && entity.label) {
    entity.label.text = value
  }
}

export function setEntityPosition(entity, position) {
  if (entity && entity.position) {
    entity.position.setValue(position)
  }
}

export function setEntityPointPixelSize(entity, pixelSize) {
  if (entity && entity.point) {
    entity.point.pixelSize = pixelSize
  }
}

export function setEntityPointColor(entity, color) {
  if (entity && entity.point) {
    entity.point.color = color
  }
}

export function SetEntityPointOutlineColor(entity, outlineColor) {
  if (entity && entity.point) {
    entity.point.outlineColor = outlineColor
  }
}

export function SetEntityPointOutlineWidth(entity, outlineWidth) {
  if (entity && entity.point) {
    entity.point.outlineWidth = outlineWidth
  }
}
