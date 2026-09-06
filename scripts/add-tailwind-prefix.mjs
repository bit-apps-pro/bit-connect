#!/usr/bin/env node
/**
 * Tailwind CSS 'bc-' prefix migration script
 *
 * Adds 'bc-' prefix to all Tailwind utility classes across the source tree.
 * Only modifies string literals inside class="..." / className="..." attributes
 * and className={...} JSX expressions (including cn()/clsx() calls inside them).
 *
 * Usage:
 *   node scripts/add-tailwind-prefix.mjs [--dry-run] [target-dir]
 *
 * Skipped (reported but not modified):
 *   - Template literals with complex/nested interpolations
 *   - Classes that cannot be reliably identified as Tailwind
 */

import { execSync } from 'child_process'
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { join, extname, relative } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')

const DRY_RUN = process.argv.includes('--dry-run')
const FORCE = process.argv.includes('--force')

// This script rewrites source files in place. Refuse to run against a dirty
// git tree unless it's a dry run (or --force) so a bad run is always
// recoverable with `git restore .`.
if (!DRY_RUN && !FORCE) {
  try {
    const dirty = execSync('git status --porcelain', { cwd: ROOT, encoding: 'utf8' }).trim()
    if (dirty) {
      console.error(
        'Refusing to run: the git working tree has uncommitted changes.\n' +
          'Commit or stash first (so a bad run can be reverted), or pass --dry-run to preview, ' +
          'or --force to override.'
      )
      process.exit(1)
    }
  } catch {
    console.error('Refusing to run: not a git repository (cannot guarantee recoverability). Use --dry-run or --force.')
    process.exit(1)
  }
}
const TARGET_DIR =
  process.argv.find(a => !a.startsWith('--') && a !== process.argv[0] && a !== process.argv[1]) ||
  join(ROOT, 'frontend')

const PREFIX = 'bc-'

// ─────────────────────────────────────────────────────────────────────────────
// Tailwind detection
// ─────────────────────────────────────────────────────────────────────────────

// Known non-Tailwind classes that share Tailwind-like prefixes in this codebase
const NON_TAILWIND = new Set([
  'w-100', 'h-100', 'w-50', 'h-50', // Bootstrap / Ant Design sizing
])

