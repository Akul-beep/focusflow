export async function extractTextFromFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();

  if (name.endsWith('.txt') || file.type === 'text/plain') {
    return await file.text();
  }

  if (name.endsWith('.docx') || file.type.includes('wordprocessingml')) {
    try {
      const mammoth = await import('mammoth');
      const buf = await file.arrayBuffer();
      const { value } = await mammoth.extractRawText({ arrayBuffer: buf });
      return value || '';
    } catch {
      throw new Error(
        'DOCX extraction failed in this browser. Please export as PDF or TXT and upload again.'
      );
    }
  }

  if (name.endsWith('.pdf') || file.type === 'application/pdf') {
    // Legacy build is more compatible with browsers that lack some newer stream helpers.
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

    const buf = await file.arrayBuffer();
    let doc;
    try {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
        import.meta.url
      ).toString();
      doc = await pdfjs.getDocument({ data: buf }).promise;
    } catch {
      const version = pdfjs.version || '4.4.168';
      pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${version}/legacy/build/pdf.worker.min.mjs`;
      doc = await pdfjs.getDocument({ data: buf }).promise;
    }
    // Read the full PDF so subjects/topics near the end are not dropped.
    // Use a generous safety cap for very large files.
    const maxPages = Math.min(doc.numPages, 80);
    let out = '';
    for (let p = 1; p <= maxPages; p++) {
      const page = await doc.getPage(p);
      const textContent = await page.getTextContent();
      const items = textContent.items
        .filter((item) => 'str' in item && typeof item.str === 'string')
        .map((item) => {
          const it = item as { str: string; transform?: number[] };
          return {
            str: it.str,
            x: Array.isArray(it.transform) ? it.transform[4] || 0 : 0,
            y: Array.isArray(it.transform) ? it.transform[5] || 0 : 0,
          };
        })
        .map((item) => ({
          str: item.str,
          x: item.x,
          y: item.y,
        }))
        .filter((i) => i.str.trim().length > 0);

      // Preserve visual line structure using y-position buckets, then order by x.
      const yTolerance = 2.5;
      const rows: Array<{ y: number; parts: Array<{ x: number; str: string }> }> = [];
      for (const it of items) {
        let row = rows.find((r) => Math.abs(r.y - it.y) <= yTolerance);
        if (!row) {
          row = { y: it.y, parts: [] };
          rows.push(row);
        }
        row.parts.push({ x: it.x, str: it.str });
      }
      rows.sort((a, b) => b.y - a.y);

      const pageLines: string[] = rows
        .map((row) => {
          const sorted = row.parts.sort((a, b) => a.x - b.x);
          const chunks: string[] = [];
          let prevX: number | null = null;
          for (const cell of sorted) {
            const value = cell.str.trim();
            if (!value) continue;
            if (prevX !== null && cell.x - prevX > 120) {
              // Large x-gap likely indicates a new table column.
              chunks.push(' | ');
            } else if (chunks.length > 0) {
              chunks.push(' ');
            }
            chunks.push(value);
            prevX = cell.x;
          }
          return chunks.join('').replace(/\s+/g, ' ').trim();
        })
        .filter(Boolean);

      out += pageLines.join('\n') + '\n\n';
    }
    return out;
  }

  throw new Error('Unsupported file type. Use PDF, DOCX, or TXT.');
}
