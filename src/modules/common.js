/**
 * @description: 保留小数
 * @param {*} num
 * @param {*} count
 * @return {*}
 */
export function formatNumber(num, count) {
    if (!num) {
        return 0
    }
    if (typeof num === 'string') {
        num = parseFloat(num)
    }
    return num.toFixed(count || count === 0 ? count : 2)
}

/**
 * @description: 百分比
 * @param {*} num
 * @param {*} total
 * @return {*}
 */
export function getPercentage(num, total) {
    if (num === 0 || total === 0) {
        return 0
    }
    return Math.round((num / total) * 10000) / 100.0
}