// Standalone Tailwind utilities (no numeric/color suffix)
const TAILWIND_EXACT = new Set([
  // Display
  'block', 'inline-block', 'inline', 'flex', 'inline-flex',
  'table', 'inline-table', 'table-caption', 'table-cell', 'table-column',
  'table-column-group', 'table-footer-group', 'table-header-group',
  'table-row-group', 'table-row', 'flow-root', 'grid', 'inline-grid',
  'contents', 'list-item', 'hidden', 'subgrid',
  // Position
  'static', 'fixed', 'absolute', 'relative', 'sticky',
  // Flexbox
  'flex-row', 'flex-row-reverse', 'flex-col', 'flex-col-reverse',
  'flex-wrap', 'flex-wrap-reverse', 'flex-nowrap',
  'flex-1', 'flex-auto', 'flex-initial', 'flex-none',
  'grow', 'grow-0', 'shrink', 'shrink-0',
  // Grid
  'col-auto', 'row-auto',
  // Alignment
  'justify-normal', 'justify-start', 'justify-end', 'justify-center',
  'justify-between', 'justify-around', 'justify-evenly', 'justify-stretch',
  'items-start', 'items-end', 'items-center', 'items-baseline', 'items-stretch',
  'self-auto', 'self-start', 'self-end', 'self-center', 'self-stretch', 'self-baseline',
  'content-normal', 'content-center', 'content-start', 'content-end',
  'content-between', 'content-around', 'content-evenly', 'content-stretch',
  'place-content-center', 'place-content-start', 'place-content-end',
  'place-items-center', 'place-items-start', 'place-items-end',
  // Overflow
  'overflow-auto', 'overflow-hidden', 'overflow-clip', 'overflow-visible', 'overflow-scroll',
  // Overscroll
  'overscroll-auto', 'overscroll-contain', 'overscroll-none',
  // Typography
  'antialiased', 'subpixel-antialiased', 'italic', 'not-italic',
  'uppercase', 'lowercase', 'capitalize', 'normal-case',
  'truncate', 'text-ellipsis', 'text-clip',
  'text-wrap', 'text-nowrap', 'text-balance', 'text-pretty',
  'underline', 'overline', 'line-through', 'no-underline',
  'ordinal', 'slashed-zero', 'tabular-nums', 'lining-nums',
  'proportional-nums', 'oldstyle-nums', 'diagonal-fractions', 'stacked-fractions',
  // Transforms
  'transform', 'transform-cpu', 'transform-gpu', 'transform-none',
  // Interactivity
  'resize', 'resize-none', 'resize-y', 'resize-x',
  'appearance-none', 'appearance-auto',
  'select-none', 'select-text', 'select-all', 'select-auto',
  'pointer-events-none', 'pointer-events-auto',
  // Visibility
  'visible', 'invisible', 'collapse',
  // Accessibility
  'sr-only', 'not-sr-only',
  // Borders
  'border', 'border-solid', 'border-dashed', 'border-dotted', 'border-double', 'border-hidden', 'border-none',
  'divide-solid', 'divide-dashed', 'divide-dotted', 'divide-double', 'divide-none',
  'outline', 'outline-none', 'outline-dashed', 'outline-dotted', 'outline-double', 'outline-solid',
  'ring', 'ring-inset',
  // Shadows (standalone forms)
  'shadow', 'shadow-sm', 'shadow-md', 'shadow-lg', 'shadow-xl', 'shadow-2xl', 'shadow-inner', 'shadow-none',
  // Filters
  'blur', 'blur-none', 'grayscale', 'invert', 'sepia', 'drop-shadow',
  'backdrop-blur', 'backdrop-grayscale', 'backdrop-invert', 'backdrop-sepia',
  // Tables
  'border-collapse', 'border-separate', 'table-auto', 'table-fixed',
  'caption-top', 'caption-bottom',
  // Transitions (standalone forms)
  'transition', 'transition-none', 'transition-all', 'transition-colors',
  'transition-opacity', 'transition-shadow', 'transition-transform',
  // Float / Clear
  'float-right', 'float-left', 'float-none', 'float-start', 'float-end',
  'clear-left', 'clear-right', 'clear-both', 'clear-none', 'clear-start', 'clear-end',
  // Isolation
  'isolate', 'isolation-auto',
  // Object fit / position
  'object-contain', 'object-cover', 'object-fill', 'object-none', 'object-scale-down',
  'object-bottom', 'object-center', 'object-left', 'object-left-bottom', 'object-left-top',
  'object-right', 'object-right-bottom', 'object-right-top', 'object-top',
  // Box sizing
  'box-border', 'box-content',
  // Container
  'container',
  // Rounded (standalone forms)
  'rounded', 'rounded-sm', 'rounded-md', 'rounded-lg', 'rounded-xl',
  'rounded-2xl', 'rounded-3xl', 'rounded-full', 'rounded-none',
  // Will change
  'will-change-auto', 'will-change-scroll', 'will-change-contents', 'will-change-transform',
  // SVG
  'stroke',
  // Misc
  'line-clamp-none',
])

