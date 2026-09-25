import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'resources')
mkdirSync(outDir, { recursive: true })

function crc32(buf) {
  let crc = ~0
  for (const byte of buf) {
    crc ^= byte
    for (let i = 0; i < 8; i += 1) {
      const mask = -(crc & 1)
      crc = (crc >>> 1) ^ (0xedb88320 & mask)
    }
  }
  return ~crc >>> 0
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type)
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])))
  return Buffer.concat([length, typeBuf, data, crc])
}

function writePng(path, width, height, rgba) {
  const stride = width * 4 + 1
  const raw = Buffer.alloc(stride * height)
  for (let y = 0; y < height; y += 1) {
    raw[y * stride] = 0
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4
      const o = y * stride + 1 + x * 4
      raw[o] = rgba[i]
      raw[o + 1] = rgba[i + 1]
      raw[o + 2] = rgba[i + 2]
      raw[o + 3] = rgba[i + 3]
    }
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6

  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])
  writeFileSync(path, png)
}

function paint(size, plot) {
  const rgba = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const [r, g, b, a] = plot(x, y, size)
      const i = (y * size + x) * 4
      rgba[i] = r
      rgba[i + 1] = g
      rgba[i + 2] = b
      rgba[i + 3] = a
    }
  }
  return rgba
}

function meter(x, y, size, colors) {
  const cx = (size - 1) / 2
  const cy = (size - 1) / 2
  const dx = x - cx
  const dy = y - cy
  const dist = Math.hypot(dx, dy)
  const outer = size * 0.42
  const inner = size * 0.24
  if (dist > outer + 0.6 || dist < inner - 0.6) return [0, 0, 0, 0]

  let angle = Math.atan2(dy, dx)
  angle = (angle + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2)
  const creating = Math.PI * 2 * 0.62
  const consuming = Math.PI * 2 * 0.26
  if (angle < creating) return colors.creating
  if (angle < creating + consuming) return colors.consuming
  return colors.neutral
}

const appColors = {
  creating: [31, 107, 74, 255],
  consuming: [177, 66, 31, 255],
  neutral: [122, 116, 106, 255]
}

const trayColors = {
  creating: [0, 0, 0, 230],
  consuming: [0, 0, 0, 170],
  neutral: [0, 0, 0, 90]
}

function appIcon(size) {
  return paint(size, (x, y, s) => {
    const paper = [244, 239, 230, 255]
    const ring = meter(x, y, s, appColors)
    if (ring[3] > 0) return ring
    const cx = (s - 1) / 2
    const cy = (s - 1) / 2
    const inset = s * 0.06
    if (x < inset || y < inset || x > s - 1 - inset || y > s - 1 - inset) {
      return [27, 24, 20, 255]
    }
    return paper
  })
}

writePng(join(outDir, 'icon.png'), 512, 512, appIcon(512))
writePng(join(outDir, 'trayTemplate.png'), 16, 16, paint(16, (x, y, s) => meter(x, y, s, trayColors)))
writePng(join(outDir, 'trayTemplate@2x.png'), 32, 32, paint(32, (x, y, s) => meter(x, y, s, trayColors)))
console.log('Wrote resources/icon.png and tray templates')
