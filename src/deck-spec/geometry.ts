import type { DiagramContent, PresentationSpec, SlideElement, SlideSpec } from './types';
import { newSpecId } from './validate';
import { renewElementIds } from './ops';

export interface Box { x: number; y: number; w: number; h: number; }
export type GeometryMap = Record<string, Box>;
export function elementBox(element: SlideElement, resolved: GeometryMap = {}): Box {
  return resolved[element.id] || { x: element.position.x || 0, y: element.position.y || 0, w: typeof element.size.w === 'number' ? element.size.w : 240, h: typeof element.size.h === 'number' ? element.size.h : 80 };
}
export function bounds(boxes: Box[]): Box {
  if (!boxes.length) return { x: 0, y: 0, w: 0, h: 0 };
  const x = Math.min(...boxes.map(box => box.x)), y = Math.min(...boxes.map(box => box.y));
  return { x, y, w: Math.max(...boxes.map(box => box.x + box.w)) - x, h: Math.max(...boxes.map(box => box.y + box.h)) - y };
}
export function allElements(elements: SlideElement[]): SlideElement[] {
  return elements.flatMap(element => [element, ...(element.content.kind === 'group' ? allElements(element.content.children) : [])]);
}
export function selectionBox(slide: SlideSpec, ids: string[], resolved: GeometryMap = {}): Box {
  return bounds(allElements(slide.elements).filter(element => ids.includes(element.id)).map(element => elementBox(element, resolved)));
}
function mutate(spec: PresentationSpec, slideId: string, work: (slide: SlideSpec) => void): PresentationSpec {
  const next = { ...spec, slides: spec.slides.map(item => item.id === slideId ? structuredClone(item) : item) }, slide = next.slides.find(item => item.id === slideId);
  if (slide) work(slide);
  return next;
}
export function moveSelection(spec: PresentationSpec, slideId: string, ids: string[], dx: number, dy: number, resolved: GeometryMap = {}): PresentationSpec {
  return mutate(spec, slideId, slide => {
    const chosen = allElements(slide.elements).filter(element => ids.includes(element.id) && !element.locked);
    const box = bounds(chosen.map(element => elementBox(element, resolved)));
    dx = Math.max(-box.x, Math.min(spec.canvas.width - box.x - box.w, dx));
    dy = Math.max(-box.y, Math.min(spec.canvas.height - box.y - box.h, dy));
    for (const element of chosen) {
      const current = elementBox(element, resolved);
      element.position = { ...element.position, mode: 'absolute', x: Math.round(current.x + dx), y: Math.round(current.y + dy) };
      element.size = { w: current.w, h: current.h };
    }
  });
}
function scaleChildren(element: SlideElement, sx: number, sy: number) {
  if (element.content.kind !== 'group') return;
  for (const child of element.content.children) {
    child.position.x = (child.position.x || 0) * sx; child.position.y = (child.position.y || 0) * sy;
    if (typeof child.size.w === 'number') child.size.w *= sx;
    if (typeof child.size.h === 'number') child.size.h *= sy;
    if (child.style.fontSize) child.style.fontSize *= Math.min(sx, sy);
    scaleChildren(child, sx, sy);
  }
}
export function resizeSelection(spec: PresentationSpec, slideId: string, ids: string[], target: Box, resolved: GeometryMap = {}): PresentationSpec {
  return mutate(spec, slideId, slide => {
    const chosen = allElements(slide.elements).filter(element => ids.includes(element.id) && !element.locked), old = bounds(chosen.map(element => elementBox(element, resolved)));
    const sx = Math.max(0.03, target.w / Math.max(1, old.w)), sy = Math.max(0.03, target.h / Math.max(1, old.h));
    for (const element of chosen) {
      const box = elementBox(element, resolved);
      element.position = { ...element.position, mode: 'absolute', x: target.x + (box.x - old.x) * sx, y: target.y + (box.y - old.y) * sy };
      element.size = { w: Math.max(12, box.w * sx), h: Math.max(8, box.h * sy) };
      scaleChildren(element, sx, sy);
    }
  });
}
const rotatePoint = (x: number, y: number, cx: number, cy: number, angle: number) => {
  const rad = angle * Math.PI / 180, dx = x - cx, dy = y - cy;
  return { x: cx + dx * Math.cos(rad) - dy * Math.sin(rad), y: cy + dx * Math.sin(rad) + dy * Math.cos(rad) };
};
export function rotateSelection(spec: PresentationSpec, slideId: string, ids: string[], degrees: number, resolved: GeometryMap = {}): PresentationSpec {
  return mutate(spec, slideId, slide => {
    const chosen = allElements(slide.elements).filter(element => ids.includes(element.id) && !element.locked), box = bounds(chosen.map(element => elementBox(element, resolved)));
    for (const element of chosen) {
      const current = elementBox(element, resolved), point = rotatePoint(current.x + current.w / 2, current.y + current.h / 2, box.x + box.w / 2, box.y + box.h / 2, degrees);
      element.position = { ...element.position, mode: 'absolute', x: point.x - current.w / 2, y: point.y - current.h / 2 };
      element.size = { w: current.w, h: current.h }; element.rotation = ((element.rotation || 0) + degrees) % 360;
    }
  });
}
export function groupSelection(spec: PresentationSpec, slideId: string, ids: string[], resolved: GeometryMap = {}): { spec: PresentationSpec; id: string | null } {
  const next = { ...spec, slides: spec.slides.map(item => item.id === slideId ? structuredClone(item) : item) }, slide = next.slides.find(item => item.id === slideId);
  if (!slide) return { spec, id: null };
  const chosen = slide.elements.filter(element => ids.includes(element.id) && !element.locked);
  if (chosen.length < 2) return { spec, id: null };
  const box = bounds(chosen.map(element => elementBox(element, resolved))), id = newSpecId();
  const at = Math.min(...chosen.map(element => slide.elements.indexOf(element)));
  const group: SlideElement = { id, type: 'group', position: { mode: 'absolute', x: box.x, y: box.y }, size: { w: box.w, h: box.h }, rotation: 0, locked: false, style: {}, animation: { preset: 'none', delayMs: 0 }, metadata: {}, content: { kind: 'group', children: chosen.map(element => { const childBox = elementBox(element, resolved); return { ...element, groupId: id, position: { ...element.position, mode: 'absolute', x: childBox.x - box.x, y: childBox.y - box.y }, size: { w: childBox.w, h: childBox.h } }; }) } };
  slide.elements = slide.elements.filter(element => !chosen.includes(element)); slide.elements.splice(at, 0, group);
  return { spec: next, id };
}
export function ungroupSelection(spec: PresentationSpec, slideId: string, ids: string[]): { spec: PresentationSpec; ids: string[] } {
  const selected: string[] = [];
  const next = mutate(spec, slideId, slide => {
    slide.elements = slide.elements.flatMap(group => {
      if (!ids.includes(group.id) || group.locked || group.content.kind !== 'group') return [group];
      const box = elementBox(group);
      return group.content.children.map(child => {
        const own = elementBox(child), centre = rotatePoint(box.x + own.x + own.w / 2, box.y + own.y + own.h / 2, box.x + box.w / 2, box.y + box.h / 2, group.rotation || 0);
        delete child.groupId; child.position = { ...child.position, mode: 'absolute', x: centre.x - own.w / 2, y: centre.y - own.h / 2 }; child.rotation = (child.rotation || 0) + (group.rotation || 0); selected.push(child.id); return child;
      });
    });
  });
  return { spec: next, ids: selected };
}
export function alignSelection(spec: PresentationSpec, slideId: string, ids: string[], alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom' | 'distribute-x' | 'distribute-y', resolved: GeometryMap = {}): PresentationSpec {
  return mutate(spec, slideId, slide => {
    const elements = allElements(slide.elements).filter(element => ids.includes(element.id) && !element.locked), chosen = elements.map(element => ({ element, box: elementBox(element, resolved) }));
    const selection = chosen.length === 1 ? { x: 0, y: 0, w: spec.canvas.width, h: spec.canvas.height } : bounds(chosen.map(item => item.box));
    if (alignment.startsWith('distribute')) {
      const vertical = alignment.endsWith('y'), axis = vertical ? 'y' : 'x', size = vertical ? 'h' : 'w';
      chosen.sort((a, b) => a.box[axis] - b.box[axis]);
      const gap = (selection[size] - chosen.reduce((sum, item) => sum + item.box[size], 0)) / Math.max(1, chosen.length - 1);
      let cursor = selection[axis];
      for (const item of chosen) { item.element.position = { ...item.element.position, mode: 'absolute', x: item.box.x, y: item.box.y, [axis]: cursor }; item.element.size = { w: item.box.w, h: item.box.h }; cursor += item.box[size] + gap; }
      return;
    }
    for (const { element, box } of chosen) {
      let { x, y } = box;
      if (alignment === 'left') x = selection.x;
      if (alignment === 'center') x = selection.x + (selection.w - box.w) / 2;
      if (alignment === 'right') x = selection.x + selection.w - box.w;
      if (alignment === 'top') y = selection.y;
      if (alignment === 'middle') y = selection.y + (selection.h - box.h) / 2;
      if (alignment === 'bottom') y = selection.y + selection.h - box.h;
      element.position = { ...element.position, mode: 'absolute', x, y }; element.size = { w: box.w, h: box.h };
    }
  });
}
export function duplicateSelection(spec: PresentationSpec, slideId: string, ids: string[], resolved: GeometryMap = {}): { spec: PresentationSpec; ids: string[] } {
  const newIds: string[] = [];
  const next = mutate(spec, slideId, slide => {
    const chosen = slide.elements.filter(element => ids.includes(element.id));
    for (const original of chosen) { const element = renewElementIds(original), box = elementBox(original, resolved); element.position = { ...element.position, mode: 'absolute', x: Math.min(1280 - box.w, box.x + 24), y: Math.min(720 - box.h, box.y + 24) }; element.size = { w: box.w, h: box.h }; element.locked = false; slide.elements.push(element); newIds.push(element.id); }
  });
  return { spec: next, ids: newIds };
}
export interface Guide { axis: 'x' | 'y'; value: number; }
export function snapPosition(box: Box, others: Box[], canvas: { width: number; height: number }, threshold = 6, grid = false): { x: number; y: number; guides: Guide[] } {
  let x = grid ? Math.round(box.x / 8) * 8 : box.x, y = grid ? Math.round(box.y / 8) * 8 : box.y;
  const guides: Guide[] = [];
  const axes = [{ axis: 'x' as const, start: x, size: box.w, anchors: [0, canvas.width / 2, canvas.width, ...others.flatMap(other => [other.x, other.x + other.w / 2, other.x + other.w])] }, { axis: 'y' as const, start: y, size: box.h, anchors: [0, canvas.height / 2, canvas.height, ...others.flatMap(other => [other.y, other.y + other.h / 2, other.y + other.h])] }];
  for (const { axis, start, size, anchors } of axes) {
    let best = threshold + 1, change = 0, anchor = 0;
    for (const candidate of anchors) for (const offset of [0, size / 2, size]) { const delta = candidate - start - offset; if (Math.abs(delta) < best) { best = Math.abs(delta); change = delta; anchor = candidate; } }
    if (best <= threshold) { if (axis === 'x') x += change; else y += change; guides.push({ axis, value: anchor }); }
  }
  return { x, y, guides };
}