// Prefix patterns — utility string starts with one of these
const TAILWIND_PREFIXES = [
  // Backgrounds & Colors
  'bg-', 'text-', 'border-', 'ring-', 'ring-offset-', 'outline-',
  'divide-', 'from-', 'via-', 'to-', 'accent-', 'caret-',
  'fill-', 'stroke-', 'shadow-', 'drop-shadow-',
  // Spacing
  'p-', 'px-', 'py-', 'ps-', 'pe-', 'pt-', 'pr-', 'pb-', 'pl-',
  'm-', 'mx-', 'my-', 'ms-', 'me-', 'mt-', 'mr-', 'mb-', 'ml-',
  'space-x-', 'space-y-', 'gap-', 'gap-x-', 'gap-y-',
  // Sizing
  'w-', 'min-w-', 'max-w-', 'h-', 'min-h-', 'max-h-', 'size-',
  // Typography
  'font-', 'tracking-', 'leading-', 'indent-',
  'list-', 'placeholder-', 'decoration-', 'underline-offset-',
  'whitespace-', 'break-', 'hyphens-', 'align-',
  // Layout
  'inset-', 'top-', 'right-', 'bottom-', 'left-', 'start-', 'end-', 'z-',
  'overflow-x-', 'overflow-y-', 'overscroll-x-', 'overscroll-y-',
  'aspect-', 'columns-', 'break-after-', 'break-before-', 'break-inside-',
  'object-',
  // Flexbox & Grid
  'flex-', 'basis-', 'grow-', 'shrink-', 'order-',
  'grid-cols-', 'col-span-', 'col-start-', 'col-end-', 'col-',
  'grid-rows-', 'row-span-', 'row-start-', 'row-end-', 'row-', 'grid-flow-',
  'auto-cols-', 'auto-rows-',
  'justify-', 'justify-items-', 'justify-self-',
  'content-', 'items-', 'self-', 'place-content-', 'place-items-', 'place-self-',
  // Borders
  'border-x-', 'border-y-', 'border-t-', 'border-r-', 'border-b-', 'border-l-',
  'border-s-', 'border-e-',
  'rounded-', 'rounded-t-', 'rounded-r-', 'rounded-b-', 'rounded-l-',
  'rounded-tl-', 'rounded-tr-', 'rounded-br-', 'rounded-bl-',
  'rounded-s-', 'rounded-e-', 'rounded-ss-', 'rounded-se-', 'rounded-es-', 'rounded-ee-',
  'divide-x-', 'divide-y-', 'border-spacing-',
  // Effects & Filters
  'opacity-', 'mix-blend-', 'bg-blend-',
  'blur-', 'brightness-', 'contrast-', 'grayscale-', 'hue-rotate-',
  'invert-', 'saturate-', 'sepia-', 'backdrop-',
  // Transitions & Animation
  'transition-', 'duration-', 'ease-', 'delay-', 'animate-',
  // Transforms
  'scale-', 'scale-x-', 'scale-y-', 'rotate-', 'translate-x-', 'translate-y-',
  'skew-x-', 'skew-y-', 'origin-',
  // Interactivity
  'cursor-', 'scroll-', 'snap-', 'touch-', 'will-change-', 'select-',
  'resize-', 'appearance-', 'pointer-events-',
  // Float / Clear
  'float-', 'clear-',
  // Misc
  'caption-', 'forced-color-adjust-', 'line-clamp-',
  // v3 opacity utilities
  'bg-opacity-', 'text-opacity-', 'ring-opacity-',
  'border-opacity-', 'placeholder-opacity-', 'divide-opacity-',
]

// Tailwind color-scale base names (+ common semantic tokens). A prefixed
// utility whose value starts with one of these is treated as a color.
const COLOR_NAMES = new Set([
  'slate', 'gray', 'zinc', 'neutral', 'stone', 'red', 'orange', 'amber', 'yellow',
  'lime', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet',
  'purple', 'fuchsia', 'pink', 'rose', 'black', 'white', 'transparent', 'current',
  'inherit', 'primary', 'secondary', 'muted', 'accent', 'destructive', 'background',
  'foreground', 'card', 'popover', 'input', 'ring', 'border',
])

