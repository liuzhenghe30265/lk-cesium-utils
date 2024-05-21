// ^ 鼠标提示

import { formatNumber } from './common'
export default class MouseTip {
    /**
     * @param {*}
     * @memberof MouseTip
     */
    constructor(options) {
        this.position = null
        this.$mouseTipEl = null // 鼠标提示
        this.$positionInfoEl = null // 坐标信息
        this.mouseTip = options.mouseTip // 是否显示右键提示
        this.positionInfo = options.positionInfo // 是否显示右上角坐标信息
        if (this.mouseTip) {
            this.addMouseTipEl()
        }
        if (this.positionInfo) {
            this.addPositionInfoEl()
        }
        if (this.mouseTip || this.positionInfo) {
            this.addPostRender()
        }
    }

    addPositionInfoEl() {
        const DOM = document.createElement('div')
        DOM.setAttribute('class', 'position_info')
        DOM.style.cssText = 'width: max-content; font-size: 14px; position: absolute; right: 10px; top: 60px;'
        this.$positionInfoEl = DOM
        viewer.cesiumWidget.container.appendChild(this.$positionInfoEl)
    }

    addMouseTipEl() {
        const DOM = document.createElement('div')
        DOM.setAttribute('class', 'mouse_tip')
        const htmlString =
            `
            点击鼠标右键结束绘制
            `
        DOM.innerHTML = htmlString
        DOM.style.cssText = 'width: max-content; font-size: 14px; position: absolute; pointer-events: none; transform: translateX(0px) translateY(-100%);'
        this.$mouseTipEl = DOM
        viewer.cesiumWidget.container.appendChild(this.$mouseTipEl)
    }

    addPostRender() {
        viewer.scene.postRender.addEventListener(this.postRender, this)
    }

    postRender() {
        if (this.$mouseTipEl && this.position && this.position.screen) {
            this.$mouseTipEl.style.left = this.position.screen.x + 'px'
            this.$mouseTipEl.style.top = this.position.screen.y + 'px'
        }
        if (this.$positionInfoEl && this.position && this.position.map) {
            const position = this.position.map
            const htmlString =
                `
                    <div style="padding: 8px 10px; background: rgba(0, 0, 0, 0.6);">
                    经度：${formatNumber(position.longitude, 7)}；
                    纬度：${formatNumber(position.latitude, 7)}；
                    海拔：${formatNumber(position.altitude, 1)}
                    </div>
                `
            this.$positionInfoEl.innerHTML = htmlString
        }
    }

    UpdatePosition(newPosition) {
        this.position = newPosition
    }

    Destory() {
        if (this.$mouseTipEl) {
            viewer.cesiumWidget.container.removeChild(this.$mouseTipEl)
            this.$mouseTipEl = null
        }
        if (this.$positionInfoEl) {
            viewer.cesiumWidget.container.removeChild(this.$positionInfoEl)
            this.$positionInfoEl = null
        }
        viewer.scene.postRender.removeEventListener(this.postRender, this)
    }
}