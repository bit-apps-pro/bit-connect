import Markdown from 'react-markdown'

import useChangelog from '../data/useChangelog'
import cls from './changelog.module.css'

export default function ChangelogContent() {
  const { changelog } = useChangelog()

  if (!changelog) return

  return (
    <div className={cls.changelog}>
      <Markdown>{changelog}</Markdown>
    </div>
  )
}