// Keyword values that follow a Tailwind prefix (e.g. text-`lg`, font-`bold`,
// leading-`tight`, w-`full`, cursor-`pointer`). Not exhaustive, but broad enough
// that a real utility is prefixed; anything unrecognised is left untouched so
// custom classes like `my-component` / `order-form` are not corrupted.
const VALUE_KEYWORDS = new Set([
  // sizes
  'xs', 'sm', 'base', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl', '7xl', '8xl', '9xl',
  // font weights
  'thin', 'extralight', 'light', 'normal', 'medium', 'semibold', 'bold', 'extrabold', 'black',
  // leading / tracking
  'none', 'tight', 'tighter', 'snug', 'relaxed', 'loose', 'wide', 'wider', 'widest',
  // sizing / layout keywords
  'auto', 'full', 'screen', 'min', 'max', 'fit', 'px', 'prose', 'svh', 'lvh', 'dvh',
  'first', 'last', 'initial',
  // positions
  'center', 'top', 'bottom', 'left', 'right', 'start', 'end',
  // cursor
  'pointer', 'default', 'wait', 'move', 'help', 'text', 'not-allowed', 'grab', 'grabbing',
  'crosshair', 'progress', 'cell', 'copy', 'alias', 'zoom-in', 'zoom-out',
  // list / whitespace / break
  'disc', 'decimal', 'inside', 'outside', 'nowrap', 'pre', 'pre-line', 'pre-wrap',
  'break-spaces', 'words', 'all', 'keep',
  // ease / align
  'linear', 'in', 'out', 'in-out', 'baseline', 'middle', 'sub', 'super',
])

// Does the value after a matched prefix look like a real Tailwind value?
// Accepts numbers/fractions/decimals, arbitrary values [..], colors, and known
// keywords. Rejects arbitrary custom words so BEM-style class names are skipped.
function isPlausibleUtilityValue(value) {
  if (value === '') return false // a bare prefix ("text-") is not a utility
  if (value.startsWith('[')) return true // arbitrary value, e.g. w-[200px]
  if (/^\d+(\.\d+)?(\/\d+)?$/.test(value)) return true // 4, 0.5, 1/2
  if (VALUE_KEYWORDS.has(value)) return true
  // color scale: red, red-500, red-500/50, primary/80
  const colorBase = value.split('/')[0].split('-')[0]
  if (COLOR_NAMES.has(colorBase)) return true

  return false
}

// Longest matching prefix wins so `border-t-2` matches `border-t-` (value "2"),
// not `border-` (value "t-2").
function longestPrefix(value) {
  let best = ''
  for (const pfx of TAILWIND_PREFIXES) {
    if (value.startsWith(pfx) && pfx.length > best.length) best = pfx
  }

  return best
}

function isTailwindClass(token) {
  if (!token) return false
  if (NON_TAILWIND.has(token)) return false

  let t = token
  if (t.startsWith('!')) t = t.slice(1)

  const lastColon = t.lastIndexOf(':')
  const utility = lastColon >= 0 ? t.slice(lastColon + 1) : t

  if (NON_TAILWIND.has(utility)) return false

  // Strip important that appears after variant (hover:!bg-red)
  const bare = utility.startsWith('!') ? utility.slice(1) : utility
  // Strip negative prefix (-m-4, -translate-x-2)
  const pos = bare.startsWith('-') ? bare.slice(1) : bare

  if (TAILWIND_EXACT.has(bare) || TAILWIND_EXACT.has(pos)) return true

  const pfx = longestPrefix(pos)
  if (pfx) return isPlausibleUtilityValue(pos.slice(pfx.length))

  return false
}

