import { type MessageInstance } from 'antd/es/message/interface'
import { type NotificationInstance } from 'antd/es/notification/interface'
import { createContext } from 'react'

interface NotifyContextType {
  messageApi?: MessageInstance
  notificationApi?: NotificationInstance
}

const NotifyContext = createContext<NotifyContextType>({})

export default NotifyContext
