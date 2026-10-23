/** Original canvas artwork: rounded storybook scenery and an outrageously fussy banker. */
type Brush = CanvasRenderingContext2D;
export type ComicMood = 'idle' | 'smug' | 'demand' | 'anger' | 'shock';
const INK = '#303044';

function oval(g: Brush, x: number, y: number, rx: number, ry: number, color: string, outline = true) {
  g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fillStyle = color; g.fill();
  if (outline) g.stroke();
}
function shape(g: Brush, points: number[][], color: string, close = true) {
  g.beginPath(); points.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y));
  if (close) { g.closePath(); g.fillStyle = color; g.fill(); }
  g.stroke();
}
function line(g: Brush, points: number[][], color = INK, width = 3) {
  const old = g.lineWidth; g.lineWidth = width; g.strokeStyle = color;
  shape(g, points, color, false); g.lineWidth = old; g.strokeStyle = INK;
}
function puff(g: Brush, x: number, y: number, size: number) {
  g.save(); g.translate(x, y); g.scale(size, size);
  // One continuous silhouette keeps the cloud soft and readable at phone size.
  g.beginPath(); g.moveTo(-54, 13); g.bezierCurveTo(-79, 7, -68, -21, -43, -18);
  g.bezierCurveTo(-39, -47, 4, -48, 11, -22); g.bezierCurveTo(38, -41, 66, -13, 50, 2);
  g.bezierCurveTo(84, 12, 62, 35, 38, 30); g.lineTo(-42, 30); g.quadraticCurveTo(-62, 29, -54, 13);
  g.fillStyle = '#e3f4f1'; g.fill(); g.strokeStyle = '#6397a1'; g.lineWidth = 2.5; g.stroke();
  oval(g, -24, -3, 34, 20, '#ffffff', false); oval(g, 19, 5, 27, 19, '#ffffff', false);
  g.restore();
}
function tree(g: Brush, x: number, ground: number, size: number, color: string) {
  g.save(); g.translate(x, ground); g.scale(size, size); g.lineWidth = 4; g.strokeStyle = INK;
  shape(g, [[-8, 0], [-7, -46], [4, -52], [10, 0]], '#c58d5b');
  line(g, [[0, -27], [18, -44]], '#795840', 4);
  oval(g, -19, -62, 27, 28, color); oval(g, 19, -66, 29, 30, color); oval(g, 0, -87, 32, 30, color);
  oval(g, -10, -95, 15, 9, '#ffffff35', false); g.restore();
}