function prefixToken(token) {
  if (!isTailwindClass(token)) return token

  // Extract leading ! (before any variant)
  let leadingBang = ''
  let t = token
  if (t.startsWith('!')) { leadingBang = '!'; t = t.slice(1) }

  // Split variants from utility at last colon
  const lastColon = t.lastIndexOf(':')
  let variants = ''
  let utility = t
  if (lastColon >= 0) {
    variants = t.slice(0, lastColon + 1)
    utility = t.slice(lastColon + 1)
  }

  // ! can also appear after variant: hover:!bg-red
  let innerBang = ''
  if (utility.startsWith('!')) { innerBang = '!'; utility = utility.slice(1) }

  // Negative utilities: the sign goes BEFORE the prefix. Tailwind with
  // prefix 'bc-' emits `-bc-mt-4`, not `bc--mt-4`. Pull the leading '-' out
  // ahead of the prefix so the sign is preserved.
  let sign = ''
  if (utility.startsWith('-')) { sign = '-'; utility = utility.slice(1) }

  if (utility.startsWith(PREFIX)) return token // already prefixed

  return leadingBang + variants + innerBang + sign + PREFIX + utility
}

function processClassString(str) {
  if (!str) return str
  // Replace each non-whitespace token; preserve all whitespace
  return str.replace(/(\S+)/g, match => prefixToken(match))
}

// ─────────────────────────────────────────────────────────────────────────────
// File content transformation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Process a string literal value extracted from a class context.
 * Handles both plain strings and (simple) template literal content.
 */
function processStringLiteralValue(value) {
  return processClassString(value)
}

/**
 * Process template literal content — only touches static (non-interpolated) parts.
 * Limitation: nested template literals inside ${} are not handled.
 */
function processTemplateLiteralContent(tmpl) {
  // Split by interpolation markers, alternating: static, dynamic, static, ...
  const parts = tmpl.split(/(\$\{[^}]*\})/)

  return parts
    .map((p, i) => {
      if (i % 2 === 0) return processClassString(p)
      // Dynamic part: also process string literals inside ${...} (e.g. ternaries)
      return p.replaceAll(/(['"])([^'"]*)\1/g, (_, q, val) => `${q}${processClassString(val)}${q}`)
    })
    .join('')
}

/**
 * State-machine scanner that finds every className={...} / class={...} JSX expression
 * and processes string literals within it.
 *
 * Handles:
 *   - Single and double quoted strings
 *   - Template literals (static parts only)
 *   - Arbitrary nesting depth (cn([...]) inside className={})
 *   - Curly braces inside strings (doesn't break depth counter)
 */
function processClassNameExpressions(content) {
  const out = []
  let i = 0

  while (i < content.length) {
    // Look for class= or className= followed by {
    const slice = content.slice(i)
    const attrMatch = slice.match(/^(class(?:Name)?)=\s*(\{)/)

    if (!attrMatch) {
      out.push(content[i++])
      continue
    }

    // Emit everything up to and including the opening {
    const attrPrefix = content.slice(i, i + attrMatch[0].length)
    out.push(attrPrefix)
    i += attrMatch[0].length

    // Now scan the balanced { ... } expression
    let depth = 1
    const exprOut = []

    while (i < content.length && depth > 0) {
      const ch = content[i]

      if (ch === '"' || ch === "'") {
        // Quoted string literal — collect and process
        const quote = ch
        let raw = quote
        i++
        while (i < content.length) {
          const c = content[i]
          if (c === '\\') {
            // Escape sequence — keep as-is
            raw += c
            i++
            if (i < content.length) { raw += content[i]; i++ }
            continue
          }
          raw += c
          i++
          if (c === quote) break
        }
        // raw is the full quoted string including delimiters
        const inner = raw.slice(1, -1)
        const processed = processStringLiteralValue(inner)
        exprOut.push(quote + processed + quote)
        continue
      }

      if (ch === '`') {
        // Template literal — collect full template, process static parts
        let raw = '`'
        i++
        while (i < content.length) {
          const c = content[i]
          if (c === '\\') {
            raw += c; i++
            if (i < content.length) { raw += content[i]; i++ }
            continue
          }
          if (c === '`') { raw += c; i++; break }
          if (c === '$' && content[i + 1] === '{') {
            // Interpolation — collect until matching }
            raw += c; i++ // $
            raw += content[i]; i++ // {
            let tdepth = 1
            while (i < content.length && tdepth > 0) {
              const tc = content[i]
              raw += tc; i++
              if (tc === '{') tdepth++
              else if (tc === '}') tdepth--
            }
            continue
          }
          raw += c; i++
        }
        const inner = raw.slice(1, -1)
        const processed = processTemplateLiteralContent(inner)
        exprOut.push('`' + processed + '`')
        continue
      }

      if (ch === '{') depth++
      else if (ch === '}') {
        depth--
        if (depth === 0) {
          exprOut.push('}')
          i++
          break
        }
      }

      exprOut.push(ch)
      i++
    }

    out.push(exprOut.join(''))
  }

  return out.join('')
}

function processFile(filePath) {
  const original = readFileSync(filePath, 'utf8')
  let content = original

  if (filePath.endsWith('.css')) {
    // CSS: prefix classes inside @apply directives
    content = content.replaceAll(
      /(@apply\s+)([^;{}]+)/g,
      (_, directive, classes) => directive + processClassString(classes)
    )
  } else {
    // Pass 1 — static class="..." and className="..." (no braces)
    // No space before = to avoid matching JS default params like `className = ''`
    content = content.replaceAll(
      /(class(?:Name)?)=\s*"([^"]*)"/g,
      (_, attribute, val) => `${attribute}="${processClassString(val)}"`
    )
    content = content.replaceAll(
      /(class(?:Name)?)=\s*'([^']*)'/g,
      (_, attribute, val) => `${attribute}='${processClassString(val)}'`
    )

    // Pass 2 — className={...} expressions (handles cn/clsx/template literals inside)
    content = processClassNameExpressions(content)
  }

  return { original, modified: content, changed: content !== original }
}

