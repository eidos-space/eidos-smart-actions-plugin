export const actionIcons = {
  sparkles: {
    label: "智能",
    paths: ["m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"],
  },
  tag: {
    label: "分类",
    paths: [
      "M20 13 13 20a2 2 0 0 1-3 0L3 13V3h10l7 7a2 2 0 0 1 0 3Z",
      "M7 7h.01",
    ],
  },
  check: {
    label: "检查",
    paths: ["M9 12l2 2 4-4", "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z"],
  },
  chart: { label: "评分", paths: ["M4 3v17h17", "M8 16v-5m5 5V7m5 9V4"] },
  flag: { label: "标记", paths: ["M4 22V3c6-4 10 4 16 0v12c-6 4-10-4-16 0"] },
  text: { label: "文本", paths: ["M4 5h16M4 10h16M4 15h10M4 20h7"] },
  globe: {
    label: "语言",
    paths: [
      "M3 12h18",
      "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z",
      "M12 3c-5 5-5 13 0 18 5-5 5-13 0-18Z",
    ],
  },
  bolt: { label: "执行", paths: ["m13 2-9 12h7l-1 8 10-12h-7l1-8Z"] },
} as const
export type ActionIcon = keyof typeof actionIcons
export function iconDefinition(name?: ActionIcon) {
  return { paths: [...actionIcons[name ?? "sparkles"].paths] }
}
export function iconElement(name?: ActionIcon): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
  for (const [key, value] of Object.entries({
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": "1.7",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    "aria-hidden": "true",
  }))
    svg.setAttribute(key, value)
  for (const d of iconDefinition(name).paths) {
    const path = document.createElementNS(svg.namespaceURI, "path")
    path.setAttribute("d", d)
    svg.append(path)
  }
  return svg
}
