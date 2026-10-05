/** The window every "+N" on the dashboard counts over. */
export type DashboardPeriod = '7d' | '12m' | '30d'

export interface DashboardStats {
  commentedTopics: number
  /** Members whose first topic or reply landed inside the period. */
  firstTimePosters: number
  newComments: number
  newMembers: number
  newTopics: number
  newVotes: number
  topVotedStage: null | string
  totalComments: number
  totalMembers: number
  totalTopics: number
  totalVotes: number
}

export interface DashboardAttention {
  pendingReplies: number
  /** Reported items awaiting a decision, counted per item rather than per report. */
  reports: number
  unanswered: number
}

export interface ActivityBucket {
  comments: number
  /** GMT `Y-m-d` — the first day of the bucket. */
  date: string
  topics: number
}

export interface StageProgress {
  added: number
  color: null | string
  count: number
  id: number
  name: string
}

export interface TopicStage {
  color: null | string
  name: string
}

export interface MostRequestedTopic {
  id: number
  recentVotes: number
  replies: number
  stage: null | TopicStage
  title: string
  url: string
  votes: number
}

export interface RecentTopic {
  author: null | string
  created_at: string
  id: number
  stage: null | TopicStage
  title: string
  url: string
  votes: number
}

export interface Contributor {
  avatar: string
  /** The badge shown beside the member's name on the portal, when they carry one. */
  badge: null | string
  /** Comments written during the period. */
  comments: number
  id: number
  name: string
  /** Votes the member's topics received during the period, their own excluded. */
  votes: number
}

/** The order the Top contributors list is ranked in. */
export type ContributorRanking = 'comments' | 'overall' | 'votes'

export type TopContributors = Record<ContributorRanking, Contributor[]> & {
  /** Every member who received a vote or wrote a comment during the period. */
  count: number
}

export interface DashboardData {
  activity: ActivityBucket[]
  attention: DashboardAttention
  contributors: TopContributors
  mostRequested: MostRequestedTopic[]
  period: DashboardPeriod
  portalUrl: string
  recentTopics: RecentTopic[]
  stages: StageProgress[]
  stats: DashboardStats
  topicTypes: string[]
}
