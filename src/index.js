if (!(window.Cesium && window.viewer)) {
  throw new Error('请确保 Cesium 和 Viewer 已挂在 window 对象上！！！')
}

import { screenTo3D } from './modules/base'

export function GetCesiumVersion() {
  return Cesium.VERSION
}

export {
  screenTo3D
}