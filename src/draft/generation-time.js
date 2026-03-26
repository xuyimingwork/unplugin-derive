function pad2(n) {
  return String(n).padStart(2, '0')
}

/** @param {Date} [date] */
function formatLocalDateTime(date = new Date()) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
    date.getDate()
  )} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(
    date.getSeconds()
  )}`
}

/**
 * 仅毫秒：`128ms`；≥1s 且不足 1 分：`1s500ms`（s + 余下 ms）；有分：`1m05s`（不展示 ms）
 * @param {number} ms
 */
function formatElapsedMs(ms) {
  const clamped = Math.max(0, Math.floor(Number(ms) || 0))
  if (clamped < 1000) {
    return `${clamped}ms`
  }
  const totalSec = Math.floor(clamped / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  if (m > 0) {
    return `${m}m${pad2(s)}s`
  }
  const msPart = clamped % 1000
  return `${s}s${msPart}ms`
}

/**
 * 本地时间 + 耗时，例如：（耗时：128ms）或（耗时：5s0ms）或（耗时：1m05s）
 * @param {number} elapsedMs
 */
function formatGenerationTimeLine(elapsedMs) {
  return `${formatLocalDateTime()}（耗时：${formatElapsedMs(elapsedMs)}）`
}

module.exports = {
  formatLocalDateTime,
  formatElapsedMs,
  formatGenerationTimeLine
}
