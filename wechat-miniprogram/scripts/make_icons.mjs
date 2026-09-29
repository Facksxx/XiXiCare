/**
 * 生成小程序图标资源（tabBar + 设置页）。
 *
 * 图标几何取自 lucide（与安卓/网页版 App 同款图标集），
 * 用 @resvg/resvg-wasm 渲染成 PNG，避免小程序对 SVG 的兼容问题。
 *
 * 用法（在仓库根目录）：
 *   node wechat-miniprogram/scripts/make_icons.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initWasm, Resvg } from '@resvg/resvg-wasm';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.resolve(HERE, '..', 'assets');
const WASM = fileURLToPath(import.meta.resolve('@resvg/resvg-wasm/index_bg.wasm'));

/** lucide 图标几何（24x24 viewBox）。 */
const ICONS = {
  // 设置页：与原 App Settings.tsx 一一对应
  users: [
    ['path', { d: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' }],
    ['path', { d: 'M16 3.128a4 4 0 0 1 0 7.744' }],
    ['path', { d: 'M22 21v-2a4 4 0 0 0-3-3.87' }],
    ['circle', { cx: '9', cy: '7', r: '4' }],
  ],
  cloud: [['path', { d: 'M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z' }]],
  'shield-check': [
    ['path', { d: 'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z' }],
    ['path', { d: 'm9 12 2 2 4-4' }],
  ],
  database: [
    ['ellipse', { cx: '12', cy: '5', rx: '9', ry: '3' }],
    ['path', { d: 'M3 5V19A9 3 0 0 0 21 19V5' }],
    ['path', { d: 'M3 12A9 3 0 0 0 21 12' }],
  ],
  // 疫苗状态：与原 App VaccineSchedule 的 CheckCircle2 / HelpCircle 对应
  'circle-check': [
    ['circle', { cx: '12', cy: '12', r: '10' }],
    ['path', { d: 'm9 12 2 2 4-4' }],
  ],
  'circle-help': [
    ['circle', { cx: '12', cy: '12', r: '10' }],
    ['path', { d: 'M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3' }],
    ['path', { d: 'M12 17h.01' }],
  ],
  // tabBar：与原 App 底部导航语义一致
  house: [
    ['path', { d: 'M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8' }],
    ['path', { d: 'M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' }],
  ],
  records: [
    ['path', { d: 'M2 6h4' }],
    ['path', { d: 'M2 10h4' }],
    ['path', { d: 'M2 14h4' }],
    ['path', { d: 'M2 18h4' }],
    ['rect', { width: '16', height: '20', x: '4', y: '2', rx: '2' }],
    ['path', { d: 'M9.5 8h5' }],
    ['path', { d: 'M9.5 12H16' }],
    ['path', { d: 'M9.5 16H14' }],
  ],
  guide: [
    ['path', { d: 'M12 5v16' }],
    ['path', { d: 'M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z' }],
  ],
  vaccine: [
    ['path', { d: 'm18 2 4 4' }],
    ['path', { d: 'm17 7 3-3' }],
    ['path', { d: 'M19 9 8.7 19.3c-1 1-2.5 1-3.4 0l-.6-.6c-1-1-1-2.5 0-3.4L15 5' }],
    ['path', { d: 'm9 11 4 4' }],
    ['path', { d: 'm5 19-3 3' }],
    ['path', { d: 'm14 4 6 6' }],
  ],
  stats: [
    ['path', { d: 'M5 21v-6' }],
    ['path', { d: 'M12 21V9' }],
    ['path', { d: 'M19 21V3' }],
  ],
  'chevron-left': [['path', { d: 'm15 18-6-6 6-6' }]],
  'chevron-right': [['path', { d: 'm9 18 6-6-6-6' }]],
  'chevron-down': [['path', { d: 'm6 9 6 6 6-6' }]],
  minus: [['path', { d: 'M5 12h14' }]],
  plus: [['path', { d: 'M5 12h14' }], ['path', { d: 'M12 5v14' }]],
  // 行内操作（与原 App 的 Edit2 / Trash2 同义）
  edit: [
    ['path', { d: 'M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z' }],
    ['path', { d: 'm15 5 4 4' }],
  ],
  delete: [
    ['path', { d: 'M10 11v6' }],
    ['path', { d: 'M14 11v6' }],
    ['path', { d: 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6' }],
    ['path', { d: 'M3 6h18' }],
    ['path', { d: 'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' }],
  ],
};

const attr = (name, value) => `${name}="${value}"`;

/** 画布 30x30，图标本体 24x24 居中，四周留 3 单位留白。 */
function buildSvg(node, { canvas, stroke, strokeWidth }) {
  const body = node
    .map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).map(([k, v]) => attr(k, v)).join(' ')}/>`)
    .join('');
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas}" height="${canvas}" viewBox="0 0 30 30" fill="none"`,
    ` stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">`,
    `<g transform="translate(3 3)">${body}</g></svg>`,
  ].join('');
}

function render(svg, canvas) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: canvas },
    background: 'rgba(0,0,0,0)',
  });
  return resvg.render().asPng();
}

