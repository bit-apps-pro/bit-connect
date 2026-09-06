import { Card, type GlobalToken, theme } from 'antd'
import {
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip
} from 'chart.js'
import { Line } from 'react-chartjs-2'

import { __ } from '../../../common/helpers/i18nWrap'
import { type MonthlyActivityType } from '../data/FlowDashboardType'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend)

const options = {
  plugins: {
    legend: {
      display: true,
      position: 'bottom' as const
    },
    title: {
      display: false
    }
  },
  responsive: true
}

const buildChartData = (token: GlobalToken, monthlyActivity: MonthlyActivityType[]) => ({
  datasets: [
    {
      backgroundColor: token.colorPrimaryBgHover,
      borderColor: token.colorPrimary,
      data: monthlyActivity.map(m => m.topics),
      label: __('Topics'),
      pointHoverRadius: 8,
      pointRadius: 4
    },
    {
      backgroundColor: token.colorSuccessBgHover,
      borderColor: token.colorSuccess,
      data: monthlyActivity.map(m => m.comments),
      label: __('Comments'),
      pointHoverRadius: 8,
      pointRadius: 4
    }
  ],
  labels: monthlyActivity.map(m => m.month)
})

export default function ActivityChart({ monthlyActivity }: { monthlyActivity: MonthlyActivityType[] }) {
  const { token } = theme.useToken()

  return (
    <Card className="bc-shadow-md" loading={false} size="small" title={__('Monthly Activity')}>
      <Line data={buildChartData(token, monthlyActivity)} options={options} />
    </Card>
  )
}
