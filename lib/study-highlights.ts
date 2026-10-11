import type { StudyHighlight } from "./study-types";

type Rect = { left: number; top: number; right: number; bottom: number };
// Relative coordinates keep text and area highlights aligned after resizing or switching devices.
export function relativeHighlight(rect: Rect, bounds: Rect): StudyHighlight | null {
  const width = bounds.right - bounds.left, height = bounds.bottom - bounds.top;
  if (width <= 0 || height <= 0) return null;
  const left = Math.max(rect.left, bounds.left), top = Math.max(rect.top, bounds.top);
  const right = Math.min(rect.right, bounds.right), bottom = Math.min(rect.bottom, bounds.bottom);
  if (right - left < 2 || bottom - top < 2) return null;
  return { x: (left - bounds.left) / width, y: (top - bounds.top) / height,
    width: (right - left) / width, height: (bottom - top) / height };
}

export function textHighlights(rects: Rect[], bounds: Rect): StudyHighlight[] {
  const highlights: StudyHighlight[] = [];
  for (const rect of rects) {
    const next = relativeHighlight(rect, bounds);
    if (next && !highlights.some((r) => ["x", "y", "width", "height"].every((key) => Math.abs(r[key as keyof StudyHighlight] - next[key as keyof StudyHighlight]) < 0.0001))) highlights.push(next);
    if (highlights.length === 100) break;
  }
  return highlights;
}
