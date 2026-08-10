const encoder = new TextEncoder();
const decoder = new TextDecoder();

type CellValue = string | number | boolean;

export interface XlsxSheet {
  name: string;
  headers: string[];
  rows: Array<Record<string, CellValue>>;
}

interface ZipEntry {
  name: string;
  compression: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
}

const xmlEscape = (value: unknown) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

const xmlUnescape = (value: string) => value
  .replace(/&apos;/g, "'")
  .replace(/&quot;/g, '"')
  .replace(/&gt;/g, '>')
  .replace(/&lt;/g, '<')
  .replace(/&amp;/g, '&');

const columnName = (index: number) => {
  let n = index + 1;
  let name = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
};

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

const crc32 = (data: Uint8Array) => {
  let crc = 0xFFFFFFFF;
  for (const byte of data) crc = crcTable[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
};

const writeU16 = (view: DataView, offset: number, value: number) => view.setUint16(offset, value, true);
const writeU32 = (view: DataView, offset: number, value: number) => view.setUint32(offset, value >>> 0, true);

const concatBytes = (chunks: Uint8Array[]) => {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
};

const zipStore = (files: Array<{ name: string; data: Uint8Array }>) => {
  const chunks: Uint8Array[] = [];
  const centralChunks: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const checksum = crc32(file.data);
    const local = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(local.buffer);
    writeU32(localView, 0, 0x04034B50);
    writeU16(localView, 4, 20);
    writeU16(localView, 6, 0);
    writeU16(localView, 8, 0);
    writeU16(localView, 10, 0);
    writeU16(localView, 12, 0);
    writeU32(localView, 14, checksum);
    writeU32(localView, 18, file.data.length);
    writeU32(localView, 22, file.data.length);
    writeU16(localView, 26, nameBytes.length);
    writeU16(localView, 28, 0);
    local.set(nameBytes, 30);
    chunks.push(local, file.data);

    const central = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(central.buffer);
    writeU32(centralView, 0, 0x02014B50);
    writeU16(centralView, 4, 20);
    writeU16(centralView, 6, 20);
    writeU16(centralView, 8, 0);
    writeU16(centralView, 10, 0);
    writeU16(centralView, 12, 0);
    writeU16(centralView, 14, 0);
    writeU32(centralView, 16, checksum);
    writeU32(centralView, 20, file.data.length);
    writeU32(centralView, 24, file.data.length);
    writeU16(centralView, 28, nameBytes.length);
    writeU16(centralView, 30, 0);
    writeU16(centralView, 32, 0);
    writeU16(centralView, 34, 0);
    writeU16(centralView, 36, 0);
    writeU32(centralView, 38, 0);
    writeU32(centralView, 42, offset);
    central.set(nameBytes, 46);
    centralChunks.push(central);

    offset += local.length + file.data.length;
  }

  const central = concatBytes(centralChunks);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  writeU32(endView, 0, 0x06054B50);
  writeU16(endView, 8, files.length);
  writeU16(endView, 10, files.length);
  writeU32(endView, 12, central.length);
  writeU32(endView, 16, offset);
  writeU16(endView, 20, 0);
  chunks.push(central, end);

  return concatBytes(chunks);
};