export function drawCartoonWorld(g: Brush, width: number, height: number, fieldTop: number, country: string, time: number, night: number, reduceMotion: boolean): void {
  g.save(); g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = INK; g.lineWidth = 4;
  const dark = Math.max(0, Math.min(1, night));
  const palette = country === 'BR' ? ['#91d9f3', '#b6d56a', '#77ba69', '#c78256', '#b56d49']
    : country === 'FR' ? ['#a6dff4', '#c6d890', '#9fb774', '#d69869', '#c88c60']
    : country === 'JP' ? ['#a5dff1', '#b7d994', '#80b58c', '#c89b76', '#b78b68']
    : ['#9adff5', '#c1df87', '#8ac878', '#cf9865', '#c08a59'];
  g.fillStyle = palette[0]; g.fillRect(0, 0, width, height);
  const drift = reduceMotion ? 0 : Math.sin(time * .045) * 35;
  const sunX = width * .15, sunY = 56;
  g.save(); g.translate(sunX, sunY); g.rotate(reduceMotion ? .1 : time * .025);
  for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5; line(g, [[Math.cos(a) * 37, Math.sin(a) * 37], [Math.cos(a) * 45, Math.sin(a) * 45]], '#edb849', 5); }
  g.restore();
  oval(g, sunX, sunY, 29, 29, '#ffe987');
  oval(g, sunX - 9, sunY - 1, 2.5, 3.5, INK, false); oval(g, sunX + 9, sunY - 1, 2.5, 3.5, INK, false);
  g.beginPath(); g.arc(sunX, sunY + 2, 10, .2, Math.PI - .2); g.stroke();
  puff(g, width * .39 + drift, 60, .8); puff(g, width * .72 - drift * .5, 42, .57);
  g.fillStyle = palette[1]; g.beginPath(); g.moveTo(0, fieldTop);
  g.lineTo(0, 154); g.bezierCurveTo(width * .18, 85, width * .27, 168, width * .48, 133);
  g.bezierCurveTo(width * .72, 78, width * .86, 121, width, 135); g.lineTo(width, fieldTop); g.fill();
  g.fillStyle = palette[2]; g.beginPath(); g.moveTo(0, fieldTop); g.lineTo(0, 174);
  g.bezierCurveTo(width * .23, 130, width * .39, 202, width * .58, 171);
  g.bezierCurveTo(width * .8, 132, width * .91, 167, width, 167); g.lineTo(width, fieldTop); g.fill();
  tree(g, width * .065, fieldTop - 12, .85, country === 'JP' ? '#f3b0b7' : '#74b966');
  tree(g, width * .24, fieldTop - 15, .65, country === 'FR' ? '#9b99bd' : '#9acb65');
  tree(g, width * .96, fieldTop - 9, 1, country === 'JP' ? '#f5bdca' : '#70b277');
  // A squat, crooked barn with a huge door: a farm built by cartoon people.
  g.save(); g.translate(width * .55, fieldTop - 21);
  shape(g, [[-62, 0], [-60, -67], [-9, -103], [56, -67], [61, 0]], '#ef8075');
  shape(g, [[-74, -64], [-12, -115], [72, -66], [62, -53], [-9, -91], [-66, -52]], '#566b83');
  shape(g, [[-31, 0], [-31, -54], [30, -54], [34, 0]], '#ffe6a9');
  line(g, [[-26, -48], [27, -5]], '#bd7860', 4); line(g, [[27, -48], [-26, -5]], '#bd7860', 4);
  line(g, [[0, -52], [1, 0]], '#bd7860', 3);
  oval(g, -7, -76, 12, 12, '#fff0b4'); line(g, [[-7, -86], [-7, -66]], '#8c725d', 3);
  g.restore();
  g.fillStyle = palette[3]; g.fillRect(0, fieldTop, width, height - fieldTop);
  // Broad flat furrows replace photographic dirt and noisy microtexture.
  for (let i = 0; i < 6; i++) {
    const y = fieldTop + 28 + i * (height - fieldTop) / 5.5;
    g.fillStyle = palette[4]; g.beginPath(); g.moveTo(0, y);
    g.quadraticCurveTo(width * .5, y - 23, width, y + 2); g.lineTo(width, y + 18);
    g.quadraticCurveTo(width * .5, y - 4, 0, y + 18); g.fill();
  }
  g.fillStyle = '#84b966'; g.fillRect(0, fieldTop - 9, width, 13);
  g.strokeStyle = '#4c4b48'; g.lineWidth = 3;
  g.fillStyle = '#ffe5ac'; g.fillRect(0, fieldTop - 30, width, 11); g.strokeRect(-4, fieldTop - 30, width + 8, 11);
  g.fillRect(0, fieldTop - 9, width, 10); g.strokeRect(-4, fieldTop - 9, width + 8, 10);
  const fenceGap = 73;
  for (let x = 17; x < width + 20; x += fenceGap) {
    shape(g, [[x - 7, fieldTop + 4], [x - 7, fieldTop - 38], [x, fieldTop - 45], [x + 8, fieldTop - 37], [x + 8, fieldTop + 4]], '#fff0c1');
  }
  if (dark > 0) { g.fillStyle = `rgba(38,43,87,${dark * .47})`; g.fillRect(0, 0, width, height); }
  g.restore();
}

