function uuidv7() {
  const now = Date.now();
  const timeHigh = Math.floor(now / 0x100000000);
  const timeLow = now >>> 0;
  const b = new Uint8Array(16);
  b[0] = (timeHigh >>> 8) & 0xff;
  b[1] = timeHigh & 0xff;
  b[2] = (timeLow >>> 24) & 0xff;
  b[3] = (timeLow >>> 16) & 0xff;
  b[4] = (timeLow >>> 8) & 0xff;
  b[5] = timeLow & 0xff;
  b[6] = (Math.random() * 0x10 | 0) | 0x70;
  b[7] = (Math.random() * 0x40 | 0) | 0x80;
  for (let i = 8; i < 16; i++) b[i] = Math.random() * 256 | 0;
  const h = Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}
module.exports = uuidv7;