// 主色调为鼠尾草绿；夜间模式需要浅色版本（PNG 无法跟着 prefers-color-scheme 变色）
const PALETTE = {
  light: {
    tab: '#8d9994',
    tabActive: '#4f7d69',
    settings: { baby: '#c08861', cloud: '#5f9b81', privacy: '#7d86b0', storage: '#bd9163' },
    action: { edit: '#6c7570', delete: '#c07d72', back: '#535f5a', forward: '#8a9590', down: '#8a9590', minus: '#535f5a', plus: '#4f7d69' },
    status: { check: '#4f7d69', help: '#a06a37' },
  },
  dark: {
    tab: '#869590',
    tabActive: '#86b39a',
    settings: { baby: '#e0a87f', cloud: '#86c8ab', privacy: '#a3abd8', storage: '#d9b183' },
    action: { edit: '#a6b3ad', delete: '#cf9184', back: '#c9d4ce', forward: '#8a9590', down: '#8a9590', minus: '#c9d4ce', plus: '#86b39a' },
    status: { check: '#86b39a', help: '#d9a06a' },
  },
};

const outputs = [];
function write(file, svg, canvas) {
  const png = render(svg, canvas);
  fs.writeFileSync(path.join(ASSETS, file), png);
  outputs.push(`${file}  ${png.length} B`);
}

await initWasm(fs.readFileSync(WASM));

const TAB_PAIRS = [
  ['index', 'house'],
  ['records', 'records'],
  ['guide', 'guide'],
  ['vaccine', 'vaccine'],
  ['stats', 'stats'],
];
const SETTINGS_MAP = {
  baby: 'users',
  cloud: 'cloud',
  privacy: 'shield-check',
  storage: 'database',
};

/** 每个主题各生成一套，夜间模式由页面按后缀切换 src。 */
for (const [mode, colors] of Object.entries(PALETTE)) {
  const suffix = mode === 'dark' ? '-dark' : '';

  // tabBar 图标：81x81，未选中细一档、选中略粗且用主色绿
  for (const [name, icon] of TAB_PAIRS) {
    write(`tab-${name}${suffix}.png`, buildSvg(ICONS[icon], { canvas: 81, stroke: colors.tab, strokeWidth: 1.7 }), 81);
  }
  for (const [name, icon] of TAB_PAIRS) {
    write(`tab-${name}-active${suffix}.png`, buildSvg(ICONS[icon], { canvas: 81, stroke: colors.tabActive, strokeWidth: 2.1 }), 81);
  }

  // 设置页图标：96x96（展示尺寸约 23px，线条粗细接近 1.6px）
  for (const [name, icon] of Object.entries(SETTINGS_MAP)) {
    write(`settings-${name}${suffix}.png`, buildSvg(ICONS[icon], { canvas: 96, stroke: colors.settings[name], strokeWidth: 2 }), 96);
  }

  // 行内图标：返回/展开箭头 96x96（展示 16px），加减号用较粗的描边保证小尺寸清晰
  const actions = { back: 'chevron-left', forward: 'chevron-right', down: 'chevron-down' };
  for (const [name, icon] of Object.entries(actions)) {
    write(`action-${name}${suffix}.png`, buildSvg(ICONS[icon], { canvas: 96, stroke: colors.action[name], strokeWidth: 2.6 }), 96);
  }
  for (const name of ['edit', 'delete']) {
    write(`action-${name}${suffix}.png`, buildSvg(ICONS[name], { canvas: 96, stroke: colors.action[name], strokeWidth: 2 }), 96);
  }
  for (const name of ['minus', 'plus']) {
    write(`action-${name}${suffix}.png`, buildSvg(ICONS[name], { canvas: 96, stroke: colors.action[name], strokeWidth: 2.6 }), 96);
  }

  // 疫苗状态图标：60x60（展示 30rpx ≈ 15px）
  for (const [name, icon] of Object.entries({ check: 'circle-check', help: 'circle-help' })) {
    write(`status-${name}${suffix}.png`, buildSvg(ICONS[icon], { canvas: 60, stroke: colors.status[name], strokeWidth: 2.4 }), 60);
  }
}

console.log(outputs.join('\n'));
