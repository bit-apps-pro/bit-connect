import { describe, expect, it } from 'vitest'

import { parseVideoLink, videoOfParagraph } from './video-link'

const paragraph = (html: string) => {
  const holder = document.createElement('div')
  holder.innerHTML = html
  return holder.firstElementChild as Element
}

describe('parseVideoLink', () => {
  it.each([
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtube.com/watch?v=dQw4w9WgXcQ&list=PL123',
    'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtu.be/dQw4w9WgXcQ',
    'https://www.youtube.com/shorts/dQw4w9WgXcQ',
    'https://www.youtube.com/live/dQw4w9WgXcQ',
    'https://www.youtube.com/embed/dQw4w9WgXcQ',
    'http://www.youtube.com/watch?v=dQw4w9WgXcQ'
  ])('plays %s from the no-cookie domain', address => {
    expect(parseVideoLink(address)).toEqual({
      embedUrl: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1',
      provider: 'youtube'
    })
  })

  it.each([
    ['https://youtu.be/dQw4w9WgXcQ?t=90', '90'],
    ['https://youtu.be/dQw4w9WgXcQ?t=90s', '90'],
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1m30s', '90'],
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1h0m5s', '3605']
  ])('keeps the start time of %s', (address, start) => {
    expect(new URL(parseVideoLink(address)!.embedUrl).searchParams.get('start')).toBe(start)
  })

  it('plays from the beginning when the start time is unreadable', () => {
    expect(parseVideoLink('https://youtu.be/dQw4w9WgXcQ?t=soon')!.embedUrl).not.toContain('start')
  })

  it.each([
    ['https://vimeo.com/76979871', 'https://player.vimeo.com/video/76979871?autoplay=1&dnt=1'],
    ['https://player.vimeo.com/video/76979871', 'https://player.vimeo.com/video/76979871?autoplay=1&dnt=1'],
    ['https://vimeo.com/76979871/a1b2c3d4e5', 'https://player.vimeo.com/video/76979871?h=a1b2c3d4e5&autoplay=1&dnt=1'],
    [
      'https://player.vimeo.com/video/76979871?h=a1b2c3d4e5',
      'https://player.vimeo.com/video/76979871?h=a1b2c3d4e5&autoplay=1&dnt=1'
    ]
  ])('plays %s with Do Not Track', (address, embedUrl) => {
    expect(parseVideoLink(address)).toEqual({ embedUrl, provider: 'vimeo' })
  })

  it.each([
    'https://www.youtube.com/@bit-apps',
    'https://www.youtube.com/watch?v=short',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ"onload="x',
    'https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ',
    'https://notyoutube.com/watch?v=dQw4w9WgXcQ',
    'https://user@youtube.com/watch?v=dQw4w9WgXcQ',
    'https://vimeo.com/channels/staffpicks',
    'https://vimeo.com/76979871/not-a-hash!',
    'https://vimeo.com/76979871/a1b2c3d4e5/extra',
    'javascript:alert(1)//youtu.be/dQw4w9WgXcQ',
    'youtube.com/watch?v=dQw4w9WgXcQ',
    'not a url'
  ])('leaves %s as a link', address => {
    expect(parseVideoLink(address)).toBeUndefined()
  })
})

describe('videoOfParagraph', () => {
  it('embeds an address pasted as plain text', () => {
    expect(videoOfParagraph(paragraph('<p>https://youtu.be/dQw4w9WgXcQ</p>'))?.provider).toBe('youtube')
  })

  it('embeds a link whose text is its own address', () => {
    const html = '<p><a href="https://vimeo.com/76979871">https://vimeo.com/76979871</a><br></p>'
    expect(videoOfParagraph(paragraph(html))?.provider).toBe('vimeo')
  })

  it('leaves an address written into a sentence alone', () => {
    expect(videoOfParagraph(paragraph('<p>Watch https://youtu.be/dQw4w9WgXcQ first</p>'))).toBeUndefined()
  })

  it('leaves a link labelled in the writer’s own words alone', () => {
    expect(videoOfParagraph(paragraph('<p><a href="https://youtu.be/dQw4w9WgXcQ">demo</a></p>'))).toBeUndefined()
  })

  it('leaves a link whose text and address disagree alone', () => {
    const html = '<p><a href="https://youtu.be/AAAAAAAAAAA">https://youtu.be/dQw4w9WgXcQ</a></p>'
    expect(videoOfParagraph(paragraph(html))).toBeUndefined()
  })

  it('leaves a link its writer chose to keep a link alone', () => {
    const html = '<p><a class="bc-video-link" href="https://youtu.be/dQw4w9WgXcQ">https://youtu.be/dQw4w9WgXcQ</a></p>'
    expect(videoOfParagraph(paragraph(html))).toBeUndefined()
  })

  it('leaves formatted or doubled links alone', () => {
    const bold = '<p><a href="https://youtu.be/dQw4w9WgXcQ"><strong>https://youtu.be/dQw4w9WgXcQ</strong></a></p>'
    expect(videoOfParagraph(paragraph(bold))).toBeUndefined()
  })
})
