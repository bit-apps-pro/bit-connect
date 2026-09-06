export interface DashboardStats {
  totalComments: number
  totalMembers: number
  totalTopics: number
  totalVotes: number
}

export interface MonthlyActivityType {
  comments: number
  month: string
  topics: number
}

export interface TopTopicType {
  id: number
  title: string
  vote_count: number
}

export interface RecentTopicType {
  author: string
  created_at: string
  id: number
  title: string
  vote_count: number
}

export default interface DashboardDataType {
  monthlyActivity: MonthlyActivityType[]
  recentTopics: RecentTopicType[]
  stats: DashboardStats
  topTopics: TopTopicType[]
}
