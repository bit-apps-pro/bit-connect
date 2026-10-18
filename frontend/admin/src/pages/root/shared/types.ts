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
  /** Comments held for approval. */
  pendingReplies: number
  /** WordPress's Comments screen, narrowed to held comments on topics. */
  pendingRepliesUrl: string
  /** Reported items awaiting a decision, counted per item rather than per report. */
  reports: number
  /** Topics with no comment at all. */
  unanswered: number
}

/** A topic still waiting for its first comment. */
export interface UnansweredTopic {
  author: null | string
  /** GMT. */
  created_at: string
  id: number
  stage: null | TopicStage
  title: string
  url: string
}

/** How quickly topics started during the period got a first comment from someone else. */
export interface DashboardResponse {
  /** Of `topics`, how many have had one. */
  answered: number
  /** Of `promptEligible`, how many had one within a day. */
  answeredPromptly: number
  /** Null until one topic in the period has been answered. */
  medianSeconds: null | number
  /** Topics from the period at least a day old — those that could have missed the day. */
  promptEligible: number
  /** Topics started during the period. */
  topics: number
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
  response: DashboardResponse
  stages: StageProgress[]
  stats: DashboardStats
  topicTypes: string[]
  /** The longest-waiting topics with no comment, oldest first. */
  unanswered: UnansweredTopic[]
}
