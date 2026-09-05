import { Input as InputAnt, type InputProps, theme, Typography } from 'antd'
import { useEffect, useId } from 'react'

export interface InputPropsType extends InputProps {
  helperText?: string
  invalidMessage?: string
  label?: string
  onRender?: (e?: any) => void // eslint-disable-line @typescript-eslint/no-explicit-any
  wrapperClassName?: string
}

const { Text } = Typography

export default function Input({
  helperText,
  invalidMessage,
  label,
  onRender,
  status,
  wrapperClassName,
  ...props
}: InputPropsType) {
  const id = useId()
  const { token } = theme.useToken()

  useEffect(() => {
    onRender?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className={wrapperClassName}>
      {label && (
        <label className="d-b bc-mb-1 bc-font-medium" css={{ color: token.colorText }} htmlFor={id}>
          {label}
          {props.required && (
            <Text className="bc-leading-none" type="danger">
              *
            </Text>
          )}
        </label>
      )}

      <InputAnt data-testid="inputComponent" id={id} status={status} {...props} />

      {status === 'error' && invalidMessage && <Text type="danger">{invalidMessage}</Text>}
      {!invalidMessage && helperText && <Text type="secondary">{helperText}</Text>}
    </div>
  )
}
