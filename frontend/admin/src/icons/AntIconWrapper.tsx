import { cn } from '../common/helpers/globalHelpers'

interface AntIconWrapperPropsTypes {
  children: JSX.Element
  className?: string
}

export default function AntIconWrapper({ children, className }: AntIconWrapperPropsTypes): JSX.Element {
  return (
    <span className={cn([className, 'anticon'])} role="img">
      {children}
    </span>
  )
}
