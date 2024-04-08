<template>
  <div id="app">
    <div id="cesiumContainer">
      <!--  -->
    </div>
  </div>
</template>

<script>
import { GetCesiumVersion, screenTo3D } from '../src/index'
export default {
  name: 'App',
  components: {},
  data() {
    return {}
  },
  computed: {},
  mounted() {
    console.log('Cesium Version', GetCesiumVersion())
    Cesium.Ion.defaultAccessToken =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIwMmM3M2Q2Yi1jOTIzLTRjZWItYjU2YS1mOWM5YTI3OGU5NTYiLCJpZCI6MjgyNzksInNjb3BlcyI6WyJhc2wiLCJhc3IiLCJhc3ciLCJnYyIsInByIl0sImlhdCI6MTU5MzY4NDQwNH0.H_A9xCf17WrntJ9TtMPVnLK_ZC4A30CQEisbOTF4E3U'
    const viewer = new Cesium.Viewer('cesiumContainer', {
      terrainProvider: Cesium.createWorldTerrain()
    })
    window.viewer = viewer
    viewer.scene.debugShowFramesPerSecond = true

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
    handler.setInputAction(function (event) {
      console.log('.........event', event)
      console.log('.........screenTo3D', screenTo3D(event.position))
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK)
  },
  methods: {}
}
</script>

<style lang="scss">
#app {
  text-align: center;
}
#cesiumContainer {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
}
</style>
