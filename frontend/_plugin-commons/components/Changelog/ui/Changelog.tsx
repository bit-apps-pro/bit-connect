import { __ } from '../../../../admin/src/common/helpers/i18nWrap'
import { Button, Drawer } from 'antd'
import { LuFileClock } from 'react-icons/lu'
import { useToggle } from 'react-use'
import { twMerge } from 'tailwind-merge'

import ChangelogContent from './ChangelogContent'

const drawerClassNames =
  'mt-[33px] h-[calc(100vh-40px)] rounded-md border-2 border-[var(--wp-bg-color)] ring-4 ring-[var(--wp-bg-color)] dark:border-[#1f1f1f] dark:bg-slate-950'
const wrapperClassName = 'drawer-decoration mr-1 shadow-none'

export default function Changelog() {
  const [isOpen, toggle] = useToggle(false)

  const handleClose = () => toggle(false)

  return (
    <div>
      <Button className="bc-mb-12" icon={<LuFileClock />} onClick={toggle}>
        {`Changelog`}
      </Button>

      <Drawer
        className={twMerge([drawerClassNames, 'bc-bg-slate-50'])}
        classNames={{ wrapper: wrapperClassName }}
        mask={false}
        onClose={handleClose}
        open={isOpen}
        title={__('Changelog')}
        width={500}
      >
        <ChangelogContent />
      </Drawer>
    </div>
  )
}