const buildSheetXml = (headers: string[], rows: Array<Record<string, CellValue>>) => {
  const allRows = [headers, ...rows.map(row => headers.map(header => row[header] ?? ''))];
  const xmlRows = allRows.map((row, rowIndex) => {
    const r = rowIndex + 1;
    const cells = row.map((value, colIndex) => {
      const ref = `${columnName(colIndex)}${r}`;
      return `<c r="${ref}" t="inlineStr"><is><t>${xmlEscape(value)}</t></is></c>`;
    }).join('');
    return `<row r="${r}">${cells}</row>`;
  }).join('');

  const lastCell = `${columnName(headers.length - 1)}${allRows.length}`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:${lastCell}"/>
  <sheetViews><sheetView workbookViewId="0"/></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <sheetData>${xmlRows}</sheetData>
</worksheet>`;
};

const normalizeSheetName = (name: string, index: number, usedNames: Set<string>) => {
  const invalidCharacters = new Set(['\\', '/', '*', '?', ':', '[', ']']);
  const base = [...name].map(character => invalidCharacters.has(character) ? '_' : character).join('').trim().slice(0, 31) || `Sheet${index + 1}`;
  let candidate = base;
  let suffix = 2;
  while (usedNames.has(candidate)) {
    const tag = `_${suffix++}`;
    candidate = `${base.slice(0, 31 - tag.length)}${tag}`;
  }
  usedNames.add(candidate);
  return candidate;
};

export const createXlsxWorkbook = (sheets: XlsxSheet[]) => {
  if (sheets.length === 0) throw new Error('XLSX 至少需要一个工作表');

  const usedNames = new Set<string>();
  const normalizedSheets = sheets.map((sheet, index) => ({
    ...sheet,
    name: normalizeSheetName(sheet.name, index, usedNames)
  }));
  const worksheetOverrides = normalizedSheets.map((_, index) =>
    `  <Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
  ).join('\n');
  const workbookSheets = normalizedSheets.map((sheet, index) =>
    `<sheet name="${xmlEscape(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`
  ).join('');
  const worksheetRelationships = normalizedSheets.map((_, index) =>
    `  <Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`
  ).join('\n');
  const styleRelationshipId = normalizedSheets.length + 1;

  const files: Array<{ name: string; data: Uint8Array }> = [
    {
      name: '[Content_Types].xml',
      data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
${worksheetOverrides}
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`)
    },
    {
      name: '_rels/.rels',
      data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`)
    },
    {
      name: 'xl/workbook.xml',
      data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>${workbookSheets}</sheets>
</workbook>`)
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${worksheetRelationships}
  <Relationship Id="rId${styleRelationshipId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`)
    },
    {
      name: 'xl/styles.xml',
      data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>
  <fills count="1"><fill><patternFill patternType="none"/></fill></fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>
</styleSheet>`)
    }
  ];

  normalizedSheets.forEach((sheet, index) => {
    files.push({
      name: `xl/worksheets/sheet${index + 1}.xml`,
      data: encoder.encode(buildSheetXml(sheet.headers, sheet.rows))
    });
  });

  return zipStore(files);
};

export const createXlsxFile = (headers: string[], rows: Array<Record<string, CellValue>>, sheetName = 'Records') =>
  createXlsxWorkbook([{ name: sheetName, headers, rows }]);

const findEndOfCentralDirectory = (view: DataView) => {
  for (let i = view.byteLength - 22; i >= 0; i--) {
    if (view.getUint32(i, true) === 0x06054B50) return i;
  }
  return -1;
};

const readZipEntries = (buffer: ArrayBuffer) => {
  const view = new DataView(buffer);
  const eocdOffset = findEndOfCentralDirectory(view);
  if (eocdOffset < 0) throw new Error('Invalid XLSX file');

  const entryCount = view.getUint16(eocdOffset + 10, true);
  let offset = view.getUint32(eocdOffset + 16, true);
  const entries = new Map<string, ZipEntry>();

  for (let i = 0; i < entryCount; i++) {
    if (view.getUint32(offset, true) !== 0x02014B50) throw new Error('Invalid XLSX directory');
    const compression = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);
    const name = decoder.decode(new Uint8Array(buffer, offset + 46, nameLength));
    entries.set(name, { name, compression, compressedSize, uncompressedSize, localHeaderOffset });
    offset += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
};

const inflateRaw = async (data: Uint8Array) => {
  const streamCtor = (globalThis as any).DecompressionStream;
  if (!streamCtor) throw new Error('当前浏览器暂不支持读取压缩 XLSX');
  const input = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
  const stream = new Blob([input]).stream().pipeThrough(new streamCtor('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
};

const readZipText = async (buffer: ArrayBuffer, entries: Map<string, ZipEntry>, name: string) => {
  const entry = entries.get(name);
  if (!entry) return '';

  const view = new DataView(buffer);
  const offset = entry.localHeaderOffset;
  if (view.getUint32(offset, true) !== 0x04034B50) throw new Error('Invalid XLSX entry');
  const nameLength = view.getUint16(offset + 26, true);
  const extraLength = view.getUint16(offset + 28, true);
  const dataOffset = offset + 30 + nameLength + extraLength;
  const compressed = new Uint8Array(buffer, dataOffset, entry.compressedSize);
  let data: Uint8Array;

  if (entry.compression === 0) data = compressed;
  else if (entry.compression === 8) data = await inflateRaw(compressed);
  else throw new Error('不支持的 XLSX 压缩格式');

  if (entry.uncompressedSize && data.length !== entry.uncompressedSize) {
    data = data.slice(0, entry.uncompressedSize);
  }

  return decoder.decode(data);
};

const readSharedStrings = (xml: string) => {
  if (!xml) return [];
  const strings: string[] = [];
  const itemMatches = xml.matchAll(/<si\b[\s\S]*?<\/si>/g);
  for (const match of itemMatches) {
    const textParts = [...match[0].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(part => xmlUnescape(part[1]));
    strings.push(textParts.join(''));
  }
  return strings;
};

const cellRefToIndex = (ref: string) => {
  const letters = ref.replace(/\d+/g, '');
  let index = 0;
  for (const letter of letters) index = index * 26 + letter.charCodeAt(0) - 64;
  return Math.max(index - 1, 0);
};

const parseSheetRows = (xml: string, sharedStrings: string[]) => {
  const rows: string[][] = [];
  const rowMatches = xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g);

  for (const rowMatch of rowMatches) {
    const values: string[] = [];
    const cellMatches = rowMatch[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g);
    for (const cellMatch of cellMatches) {
      const attrs = cellMatch[1];
      const body = cellMatch[2];
      const ref = attrs.match(/\br="([^"]+)"/)?.[1] ?? '';
      const type = attrs.match(/\bt="([^"]+)"/)?.[1] ?? '';
      const colIndex = ref ? cellRefToIndex(ref) : values.length;
      let value = '';

      const inlineText = body.match(/<is\b[\s\S]*?<t(?:\s[^>]*)?>([\s\S]*?)<\/t>[\s\S]*?<\/is>/);
      const rawValue = body.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? '';
      if (type === 'inlineStr' && inlineText) value = xmlUnescape(inlineText[1]);
      else if (type === 's') value = sharedStrings[Number(rawValue)] ?? '';
      else value = xmlUnescape(rawValue);

      values[colIndex] = value;
    }
    rows.push(values.map(value => value ?? ''));
  }

  return rows;
};

const rowsToRecords = (rows: string[][]) => {
  if (rows.length < 2) return [];
  const headers = rows[0].map(header => header.trim());
  return rows.slice(1).filter(row => row.some(Boolean)).map(row => {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => { record[header] = row[index] ?? ''; });
    return record;
  });
};

export interface ParsedXlsxSheet {
  name: string;
  rows: Array<Record<string, string>>;
}

export const parseXlsxWorkbook = async (buffer: ArrayBuffer): Promise<ParsedXlsxSheet[]> => {
  const entries = readZipEntries(buffer);
  const workbookXml = await readZipText(buffer, entries, 'xl/workbook.xml');
  const workbookRels = await readZipText(buffer, entries, 'xl/_rels/workbook.xml.rels');
  const sharedStringsXml = await readZipText(buffer, entries, 'xl/sharedStrings.xml');
  const sharedStrings = readSharedStrings(sharedStringsXml);
  const relationships = new Map<string, string>();

  for (const match of workbookRels.matchAll(/<Relationship\b([^>]*)\/?\s*>/g)) {
    const attrs = match[1];
    if (!/\/worksheet"/.test(attrs)) continue;
    const id = attrs.match(/\bId="([^"]+)"/)?.[1];
    const target = attrs.match(/\bTarget="([^"]+)"/)?.[1];
    if (id && target) relationships.set(id, target);
  }

  const sheets: ParsedXlsxSheet[] = [];
  for (const match of workbookXml.matchAll(/<sheet\b([^>]*)\/?\s*>/g)) {
    const attrs = match[1];
    const name = xmlUnescape(attrs.match(/\bname="([^"]+)"/)?.[1] ?? `Sheet${sheets.length + 1}`);
    const relationshipId = attrs.match(/\br:id="([^"]+)"/)?.[1];
    const target = relationshipId ? relationships.get(relationshipId) : undefined;
    if (!target) continue;
    const normalizedTarget = target.replace(/^\.\//, '');
    const sheetPath = normalizedTarget.startsWith('/')
      ? normalizedTarget.slice(1)
      : normalizedTarget.startsWith('xl/') ? normalizedTarget : `xl/${normalizedTarget}`;
    const sheetXml = await readZipText(buffer, entries, sheetPath);
    if (sheetXml) sheets.push({ name, rows: rowsToRecords(parseSheetRows(sheetXml, sharedStrings)) });
  }

  if (sheets.length === 0) {
    const fallbackXml = await readZipText(buffer, entries, 'xl/worksheets/sheet1.xml');
    if (fallbackXml) sheets.push({ name: 'Sheet1', rows: rowsToRecords(parseSheetRows(fallbackXml, sharedStrings)) });
  }
  if (sheets.length === 0) throw new Error('未找到 XLSX 表格数据');
  return sheets;
};

export const parseXlsxFile = async (buffer: ArrayBuffer) => (await parseXlsxWorkbook(buffer))[0]?.rows ?? [];
