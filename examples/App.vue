<template>
  <div id="app">
    <input
      type="button"
      value="click"
      @click="handleClick"
    >
  </div>
</template>

<script>
import { GetCesiumVersion } from '../packages/index'
export default {
  name: 'App',
  components: {},
  data() {
    return {}
  },
  computed: {},
  mounted() {},
  methods: {
    handleClick() {
      console.log('............GetCesiumVersion', GetCesiumVersion())
    }
  }
}
</script>

<style lang="scss">
#app {
  text-align: center;
}
</style>