// ─────────────────────────────────────────────────────────────────────────────
// File discovery
// ─────────────────────────────────────────────────────────────────────────────

const INCLUDE_EXTS = new Set(['.tsx', '.ts', '.jsx', '.js', '.html', '.php'])
const EXCLUDE_DIRS = new Set(['node_modules', 'assets', '.git', 'dist', 'build', 'vendor'])

function walkDir(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    if (EXCLUDE_DIRS.has(entry)) continue
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) walkDir(full, files)
    else if (INCLUDE_EXTS.has(extname(full))) files.push(full)
  }
  return files
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

const files = walkDir(TARGET_DIR)
let changedCount = 0
const skippedNote = []

console.log(`${DRY_RUN ? '[DRY RUN] ' : ''}Processing ${files.length} files in ${TARGET_DIR}\n`)

for (const file of files) {
  const { original, modified, changed } = processFile(file)

  if (!changed) continue

  changedCount++
  const rel = relative(ROOT, file)

  if (DRY_RUN) {
    console.log(`[would modify] ${rel}`)
    // Show first 3 changed lines as a diff preview
    const origLines = original.split('\n')
    const modLines = modified.split('\n')
    let shown = 0
    for (let ln = 0; ln < origLines.length && shown < 3; ln++) {
      if (origLines[ln] !== modLines[ln]) {
        console.log(`  - ${origLines[ln].trim()}`)
        console.log(`  + ${modLines[ln].trim()}`)
        shown++
      }
    }
    if (shown === 3) console.log(`  ... (more changes)`)
    console.log()
  } else {
    writeFileSync(file, modified, 'utf8')
    console.log(`[modified] ${rel}`)
  }
}

console.log(`\n${DRY_RUN ? '[DRY RUN] ' : ''}${changedCount} file(s) ${DRY_RUN ? 'would be' : 'were'} modified.`)

if (skippedNote.length > 0) {
  console.log('\nSkipped (review manually):')
  for (const note of skippedNote) console.log(` • ${note}`)
}
