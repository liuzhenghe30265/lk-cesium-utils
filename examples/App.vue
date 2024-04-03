<template>
  <div id="app">
    <!--  -->
  </div>
</template>

<script>
/* eslint-disable no-unused-vars */
import { GetCesiumVersion, screenTo3D } from '../src/index'
export default {
  name: 'App',
  components: {},
  data() {
    return {}
  },
  computed: {},
  mounted() {
    console.log('............GetCesiumVersion', GetCesiumVersion())
    console.log('.........screenTo3D', screenTo3D())
  },
  methods: {}
}
</script>

<style lang="scss">
#app {
  text-align: center;
}
</style>