export function drawComicArthur(g: Brush, x: number, groundY: number, time: number, mood: ComicMood, reducedMotion: boolean): void {
  g.save(); g.translate(x, groundY); g.scale(.9,.9); g.strokeStyle = INK; g.lineWidth = 3.5; g.lineCap = 'round'; g.lineJoin = 'round';
  const angry = mood === 'anger', shocked = mood === 'shock', smug = mood === 'smug', demand = mood === 'demand';
  const bob = reducedMotion ? 0 : Math.sin(time * (angry ? 8 : 2.8)) * (angry ? 2 : 1.8);
  oval(g, 0, 0, 39, 7, '#44344622', false);
  oval(g, -17, -5, 16, 7, '#35364c'); oval(g, 18, -5, 16, 7, '#35364c');
  g.translate(0, bob); shape(g, [[-24, -17], [-23, -42], [23, -42], [24, -17]], '#49556c');
  line(g, [[0, -35], [0, -12]], '#2e344c', 4);
  oval(g, 0, -54, 38, 37, '#536981');
  shape(g, [[-17, -85], [0, -48], [17, -85]], '#fff4d7');
  shape(g, [[-23, -84], [-9, -87], [0, -48], [-24, -66], [-17, -71]], '#6e86a0');
  shape(g, [[23, -84], [9, -87], [0, -48], [24, -66], [17, -71]], '#6e86a0');
  oval(g, 0, -35, 3, 3, '#ffd778', false);
  // A tiny waistcoat chain is a single bold curve, readable without fine detail.
  g.strokeStyle = '#f4cf68'; g.lineWidth = 3; g.beginPath(); g.moveTo(4, -44); g.quadraticCurveTo(18, -23, 29, -45); g.stroke(); g.strokeStyle = INK;
  const wave = reducedMotion ? 0 : Math.sin(time * 4) * 5;
  line(g, [[-31, -65], [-43, -43]], '#536981', 14); oval(g, -43, -42, 9, 9, '#f4c198');
  line(g, [[30, -66], [demand || angry ? 49 : 43, demand || angry ? -96 - wave : -45]], '#536981', 14);
  const handX = demand || angry ? 49 : 43, handY = demand || angry ? -99 - wave : -44;
  oval(g, handX, handY, 9, 9, '#f4c198');
  if (demand || angry) line(g, [[handX + 2, handY - 2], [handX + 3, handY - 18]], '#f4c198', 7);
  else { g.save(); g.translate(43, -43); g.rotate(-.1); shape(g, [[-9, -9], [10, -9], [10, 15], [-9, 15]], '#fff3c9'); line(g, [[-4, -3], [5, -3]], '#b59d79', 2); line(g, [[-4, 3], [5, 3]], '#b59d79', 2); g.restore(); }
  oval(g, -31, -110, 8, 11, '#efb88f'); oval(g, 31, -110, 8, 11, '#efb88f');
  oval(g, 0, -111, 34, 35, angry ? '#f2b09a' : '#ffd1a2');
  oval(g, -23, -101, 8, 5, '#ed9a83', false); oval(g, 23, -101, 8, 5, '#ed9a83', false);
  const eyesY = shocked ? -117 : -114;
  oval(g, -13, eyesY, 8, shocked ? 11 : smug ? 5 : 8, '#fff8e6'); oval(g, 12, eyesY, 8, shocked ? 11 : 8, '#fff8e6');
  oval(g, -12 + (smug ? 2 : 0), eyesY, 2.8, 4, INK, false); oval(g, 13, eyesY, 2.8, 4, INK, false);
  g.strokeStyle = '#c68d36'; g.lineWidth = 3; g.beginPath(); g.arc(12, eyesY, 11, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.moveTo(23, eyesY + 3); g.quadraticCurveTo(34, -92, 29, -77); g.stroke(); g.strokeStyle = INK;
  if (angry) { line(g, [[-23, -128], [-7, -123]], INK, 4); line(g, [[6, -123], [23, -128]], INK, 4); }
  else { line(g, [[-22, shocked ? -136 : -129], [-7, shocked ? -138 : -131]], INK, 4); line(g, [[6, shocked ? -138 : -132], [21, shocked ? -135 : -128]], INK, 4); }
  oval(g, 0, -105, 9, 6, '#eeb388');
  if (shocked) oval(g, 0, -88, 7, 9, '#633d46');
  else { g.beginPath(); g.moveTo(-10, -88); g.quadraticCurveTo(2, smug ? -76 : -83, 13, smug ? -91 : -88); g.stroke(); }
  // Two enormous moustache curls and a bow tie make the silhouette Arthur's own.
  g.fillStyle = '#665046'; g.beginPath(); g.moveTo(0, -100); g.bezierCurveTo(-7, -110, -16, -92, -25, -102); g.bezierCurveTo(-24, -88, -8, -89, 0, -98); g.bezierCurveTo(8, -89, 24, -88, 25, -102); g.bezierCurveTo(16, -92, 7, -110, 0, -100); g.fill(); g.stroke();
  shape(g, [[0, -76], [-13, -83], [-13, -68]], '#e9a653'); shape(g, [[0, -76], [13, -83], [13, -68]], '#e9a653'); oval(g, 0, -76, 4, 5, '#ffce76');
  g.save(); g.translate(0, shocked ? -7 : 0); g.rotate(angry ? -.09 : smug ? .07 : -.03);
  shape(g, [[-26, -145], [-24, -178], [22, -178], [27, -145]], '#364b63');
  shape(g, [[-26, -153], [25, -153], [26, -144], [-26, -144]], '#eac364'); oval(g, 0, -144, 43, 7, '#405b75');
  g.restore();
  if (shocked || angry || demand) {
    g.font = '900 28px sans-serif'; g.textAlign = 'center'; g.strokeStyle = '#fff6d4'; g.lineWidth = 5;
    const text = shocked ? '?' : '!'; g.strokeText(text, -48, -143); g.fillStyle = angry ? '#e75b5f' : '#ffe079'; g.fillText(text, -48, -143);
  }
  g.restore();
}
