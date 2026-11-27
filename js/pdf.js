// Minimalistische PDF-schrijver: één pagina met een JPEG-afbeelding over de
// volle pagina. Geen externe bibliotheek nodig, werkt offline.

const enc = new TextEncoder();

/**
 * @param {Uint8Array} jpeg   JPEG-bytes
 * @param {number} imgW, imgH pixels
 * @param {number} pageWmm, pageHmm
 * @param {object} info       { title }
 */
export function buildPdf(jpeg, imgW, imgH, pageWmm, pageHmm, info = {}) {
  return buildPdfPages([{ jpeg, w: imgW, h: imgH }], pageWmm, pageHmm, info);
}

/**
 * PDF met meerdere pagina's, elk één JPEG over de volle pagina.
 * @param {{ jpeg: Uint8Array, w: number, h: number }[]} pages
 */
export function buildPdfPages(pages, pageWmm, pageHmm, info = {}) {
  const W = (pageWmm * 72) / 25.4;
  const H = (pageHmm * 72) / 25.4;
  const chunks = [];
  const offsets = [];
  let length = 0;
  const write = (data) => {
    const bytes = typeof data === 'string' ? enc.encode(data) : data;
    chunks.push(bytes);
    length += bytes.length;
  };
  const obj = (n, body) => {
    offsets[n] = length;
    write(`${n} 0 obj\n`);
    body();
    write('\nendobj\n');
  };
  const pdfString = (s) => '(' + String(s).replace(/[\\()]/g, (c) => '\\' + c).replace(/[^\x20-\x7e]/g, '?') + ')';

  // objecten: 1 catalogus, 2 pagina's, 3 info, per pagina 3 objecten (pagina, afbeelding, inhoud)
  const n = pages.length;
  const pageObj = (i) => 4 + i * 3;
  write('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  obj(1, () => write('<< /Type /Catalog /Pages 2 0 R >>'));
  obj(2, () => write(`<< /Type /Pages /Kids [${pages.map((_, i) => `${pageObj(i)} 0 R`).join(' ')}] /Count ${n} >>`));
  obj(3, () => write(`<< /Title ${pdfString(info.title || 'Tuinontwerp')} /Producer (Tuinontwerp) >>`));
  pages.forEach((pg, i) => {
    const o = pageObj(i);
    obj(o, () => write(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W.toFixed(2)} ${H.toFixed(2)}] ` +
      `/Resources << /XObject << /Im0 ${o + 1} 0 R >> >> /Contents ${o + 2} 0 R >>`,
    ));
    obj(o + 1, () => {
      write(`<< /Type /XObject /Subtype /Image /Width ${pg.w} /Height ${pg.h} ` +
        `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${pg.jpeg.length} >>\nstream\n`);
      write(pg.jpeg);
      write('\nendstream');
    });
    const content = `q ${W.toFixed(2)} 0 0 ${H.toFixed(2)} 0 0 cm /Im0 Do Q`;
    obj(o + 2, () => write(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`));
  });
  const count = 4 + n * 3;
  const xref = length;
  write(`xref\n0 ${count}\n0000000000 65535 f \n`);
  for (let i = 1; i < count; i++) write(String(offsets[i]).padStart(10, '0') + ' 00000 n \n');
  write(`trailer\n<< /Size ${count} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  const out = new Uint8Array(length);
  let pos = 0;
  for (const c of chunks) {
    out.set(c, pos);
    pos += c.length;
  }
  return new Blob([out], { type: 'application/pdf' });
}

export function dataUrlToBytes(dataUrl) {
  const b64 = dataUrl.split(',')[1];
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