/** Native PPTX uses the same nested group geometry as the browser. */
export function flattenElements(elements: SlideElement[], origin = { x: 0, y: 0, rotation: 0, cx: 0, cy: 0 }): SlideElement[] {
  return elements.filter(element => !element.hidden).sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0)).flatMap(element => {
    const box = elementBox(element), centre = rotatePoint(origin.x + box.x + box.w / 2, origin.y + box.y + box.h / 2, origin.cx, origin.cy, origin.rotation);
    const placed = { ...element, position: { ...element.position, mode: 'absolute' as const, x: centre.x - box.w / 2, y: centre.y - box.h / 2 }, rotation: (element.rotation || 0) + origin.rotation };
    if (element.content.kind !== 'group') return [placed];
    return flattenElements(element.content.children, { x: placed.position.x, y: placed.position.y, cx: centre.x, cy: centre.y, rotation: placed.rotation });
  });
}
export function diagramGeometry(content: DiagramContent, width: number, height: number) {
  if (content.layout === 'cycle') {
    const w = Math.min(240, width / 3), h = Math.min(120, height / 2.5), rx = Math.max(0, width / 2 - w / 2 - 8), ry = Math.max(0, height / 2 - h / 2 - 8);
    return content.nodes.map((node, i) => ({ ...node, x: width / 2 + rx * Math.cos(-Math.PI / 2 + i * 2 * Math.PI / Math.max(1, content.nodes.length)) - w / 2, y: height / 2 + ry * Math.sin(-Math.PI / 2 + i * 2 * Math.PI / Math.max(1, content.nodes.length)) - h / 2, w, h }));
  }
  const count = content.nodes.length, cols = content.layout === 'architecture' ? Math.min(3, count) : Math.min(4, count), rows = Math.max(1, Math.ceil(count / Math.max(1, cols))), gap = 30;
  const w = (width - gap * (cols - 1)) / Math.max(1, cols), h = (height - gap * (rows - 1)) / rows;
  return content.nodes.map((node, i) => ({ ...node, x: (i % Math.max(1, cols)) * (w + gap), y: Math.floor(i / Math.max(1, cols)) * (h + gap), w, h }));
}
