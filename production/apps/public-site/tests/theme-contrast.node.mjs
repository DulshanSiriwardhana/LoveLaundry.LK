import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../src/ll-design-tokens.css', import.meta.url), 'utf8')
const themeSource = readFileSync(new URL('../src/ll-theme.tsx', import.meta.url), 'utf8')

const themeIds = [...themeSource.matchAll(/\bid: '([^']+)'/g)].map((match) => match[1])
const swatches = [
  ...themeSource.matchAll(/\{ id: '([^']+)', label: '[^']+', mode: '(?:light|dark)', swatch: '(#[0-9A-Fa-f]{6})'/g),
].map((match) => ({ id: match[1], swatch: match[2] }))
const blocks = [...css.matchAll(/html:root\[data-theme='([^']+)'\]\s*\{([\s\S]*?)\n  \}/g)]

function variable(block, name) {
  const match = block.match(new RegExp(`--${name}:\\s*([^;]+);`))
  assert.ok(match, `missing --${name}`)
  return match[1].trim()
}

function toRgb(hex) {
  assert.match(hex, /^#[0-9A-Fa-f]{6}$/)
  return [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255)
}

function mix(from, to, amount) {
  return from.map((channel, index) => channel * (1 - amount) + to[index] * amount)
}

function luminance([red, green, blue]) {
  const linear = [red, green, blue].map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  )
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]
}

function contrast(first, second) {
  const a = luminance(first)
  const b = luminance(second)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

function hue(hex) {
  const [red, green, blue] = toRgb(hex)
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const delta = max - min
  // Near-neutral graphite swatches have a tiny blue component; treat them as neutral.
  if (delta <= 0.02) return 0
  let value = 0
  if (max === red) value = ((green - blue) / delta) % 6
  else if (max === green) value = (blue - red) / delta + 2
  else value = (red - green) / delta + 4
  value *= 60
  return value < 0 ? value + 360 : value
}

test('theme kit ships 20 blue-free presets', () => {
  assert.equal(themeIds.length, 20)
  assert.equal(new Set(themeIds).size, 20)
  assert.equal(swatches.length, 20)
  const blueFree = swatches.filter(({ swatch }) => {
    const angle = hue(swatch)
    return angle < 185 || angle > 265
  })
  assert.equal(blueFree.length, 20, 'every shipped swatch must be outside the blue range')
})

test('active navigation contrast is at least 4.5:1 in every theme', () => {
  assert.equal(blocks.length, 20)
  assert.deepEqual([...blocks.map((block) => block[1])].sort(), [...themeIds].sort())

  let minimum = Infinity
  for (const [, id, block] of blocks) {
    const active = variable(block, 'sidebar-active')
    const activeBg = variable(block, 'sidebar-active-bg')
    const sidebarBg = variable(block, 'sidebar-bg')
    assert.ok(['#FFFFFF', '#000000'].includes(active), `${id}: unexpected active text ${active}`)

    const opposite = active === '#FFFFFF' ? '#000000' : '#FFFFFF'
    const expected = `color-mix(in srgb, ${opposite} 12%, var(--sidebar-bg))`
    assert.equal(activeBg, expected, `${id}: active surface must move 12% away from its text`)
    assert.notEqual(activeBg, active, `${id}: active surface cannot equal active text`)

    const ratio = contrast(toRgb(active), mix(toRgb(sidebarBg), toRgb(opposite), 0.12))
    assert.ok(ratio >= 4.5, `${id}: active nav contrast ${ratio.toFixed(2)}:1 is below 4.5:1`)
    minimum = Math.min(minimum, ratio)
  }
  assert.ok(minimum >= 4.5, `weakest theme contrast ${minimum.toFixed(2)}:1 is below 4.5:1`)
})
