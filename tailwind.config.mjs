/** @type {import('tailwindcss').Config} */
export default {
  // The server-rendered portal markup (SSR/Seo/SeoContent.php) reuses the same
  // component classes as the React tree, so PHP has to be scanned too — a class
  // that appears only there would otherwise be purged and render unstyled.
  content: ['./frontend/**/*.{html,js,jsx,ts,tsx}', './backend/app/**/*.php'],
  corePlugins: {
    preflight: false
  },
  darkMode: 'class',
  important: true,
  plugins: [],
  prefix: 'bc-',
  theme: {
    borderRadius: {
      DEFAULT: '0.5625rem',
      full: '999px',
      lg: '0.8125rem',
      md: '0.6875rem',
      none: '0',
      sm: '0.375rem'
    },
    extend: {
      colors: {
        primary: '#3266EA',

        // Semantic tokens — see frontend/shared/theme/tokens.css for the values
        // and why the UI names colours by role instead of by shade. These carry
        // dark mode on their own, so `bc-bg-surface` needs no `dark:` twin.
        info: 'var(--bc-info)',
        'info-soft': 'var(--bc-info-soft)',
        ink: 'var(--bc-ink)',
        'ink-muted': 'var(--bc-ink-muted)',
        'ink-subtle': 'var(--bc-ink-subtle)',
        line: 'var(--bc-line)',
        'line-strong': 'var(--bc-line-strong)',
        negative: 'var(--bc-negative)',
        'negative-soft': 'var(--bc-negative-soft)',
        positive: 'var(--bc-positive)',
        'positive-soft': 'var(--bc-positive-soft)',
        surface: 'var(--bc-surface)',
        'surface-hover': 'var(--bc-surface-hover)',
        'surface-raised': 'var(--bc-surface-raised)',
        'surface-sunken': 'var(--bc-surface-sunken)',

        // Profile badge tones. Decorative rather than semantic — an admin picks
        // one when naming a badge, so unlike everything above they say nothing
        // about what the element is.
        'tone-amber': 'var(--bc-tone-amber)',
        'tone-amber-soft': 'var(--bc-tone-amber-soft)',
        'tone-teal': 'var(--bc-tone-teal)',
        'tone-teal-soft': 'var(--bc-tone-teal-soft)',
        'tone-violet': 'var(--bc-tone-violet)',
        'tone-violet-soft': 'var(--bc-tone-violet-soft)'
      }
    }
  }
}
