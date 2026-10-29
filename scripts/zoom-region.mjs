import sharp from 'sharp'
const [,, src, dst, cx, cy, w, h] = process.argv
const W = Number(w), H = Number(h)
await sharp(src)
  .extract({ left: Math.max(0, Number(cx) - W/2), top: Math.max(0, Number(cy) - H/2), width: W, height: H })
  .resize(W*3, H*3, { kernel: 'nearest' })
  .toFile(dst)
console.log('ok')
