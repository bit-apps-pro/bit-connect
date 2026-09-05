import { type NotificationInstance } from 'antd/es/notification/interface'
import { createContext } from 'react'

interface NotifyContextType {
  notificationApi?: NotificationInstance
}

const NotifyContext = createContext<NotifyContextType>({})

export default NotifyContext
