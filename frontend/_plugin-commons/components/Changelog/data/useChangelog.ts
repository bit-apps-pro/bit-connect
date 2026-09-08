import config from '../../../../admin/src/config/config'
import { useQuery } from '@tanstack/react-query'

const importReadmeFile = async () => {
  const response = await fetch(`${config.ROOT_URL}/readme.txt`)
  if (!response.ok) {
    throw new Error('Failed to fetch the README.txt file')
  }
  return response.text()
}

export default function useChangelog() {
  const { data } = useQuery({
    queryFn: importReadmeFile,
    queryKey: ['changelog'],
    select: res =>
      res
        .match(/==\s*Changelog\s*==\s*([\S\s]*?)(?=\s*==|$)/g)?.[0]
        ?.replaceAll('== Changelog ==', '') // Convert changelog heading
        ?.replaceAll(/^= (.+?) =/gm, '## $1') // Convert version headings
  })

  return {
    changelog: data
  }
}
