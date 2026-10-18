import { type ColumnsType } from 'antd/es/table'

import { type ModerationTopicRow } from '../shared/types'

const NONE: ColumnsType<ModerationTopicRow> = []

/**
 * Further columns for the Topics table, placed before Locked.
 *
 * Every column this plugin shows is already in the table, so it adds none. A
 * column another plugin adds reads the value it put on the row — see
 * ExtensionPoints::moderationRowFields().
 */
export default function useAddedColumns(): ColumnsType<ModerationTopicRow> {
  return NONE
}
