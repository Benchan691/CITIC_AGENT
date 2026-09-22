const SAFE_ELEMENTS = new Set([
  'a', 'article', 'aside', 'blockquote', 'br', 'caption', 'code', 'col', 'colgroup',
  'div', 'em', 'figcaption', 'figure', 'footer', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'body', 'head', 'header', 'hr', 'html', 'i', 'li', 'main', 'ol', 'p', 'pre', 'section',
  'small', 'span', 'strong', 'style', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead',
  'title', 'tr', 'u', 'ul',
])

const REMOVE_ELEMENTS = new Set([
  'applet', 'base', 'embed', 'form', 'iframe', 'img', 'input', 'link', 'meta', 'object',
  'script', 'select', 'textarea', 'video', 'audio', 'source', 'track', 'svg', 'math',
])

const SAFE_ATTRIBUTES = new Set([
  'align', 'aria-label', 'aria-hidden', 'class', 'colspan', 'id', 'lang', 'name',
  'role', 'rowspan', 'style', 'title', 'valign', 'width',
])

const SAFE_CSS_PROPERTIES = new Set([
  'background', 'background-color', 'border', 'border-collapse', 'border-radius',
  'border-spacing', 'color', 'display', 'font-family', 'font-size', 'font-style',
  'font-weight', 'height', 'line-height', 'margin', 'margin-bottom', 'margin-left',
  'margin-right', 'margin-top', 'max-width', 'min-width', 'padding', 'padding-bottom',
  'padding-left', 'padding-right', 'padding-top', 'text-align', 'text-decoration',
  'vertical-align', 'white-space', 'width',
])

function safeUrl(value: string): boolean {
  const candidate = value.trim().toLowerCase()
  if (!candidate || candidate.startsWith('#') || candidate.startsWith('/') || candidate.startsWith('./') || candidate.startsWith('../')) return true
  return candidate.startsWith('https:') || candidate.startsWith('mailto:')
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function safeCssDeclarations(value: string): string {
  return value
    .split(';')
    .map(item => item.trim())
    .filter(Boolean)
    .map(item => {
      const separator = item.indexOf(':')
      if (separator <= 0) return null
      const property = item.slice(0, separator).trim().toLowerCase()
      const cssValue = item.slice(separator + 1).trim()
      if (!SAFE_CSS_PROPERTIES.has(property)) return null
      if (/url\s*\(|expression\s*\(|(?:javascript|vbscript|data):|@import|-moz-binding|behavior\s*:/iu.test(cssValue)) return null
      return `${property}: ${cssValue}`
    })
    .filter((item): item is string => Boolean(item))
    .join('; ')
}

function safeCssText(value: string): string {
  return value
    .replace(/\/\*[\s\S]*?\*\//gu, '')
    .replace(/@(?:import|font-face|namespace|supports|keyframes)[\s\S]*?(?:;|\{[\s\S]*?\})/giu, '')
    .replace(/([^{}]+)\{([^{}]*)\}/gu, (_match, selector: string, declarations: string) => {
      if (/[@{}]|url\s*\(|expression\s*\(|(?:javascript|vbscript|data):/iu.test(selector)) return ''
      const safeDeclarations = safeCssDeclarations(declarations)
      return safeDeclarations ? `${selector.trim()} { ${safeDeclarations}; }` : ''
    })
}

function unwrap(element: Element): void {
  const parent = element.parentNode
  if (!parent) return
  while (element.firstChild) parent.insertBefore(element.firstChild, element)
  parent.removeChild(element)
}

export function sanitizeEmailHtml(value: string): string {
  if (!value) return ''
  if (typeof DOMParser === 'undefined') return escapeHtml(value)
  const document = new DOMParser().parseFromString(String(value), 'text/html')
  for (const element of Array.from(document.querySelectorAll('*'))) {
    const tag = element.tagName.toLowerCase()
    if (REMOVE_ELEMENTS.has(tag)) {
      element.remove()
      continue
    }
    if (!SAFE_ELEMENTS.has(tag)) {
      unwrap(element)
      continue
    }
    if (tag === 'style') {
      element.textContent = safeCssText(element.textContent || '')
    }
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase()
      const attributeValue = attribute.value
      if (name.startsWith('on') || name === 'srcdoc' || name === 'srcset' || name === 'formaction' || name === 'action' || name === 'target') {
        element.removeAttribute(attribute.name)
      } else if (name === 'href') {
        if (!safeUrl(attributeValue)) element.removeAttribute(attribute.name)
      } else if (name === 'style') {
        const safeStyle = safeCssDeclarations(attributeValue)
        if (safeStyle) element.setAttribute('style', safeStyle)
        else element.removeAttribute(attribute.name)
      } else if (!SAFE_ATTRIBUTES.has(name)) {
        element.removeAttribute(attribute.name)
      }
    }
  }
  const headStyles = Array.from(document.head?.querySelectorAll('style') ?? [])
    .map(element => `<style>${safeCssText(element.textContent || '')}</style>`)
    .join('')
  return `${headStyles}${document.body?.innerHTML || ''}`
}

const PREVIEW_CSS = `
  :root { color-scheme: light dark; }
  body { box-sizing: border-box; margin: 0; padding: 16px; font: 14px/1.45 system-ui, sans-serif; overflow-wrap: anywhere; }
  *, *::before, *::after { box-sizing: inherit; }
  table { max-width: 100%; border-collapse: collapse; }
  td, th { padding: 4px 6px; border: 1px solid #9ca3af; }
  a { color: #2563eb; }
`

export function renderEmailPreviewDocument(value: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${PREVIEW_CSS}</style></head><body>${sanitizeEmailHtml(value)}</body></html>`
}
