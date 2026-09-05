#!/usr/bin/env node

/* eslint-disable no-console */

/**
 * Fetches a live portal URL the way non-JavaScript clients do and reports what
 * each class of crawler would actually get.
 *
 * The unit suite (tests/Seo/CrawlabilityTest.php) proves the renderers emit the
 * right markup. This proves the *served page* does — it catches the failures
 * unit tests cannot see: a caching layer stripping tags, an SEO plugin winning
 * the canonical, a `noindex` on the portal page, or the route never reaching the
 * SSR controller at all.
 *
 * Usage:
 *   node scripts/crawl-check.mjs http://connect.btcd-test.io:8004/community
 *   node scripts/crawl-check.mjs <url> --agent Googlebot
 */

import { program } from 'commander'

// Real UA strings, grouped by what each family of client consumes. None of these
// execute JavaScript, which is the entire point of the check.
const AGENTS = {
  'AI / LLM': {
    ClaudeBot: 'Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)',
    GPTBot: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.1; +https://openai.com/gptbot)',
    PerplexityBot: 'Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)',
    CCBot: 'CCBot/2.0 (https://commoncrawl.org/faq/)',
    'Google-Extended': 'Mozilla/5.0 (compatible; Google-Extended/1.0)'
  },
  'Link preview': {
    Slackbot: 'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)',
    Discordbot: 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)',
    facebookexternalhit: 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
    Twitterbot: 'Twitterbot/1.0',
    iMessage: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko)'
  },
  'Search engine': {
    Googlebot:
      'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    Bingbot: 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
    DuckDuckBot: 'DuckDuckBot/1.1; (+http://duckduckgo.com/duckduckbot.html)',
    YandexBot: 'Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)'
  }
}

// What each family needs to be present. A link preview bot never reads the body,
// so failing a body check is irrelevant to it — and vice versa.
const REQUIREMENTS = {
  'AI / LLM': ['bodyText', 'headings'],
  'Link preview': ['ogTitle', 'ogDescription', 'ogUrl'],
  'Search engine': ['bodyText', 'headings', 'links', 'title', 'indexable']
}

const text = (html) =>
  html
    .replaceAll(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replaceAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replaceAll(/<[^>]+>/g, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim()

const meta = (html, attribute, key) => {
  const pattern = new RegExp(
    `<meta[^>]+${attribute}=["']${key}["'][^>]*content=["']([^"']*)["']`,
    'i'
  )
  const alternate = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]*${attribute}=["']${key}["']`,
    'i'
  )
  return (html.match(pattern) ?? html.match(alternate))?.[1] ?? null
}

function inspect(html) {
  // The portal root only; page chrome from the theme would mask an empty app.
  const root = html.match(
    /<div[^>]*id=["']bit-connect-u-root["'][\s\S]*?(?=<script|<\/body)/i
  )?.[0]
  const rootText = root ? text(root) : ''

  const jsonLd = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => {
      try {
        return JSON.parse(match[1])
      } catch {
        return { __invalid: true }
      }
    })

  const robots = meta(html, 'name', 'robots') ?? ''

  return {
    bodyText: rootText.length > 40 ? rootText.slice(0, 60) + '…' : null,
    headings: /<h1\b/i.test(root ?? '') || /<h2\b/i.test(root ?? '') || null,
    links: root ? [...root.matchAll(/<a\s[^>]*href=/gi)].length || null : null,
    title: html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || null,
    ogTitle: meta(html, 'property', 'og:title'),
    ogDescription: meta(html, 'property', 'og:description'),
    ogUrl: meta(html, 'property', 'og:url'),
    twitterCard: meta(html, 'name', 'twitter:card'),
    canonical: html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1] ?? null,
    jsonLdTypes: jsonLd.map((d) => (d.__invalid ? 'INVALID JSON' : d['@type'])).join(', ') || null,
    indexable: /noindex/i.test(robots) ? null : true,
    placeholderOnly: root ? /data-bc-no-hydrate/i.test(root) && rootText.length <= 40 : false
  }
}

program
  .name('crawl-check')
  .description('Report what non-JS crawlers see at a portal URL')
  .argument('<url>', 'portal URL to fetch')
  .option('-a, --agent <name>', 'check a single named agent instead of all')
  .parse()

const [url] = program.args
const { agent: onlyAgent } = program.opts()

let failed = 0
let checked = 0

for (const [family, agents] of Object.entries(AGENTS)) {
  const entries = Object.entries(agents).filter(([name]) => !onlyAgent || name === onlyAgent)
  if (entries.length === 0) continue

  console.log(`\n[1m${family}[0m`)

  for (const [name, ua] of entries) {
    let response
    try {
      response = await fetch(url, { headers: { 'User-Agent': ua }, redirect: 'follow' })
    } catch (error) {
      console.log(`  [31m✗[0m ${name.padEnd(20)} request failed: ${error.message}`)
      failed++
      continue
    }

    const html = await response.text()
    const found = inspect(html)
    const missing = REQUIREMENTS[family].filter((key) => !found[key])
    checked++

    if (response.status !== 200) {
      console.log(`  [31m✗[0m ${name.padEnd(20)} HTTP ${response.status}`)
      failed++
      continue
    }

    if (missing.length > 0) {
      console.log(`  [31m✗[0m ${name.padEnd(20)} missing: ${missing.join(', ')}`)
      failed++
    } else {
      console.log(`  [32m✓[0m ${name.padEnd(20)} ${REQUIREMENTS[family].join(', ')}`)
    }

    if (found.placeholderOnly) {
      console.log(`    [33m![0m served the loading placeholder, not topic content`)
    }
  }
}

// One detailed dump so a failure above is diagnosable without a second run.
const sample = await fetch(url, { headers: { 'User-Agent': AGENTS['Search engine'].Googlebot } })
const detail = inspect(await sample.text())

console.log('\n[1mWhat was served[0m')
for (const [key, value] of Object.entries(detail)) {
  const shown = value === null ? '[31m—[0m' : String(value)
  console.log(`  ${key.padEnd(18)} ${shown}`)
}

console.log(
  failed === 0
    ? `\n[32mAll ${checked} crawler checks passed.[0m`
    : `\n[31m${failed} of ${checked} crawler checks failed.[0m`
)

process.exit(failed === 0 ? 0 : 1)
