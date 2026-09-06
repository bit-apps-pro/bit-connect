import { Button, Result } from 'antd'
import { useNavigate } from 'react-router'

import { __ } from '../../common/helpers/i18nWrap'

export default function Error404() {
  const navigate = useNavigate()

  return (
    <Result
      extra={
        <Button onClick={() => navigate('/', { replace: true })} type="primary">
          Back Home
        </Button>
      }
      status="404"
      subTitle={__('Sorry, the page you visited does not exist.')}
      title={__('404')}
    />
  )
}
