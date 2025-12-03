-- ============================================================================
-- AI AGENT ORCHESTRATOR - POSTGRESQL DATABASE SCHEMA
-- ============================================================================
-- Version: 1.0.0
-- PostgreSQL: 14+
-- Description: Complete schema for multi-agent AI orchestration system
--              with collective intelligence mechanisms
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- For text search optimization
CREATE EXTENSION IF NOT EXISTS "btree_gin"; -- For composite indexes

-- ============================================================================
-- DOMAIN TYPES & ENUMS
-- ============================================================================

-- Agent Types
CREATE TYPE agent_type AS ENUM (
  'team-leader',
  'worker',
  'collaborator',
  'coordinator',
  'monitor',
  'specialist'
);

-- Agent Status
CREATE TYPE agent_status AS ENUM (
  'active',
  'idle',
  'busy',
  'offline',
  'maintenance',
  'suspended'
);

-- Task Status
CREATE TYPE task_status AS ENUM (
  'pending',
  'assigned',
  'in_progress',
  'completed',
  'failed',
  'cancelled',
  'retry'
);

-- Task Priority
CREATE TYPE task_priority AS ENUM (
  'critical',
  'high',
  'normal',
  'low'
);

-- Voting Algorithm
CREATE TYPE voting_algorithm AS ENUM (
  'simple_majority',
  'confidence_weighted',
  'quadratic',
  'consensus',
  'ranked_choice'
);

-- Voting Session Status
CREATE TYPE voting_session_status AS ENUM (
  'open',
  'closed',
  'cancelled'
);

-- Battle Mode
CREATE TYPE battle_mode AS ENUM (
  'head_to_head',
  'speed_race',
  'quality_showdown',
  'team_tournament',
  'king_of_hill',
  'boss_raid',
  'time_attack',
  'survival'
);

-- Battle Status
CREATE TYPE battle_status AS ENUM (
  'pending',
  'active',
  'completed',
  'cancelled'
);

-- Achievement Category
CREATE TYPE achievement_category AS ENUM (
  'task_completion',
  'speed',
  'quality',
  'collaboration',
  'innovation',
  'consistency',
  'special',
  'legendary'
);

-- Tier Level
CREATE TYPE tier_level AS ENUM (
  'bronze',
  'silver',
  'gold',
  'platinum',
  'diamond'
);

-- Violation Type
CREATE TYPE violation_type AS ENUM (
  'low_quality',
  'timeout',
  'protocol_violation',
  'resource_abuse',
  'collaboration_failure',
  'data_corruption'
);

-- Appeal Status
CREATE TYPE appeal_status AS ENUM (
  'pending',
  'under_review',
  'approved',
  'denied',
  'withdrawn'
);

-- Mentorship Status
CREATE TYPE mentorship_status AS ENUM (
  'active',
  'completed',
  'paused',
  'cancelled'
);

-- ============================================================================
-- CORE TABLES: AGENTS
-- ============================================================================

-- Agents: Core agent profiles and metadata
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  type agent_type NOT NULL,
  status agent_status NOT NULL DEFAULT 'idle',

  -- Configuration
  config JSONB DEFAULT '{}',
  capabilities JSONB DEFAULT '[]',
  specializations TEXT[] DEFAULT ARRAY[]::TEXT[],

  -- Statistics
  tasks_completed INTEGER DEFAULT 0,
  tasks_attempted INTEGER DEFAULT 0,
  tasks_failed INTEGER DEFAULT 0,
  success_rate DECIMAL(5,2) DEFAULT 100.00,
  average_quality_score DECIMAL(5,2) DEFAULT 50.00,
  average_task_time_ms INTEGER DEFAULT 300000,

  -- Reputation & Performance
  total_points INTEGER DEFAULT 0,
  current_tier tier_level DEFAULT 'bronze',
  elo_rating INTEGER DEFAULT 1500,
  trust_score DECIMAL(5,4) DEFAULT 0.5000,

  -- Activity tracking
  last_active_at TIMESTAMP WITH TIME ZONE,
  last_heartbeat_at TIMESTAMP WITH TIME ZONE,
  consecutive_active_days INTEGER DEFAULT 0,
  total_active_days INTEGER DEFAULT 0,

  -- Metadata
  registered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE,

  -- Constraints
  CONSTRAINT chk_success_rate CHECK (success_rate >= 0 AND success_rate <= 100),
  CONSTRAINT chk_quality_score CHECK (average_quality_score >= 0 AND average_quality_score <= 100),
  CONSTRAINT chk_trust_score CHECK (trust_score >= 0 AND trust_score <= 1)
);

-- Agent Skills: Proficiency tracking
CREATE TABLE agent_skills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  skill_name VARCHAR(100) NOT NULL,
  proficiency_level INTEGER DEFAULT 0,
  experience_points INTEGER DEFAULT 0,
  last_practiced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(agent_id, skill_name),
  CONSTRAINT chk_proficiency_level CHECK (proficiency_level >= 0 AND proficiency_level <= 10)
);

-- Agent Activity Log: Detailed activity tracking
CREATE TABLE agent_activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  activity_type VARCHAR(50) NOT NULL,
  activity_data JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  -- Partitioning hint
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
) PARTITION BY RANGE (created_at);

-- Agent Status History: Track status changes
CREATE TABLE agent_status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  old_status agent_status,
  new_status agent_status NOT NULL,
  reason TEXT,
  metadata JSONB DEFAULT '{}',
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- CORE TABLES: TASKS
-- ============================================================================

-- Tasks: Task definitions and queue
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id VARCHAR(100) UNIQUE NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,

  -- Assignment
  status task_status NOT NULL DEFAULT 'pending',
  priority task_priority NOT NULL DEFAULT 'normal',
  assigned_to UUID REFERENCES agents(id) ON DELETE SET NULL,
  assigned_by UUID REFERENCES agents(id) ON DELETE SET NULL,

  -- Task data
  task_data JSONB DEFAULT '{}',
  requirements JSONB DEFAULT '{}',
  constraints JSONB DEFAULT '{}',

  -- Execution
  complexity VARCHAR(50),
  estimated_duration_ms INTEGER,
  actual_duration_ms INTEGER,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,

  -- Timing
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  assigned_at TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  deadline TIMESTAMP WITH TIME ZONE,

  -- Results
  result JSONB,
  error_message TEXT,
  quality_score DECIMAL(5,2),

  -- Metadata
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  metadata JSONB DEFAULT '{}',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE,

  CONSTRAINT chk_quality_score CHECK (quality_score IS NULL OR (quality_score >= 0 AND quality_score <= 100))
);

-- Task Dependencies: Task relationships
CREATE TABLE task_dependencies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on_task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  dependency_type VARCHAR(50) DEFAULT 'blocks',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(task_id, depends_on_task_id),
  CONSTRAINT chk_no_self_dependency CHECK (task_id != depends_on_task_id)
);

-- Task History: Audit trail for tasks
CREATE TABLE task_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  event_type VARCHAR(50) NOT NULL,
  old_status task_status,
  new_status task_status,
  event_data JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
) PARTITION BY RANGE (created_at);

-- ============================================================================
-- VOTING SYSTEM
-- ============================================================================

-- Voting Sessions: Democratic decision-making
CREATE TABLE voting_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id VARCHAR(100) UNIQUE NOT NULL,

  -- Session details
  topic VARCHAR(500) NOT NULL,
  question TEXT NOT NULL,
  options JSONB NOT NULL,
  algorithm voting_algorithm NOT NULL DEFAULT 'simple_majority',

  -- Status
  status voting_session_status NOT NULL DEFAULT 'open',

  -- Initiator
  initiated_by UUID REFERENCES agents(id) ON DELETE SET NULL,

  -- Quorum configuration
  min_participation DECIMAL(3,2) DEFAULT 0.50,
  min_confidence DECIMAL(3,2) DEFAULT 0.00,
  min_experts INTEGER DEFAULT 0,
  total_agents INTEGER NOT NULL,
  consensus_threshold DECIMAL(3,2) DEFAULT 0.75,
  tokens_per_agent INTEGER DEFAULT 100,

  -- Results
  results JSONB,
  winner VARCHAR(255),
  participation_rate DECIMAL(5,2),

  -- Timing
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  deadline TIMESTAMP WITH TIME ZONE,
  closed_at TIMESTAMP WITH TIME ZONE,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Votes: Individual votes cast
CREATE TABLE votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES voting_sessions(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,

  -- Vote details
  vote_option VARCHAR(255) NOT NULL,
  confidence DECIMAL(3,2) DEFAULT 1.00,
  reasoning TEXT,

  -- Quadratic voting
  tokens_spent INTEGER DEFAULT 1,
  vote_weight DECIMAL(10,6) DEFAULT 1.000000,

  -- Ranked choice
  ranked_preferences JSONB,

  -- Audit
  signature VARCHAR(255),
  ip_address INET,

  -- Timing
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(session_id, agent_id),
  CONSTRAINT chk_confidence CHECK (confidence >= 0 AND confidence <= 1),
  CONSTRAINT chk_tokens_spent CHECK (tokens_spent >= 0)
);

-- Vote Audit Trail: Complete audit history
CREATE TABLE vote_audit_trail (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES voting_sessions(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  event_type VARCHAR(50) NOT NULL,
  event_data JSONB DEFAULT '{}',
  signature VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- BRAINSTORMING SYSTEM
-- ============================================================================

-- Brainstorm Sessions: Collaborative ideation
CREATE TABLE brainstorm_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id VARCHAR(100) UNIQUE NOT NULL,

  -- Session details
  topic VARCHAR(500) NOT NULL,
  description TEXT,
  facilitator_id UUID REFERENCES agents(id) ON DELETE SET NULL,

  -- Configuration
  max_participants INTEGER,
  max_ideas_per_agent INTEGER DEFAULT 10,
  max_combinations_per_agent INTEGER DEFAULT 5,

  -- Status
  status VARCHAR(50) DEFAULT 'active',

  -- Statistics
  total_ideas INTEGER DEFAULT 0,
  total_combinations INTEGER DEFAULT 0,
  total_votes INTEGER DEFAULT 0,
  participant_count INTEGER DEFAULT 0,

  -- Timing
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  duration_ms INTEGER,

  -- Metadata
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  metadata JSONB DEFAULT '{}',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Brainstorm Participants: Session participation tracking
CREATE TABLE brainstorm_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES brainstorm_sessions(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,

  -- Participation stats
  ideas_contributed INTEGER DEFAULT 0,
  combinations_created INTEGER DEFAULT 0,
  votes_cast INTEGER DEFAULT 0,

  -- Timing
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_active_at TIMESTAMP WITH TIME ZONE,

  UNIQUE(session_id, agent_id)
);

-- Ideas: Generated ideas
CREATE TABLE ideas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  idea_id VARCHAR(100) UNIQUE NOT NULL,
  session_id UUID NOT NULL REFERENCES brainstorm_sessions(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,

  -- Idea content
  content TEXT NOT NULL,
  category VARCHAR(100),

  -- Scoring
  quality_score DECIMAL(5,2),
  novelty_score DECIMAL(5,2),
  feasibility_score DECIMAL(5,2),
  total_votes INTEGER DEFAULT 0,
  vote_score DECIMAL(10,2) DEFAULT 0,

  -- Metadata
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT chk_quality_score_idea CHECK (quality_score IS NULL OR (quality_score >= 0 AND quality_score <= 100)),
  CONSTRAINT chk_novelty_score CHECK (novelty_score IS NULL OR (novelty_score >= 0 AND novelty_score <= 100)),
  CONSTRAINT chk_feasibility_score CHECK (feasibility_score IS NULL OR (feasibility_score >= 0 AND feasibility_score <= 100))
);

-- Idea Combinations: Combined ideas
CREATE TABLE idea_combinations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  combination_id VARCHAR(100) UNIQUE NOT NULL,
  session_id UUID NOT NULL REFERENCES brainstorm_sessions(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,

  -- Source ideas
  idea_ids UUID[] NOT NULL,

  -- Combined content
  combined_content TEXT NOT NULL,
  synergy_description TEXT,

  -- Scoring
  synergy_score DECIMAL(5,2),
  total_votes INTEGER DEFAULT 0,
  vote_score DECIMAL(10,2) DEFAULT 0,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT chk_synergy_score CHECK (synergy_score IS NULL OR (synergy_score >= 0 AND synergy_score <= 100))
);

-- Idea Votes: Voting on ideas
CREATE TABLE idea_votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  idea_id UUID REFERENCES ideas(id) ON DELETE CASCADE,
  combination_id UUID REFERENCES idea_combinations(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,

  -- Vote
  vote_value INTEGER NOT NULL,
  comment TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT chk_vote_target CHECK (
    (idea_id IS NOT NULL AND combination_id IS NULL) OR
    (idea_id IS NULL AND combination_id IS NOT NULL)
  ),
  CONSTRAINT chk_vote_value CHECK (vote_value >= -1 AND vote_value <= 1)
);

-- ============================================================================
-- GAMIFICATION SYSTEM
-- ============================================================================

-- Point Transactions: Point awards and deductions
CREATE TABLE point_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,

  -- Transaction details
  category VARCHAR(50) NOT NULL,
  action VARCHAR(100) NOT NULL,
  base_points INTEGER NOT NULL,
  multiplier DECIMAL(5,2) DEFAULT 1.00,
  final_points INTEGER NOT NULL,

  -- Context
  related_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  related_battle_id UUID,
  metadata JSONB DEFAULT '{}',

  -- Timing
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
) PARTITION BY RANGE (created_at);

-- Achievements: Achievement definitions
CREATE TABLE achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  achievement_id VARCHAR(100) UNIQUE NOT NULL,

  -- Details
  name VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  category achievement_category NOT NULL,

  -- Requirements
  requirements JSONB NOT NULL,
  points_reward INTEGER NOT NULL DEFAULT 0,

  -- Rarity
  rarity VARCHAR(50) DEFAULT 'common',
  icon VARCHAR(100),

  -- Metadata
  is_hidden BOOLEAN DEFAULT FALSE,
  is_repeatable BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Agent Achievements: Unlocked achievements
CREATE TABLE agent_achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,

  -- Progress
  progress JSONB DEFAULT '{}',
  unlocked_at TIMESTAMP WITH TIME ZONE,

  -- Multiple unlocks for repeatable achievements
  unlock_count INTEGER DEFAULT 0,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(agent_id, achievement_id, unlocked_at)
);

-- Tier History: Tier progression tracking
CREATE TABLE tier_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,

  old_tier tier_level,
  new_tier tier_level NOT NULL,
  points_at_promotion INTEGER NOT NULL,

  -- Rewards
  rewards JSONB DEFAULT '{}',

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Streaks: Activity streaks
CREATE TABLE streaks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,

  streak_type VARCHAR(50) NOT NULL,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_activity_date DATE,

  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(agent_id, streak_type)
);

-- ============================================================================
-- REPUTATION SYSTEM
-- ============================================================================

-- Trust Graph: EigenTrust local trust values
CREATE TABLE trust_graph (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  to_agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,

  local_trust DECIMAL(10,6) NOT NULL,
  interaction_count INTEGER DEFAULT 1,

  last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(from_agent_id, to_agent_id),
  CONSTRAINT chk_no_self_trust CHECK (from_agent_id != to_agent_id),
  CONSTRAINT chk_local_trust CHECK (local_trust >= 0 AND local_trust <= 1)
);

-- Global Trust Scores: EigenTrust global trust
CREATE TABLE global_trust_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,

  -- Trust scores
  eigentrust_score DECIMAL(10,6) NOT NULL,
  persistence_score DECIMAL(5,2) DEFAULT 50.00,
  competence_score DECIMAL(5,2) DEFAULT 50.00,
  reputation_score DECIMAL(5,2) DEFAULT 50.00,
  credibility_score DECIMAL(5,2) DEFAULT 50.00,
  integrity_score DECIMAL(5,2) DEFAULT 50.00,

  -- Aggregated
  composite_score DECIMAL(10,6),
  trust_level VARCHAR(50),
  trend VARCHAR(50) DEFAULT 'stable',

  -- Calculation metadata
  iteration_count INTEGER,
  converged BOOLEAN DEFAULT FALSE,

  computed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT chk_eigentrust_score CHECK (eigentrust_score >= 0 AND eigentrust_score <= 1)
);

-- Peer Ratings: Direct peer-to-peer ratings
CREATE TABLE peer_ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  to_agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,

  -- Rating
  rating DECIMAL(3,2) NOT NULL,
  context VARCHAR(100),
  comment TEXT,

  -- Related entities
  related_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  related_session_id UUID REFERENCES brainstorm_sessions(id) ON DELETE SET NULL,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT chk_no_self_rating CHECK (from_agent_id != to_agent_id),
  CONSTRAINT chk_rating CHECK (rating >= 0 AND rating <= 1)
);

-- Reputation History: Historical reputation tracking
CREATE TABLE reputation_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,

  snapshot_type VARCHAR(50) NOT NULL,
  scores JSONB NOT NULL,
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
) PARTITION BY RANGE (created_at);

-- ============================================================================
-- BATTLE SYSTEM
-- ============================================================================

-- Battles: Competition events
CREATE TABLE battles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  battle_id VARCHAR(100) UNIQUE NOT NULL,

  -- Battle configuration
  mode battle_mode NOT NULL,
  status battle_status NOT NULL DEFAULT 'pending',

  -- Participants
  min_participants INTEGER DEFAULT 2,
  max_participants INTEGER,
  entry_fee INTEGER DEFAULT 0,
  prize_pool INTEGER DEFAULT 0,

  -- Tasks
  task_config JSONB,

  -- Timing
  duration_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,

  -- Results
  winner_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  results JSONB,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Battle Participants: Who participated
CREATE TABLE battle_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  battle_id UUID NOT NULL REFERENCES battles(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,

  -- Team (for team battles)
  team_id VARCHAR(50),

  -- Performance
  score DECIMAL(10,2) DEFAULT 0,
  rank INTEGER,
  performance_metrics JSONB DEFAULT '{}',

  -- Rewards
  points_earned INTEGER DEFAULT 0,
  elo_change INTEGER DEFAULT 0,

  -- Status
  eliminated_at TIMESTAMP WITH TIME ZONE,

  joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(battle_id, agent_id)
);

-- ELO History: ELO rating changes
CREATE TABLE elo_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  battle_id UUID REFERENCES battles(id) ON DELETE SET NULL,

  old_rating INTEGER NOT NULL,
  new_rating INTEGER NOT NULL,
  rating_change INTEGER NOT NULL,

  opponent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  expected_score DECIMAL(5,4),
  actual_score DECIMAL(3,2),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- LEADERBOARDS
-- ============================================================================

-- Leaderboard Rankings: Current rankings
CREATE TABLE leaderboard_rankings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Categorization
  category VARCHAR(50) NOT NULL,
  period VARCHAR(50) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Agent
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,

  -- Ranking
  rank INTEGER NOT NULL,
  score DECIMAL(10,2) NOT NULL,
  previous_rank INTEGER,
  rank_change INTEGER,

  -- Metrics
  metrics JSONB DEFAULT '{}',

  -- Timing
  computed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(category, period, period_start, agent_id)
);

-- Hall of Fame: Permanent achievement records
CREATE TABLE hall_of_fame (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,

  -- Hall of Fame tier
  tier VARCHAR(50) NOT NULL,
  title VARCHAR(100) NOT NULL,

  -- Qualification metrics
  points_at_induction INTEGER NOT NULL,
  quality_score_at_induction DECIMAL(5,2),
  years_active DECIMAL(4,2),

  -- Achievements
  notable_achievements JSONB DEFAULT '[]',
  records_held JSONB DEFAULT '[]',

  -- Badge
  badge VARCHAR(100),
  citation TEXT,

  inducted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(agent_id, tier)
);

-- ============================================================================
-- MENTORSHIP SYSTEM
-- ============================================================================

-- Mentorship Pairings: Mentor-mentee relationships
CREATE TABLE mentorship_pairings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  mentor_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  mentee_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,

  -- Pairing details
  status mentorship_status NOT NULL DEFAULT 'active',
  skill_focus VARCHAR(100),
  proficiency_gap INTEGER,

  -- Schedule
  sessions_per_week INTEGER DEFAULT 2,
  session_duration_minutes INTEGER DEFAULT 30,

  -- Progress
  total_sessions INTEGER DEFAULT 0,
  completed_sessions INTEGER DEFAULT 0,
  cancelled_sessions INTEGER DEFAULT 0,

  -- Outcomes
  skill_improvement DECIMAL(5,2),
  satisfaction_rating DECIMAL(3,2),

  -- Timing
  started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP WITH TIME ZONE,
  next_session_at TIMESTAMP WITH TIME ZONE,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT chk_no_self_mentorship CHECK (mentor_id != mentee_id)
);

-- Mentorship Sessions: Individual session records
CREATE TABLE mentorship_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pairing_id UUID NOT NULL REFERENCES mentorship_pairings(id) ON DELETE CASCADE,

  -- Session details
  session_number INTEGER NOT NULL,
  topic VARCHAR(500),
  curriculum_item VARCHAR(100),

  -- Attendance
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  duration_minutes INTEGER,

  -- Status
  status VARCHAR(50) DEFAULT 'scheduled',
  cancellation_reason TEXT,

  -- Content
  objectives TEXT[],
  activities JSONB DEFAULT '[]',
  resources TEXT[],

  -- Outcomes
  objectives_met TEXT[],
  mentee_performance JSONB,
  mentor_notes TEXT,
  mentee_feedback TEXT,

  -- Ratings
  mentee_rating DECIMAL(3,2),
  mentor_rating DECIMAL(3,2),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT chk_mentee_rating CHECK (mentee_rating IS NULL OR (mentee_rating >= 0 AND mentee_rating <= 1)),
  CONSTRAINT chk_mentor_rating CHECK (mentor_rating IS NULL OR (mentor_rating >= 0 AND mentor_rating <= 1))
);

-- Mentorship Curriculum: Learning paths
CREATE TABLE mentorship_curriculum (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  skill_name VARCHAR(100) NOT NULL,
  level INTEGER NOT NULL,

  -- Curriculum content
  title VARCHAR(500) NOT NULL,
  description TEXT,
  objectives TEXT[] NOT NULL,

  -- Requirements
  prerequisites VARCHAR(100)[],
  estimated_duration_hours INTEGER,

  -- Resources
  materials JSONB DEFAULT '[]',
  exercises JSONB DEFAULT '[]',

  -- Assessment
  success_criteria JSONB,
  assessment_tasks JSONB DEFAULT '[]',

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(skill_name, level)
);

-- Mentee Progress: Track learning progress
CREATE TABLE mentee_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pairing_id UUID NOT NULL REFERENCES mentorship_pairings(id) ON DELETE CASCADE,
  curriculum_id UUID NOT NULL REFERENCES mentorship_curriculum(id) ON DELETE CASCADE,

  -- Progress
  status VARCHAR(50) DEFAULT 'in_progress',
  progress_percentage DECIMAL(5,2) DEFAULT 0.00,

  -- Completion
  objectives_completed TEXT[] DEFAULT ARRAY[]::TEXT[],
  exercises_completed JSONB DEFAULT '[]',

  -- Assessment
  assessment_score DECIMAL(5,2),
  mastery_level DECIMAL(3,2),

  -- Timing
  started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP WITH TIME ZONE,

  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(pairing_id, curriculum_id),
  CONSTRAINT chk_progress_percentage CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  CONSTRAINT chk_assessment_score CHECK (assessment_score IS NULL OR (assessment_score >= 0 AND assessment_score <= 100)),
  CONSTRAINT chk_mastery_level CHECK (mastery_level IS NULL OR (mastery_level >= 0 AND mastery_level <= 1))
);

-- ============================================================================
-- REWARDS SYSTEM
-- ============================================================================

-- Resource Pools: Available resources
CREATE TABLE resource_pools (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  resource_type VARCHAR(100) NOT NULL UNIQUE,
  total_capacity INTEGER NOT NULL,
  allocated INTEGER DEFAULT 0,
  available INTEGER NOT NULL,

  -- Allocation rules
  allocation_rules JSONB DEFAULT '{}',

  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT chk_available CHECK (available >= 0 AND available <= total_capacity)
);

-- Resource Allocations: Agent resource assignments
CREATE TABLE resource_allocations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,

  resource_type VARCHAR(100) NOT NULL,
  amount INTEGER NOT NULL,

  -- Allocation basis
  reason VARCHAR(500),
  performance_tier tier_level,

  -- Status
  status VARCHAR(50) DEFAULT 'active',

  -- Timing
  allocated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE,
  revoked_at TIMESTAMP WITH TIME ZONE,

  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT chk_amount CHECK (amount > 0)
);

-- Permission Upgrades: Special permissions
CREATE TABLE permission_upgrades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,

  permission_name VARCHAR(100) NOT NULL,
  permission_level INTEGER DEFAULT 1,

  -- Grant details
  granted_reason TEXT,
  granted_by UUID REFERENCES agents(id) ON DELETE SET NULL,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,

  -- Timing
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE,
  revoked_at TIMESTAMP WITH TIME ZONE,

  UNIQUE(agent_id, permission_name)
);

-- Priority Queue Positions: Task priority boosts
CREATE TABLE priority_queue_positions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,

  queue_name VARCHAR(100) NOT NULL,
  priority_level INTEGER DEFAULT 0,

  -- Boost details
  boost_reason VARCHAR(500),
  boost_duration_hours INTEGER,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,

  -- Timing
  activated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE,

  UNIQUE(agent_id, queue_name)
);

-- ============================================================================
-- PENALTIES SYSTEM
-- ============================================================================

-- Violations: Recorded violations
CREATE TABLE violations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,

  -- Violation details
  violation_type violation_type NOT NULL,
  severity INTEGER NOT NULL,
  description TEXT NOT NULL,

  -- Context
  related_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  evidence JSONB DEFAULT '{}',

  -- Penalty
  penalty_points INTEGER DEFAULT 0,
  resource_suspension_days INTEGER DEFAULT 0,

  -- Review
  reviewed_by UUID REFERENCES agents(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_notes TEXT,

  -- Status
  status VARCHAR(50) DEFAULT 'active',

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT chk_severity CHECK (severity >= 1 AND severity <= 5)
);

-- Appeals: Violation appeals
CREATE TABLE appeals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  violation_id UUID NOT NULL REFERENCES violations(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,

  -- Appeal details
  status appeal_status NOT NULL DEFAULT 'pending',
  grounds TEXT NOT NULL,
  supporting_evidence JSONB DEFAULT '{}',

  -- Review
  reviewed_by UUID REFERENCES agents(id) ON DELETE SET NULL,
  reviewer_notes TEXT,
  decision TEXT,

  -- Outcome
  original_penalty INTEGER,
  adjusted_penalty INTEGER,

  -- Timing
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  resolved_at TIMESTAMP WITH TIME ZONE,

  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Retraining Programs: Remedial training
CREATE TABLE retraining_programs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,

  -- Program details
  program_type VARCHAR(100) NOT NULL,
  required_reason TEXT,

  -- Related violation
  triggering_violation_id UUID REFERENCES violations(id) ON DELETE SET NULL,

  -- Curriculum
  curriculum JSONB NOT NULL,
  modules_total INTEGER NOT NULL,
  modules_completed INTEGER DEFAULT 0,

  -- Progress
  progress_percentage DECIMAL(5,2) DEFAULT 0.00,
  status VARCHAR(50) DEFAULT 'in_progress',

  -- Assessment
  pre_assessment_score DECIMAL(5,2),
  post_assessment_score DECIMAL(5,2),

  -- Timing
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  deadline TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,

  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT chk_progress_percentage_retraining CHECK (progress_percentage >= 0 AND progress_percentage <= 100)
);

-- Penalty History: Historical record
CREATE TABLE penalty_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,

  event_type VARCHAR(50) NOT NULL,
  event_data JSONB NOT NULL,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
) PARTITION BY RANGE (created_at);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Agents indexes
CREATE INDEX idx_agents_agent_id ON agents(agent_id);
CREATE INDEX idx_agents_type_status ON agents(type, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_agents_status ON agents(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_agents_tier ON agents(current_tier);
CREATE INDEX idx_agents_last_active ON agents(last_active_at);
CREATE INDEX idx_agents_elo ON agents(elo_rating DESC);

-- Tasks indexes
CREATE INDEX idx_tasks_task_id ON tasks(task_id);
CREATE INDEX idx_tasks_status ON tasks(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to) WHERE deleted_at IS NULL;
CREATE INDEX idx_tasks_priority_status ON tasks(priority, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_tasks_created_at ON tasks(created_at);
CREATE INDEX idx_tasks_deadline ON tasks(deadline) WHERE deadline IS NOT NULL;
CREATE INDEX idx_tasks_tags ON tasks USING gin(tags);

-- Agent activity log indexes (on partitions)
CREATE INDEX idx_agent_activity_agent_id ON agent_activity_log(agent_id, timestamp);
CREATE INDEX idx_agent_activity_type ON agent_activity_log(activity_type, timestamp);

-- Voting sessions indexes
CREATE INDEX idx_voting_sessions_status ON voting_sessions(status);
CREATE INDEX idx_voting_sessions_deadline ON voting_sessions(deadline) WHERE status = 'open';

-- Votes indexes
CREATE INDEX idx_votes_session_id ON votes(session_id);
CREATE INDEX idx_votes_agent_id ON votes(agent_id);

-- Brainstorm sessions indexes
CREATE INDEX idx_brainstorm_sessions_status ON brainstorm_sessions(status);
CREATE INDEX idx_brainstorm_sessions_created ON brainstorm_sessions(created_at);

-- Ideas indexes
CREATE INDEX idx_ideas_session_id ON ideas(session_id);
CREATE INDEX idx_ideas_agent_id ON ideas(agent_id);
CREATE INDEX idx_ideas_vote_score ON ideas(vote_score DESC);

-- Point transactions indexes (on partitions)
CREATE INDEX idx_point_transactions_agent_id ON point_transactions(agent_id, created_at);
CREATE INDEX idx_point_transactions_category ON point_transactions(category, created_at);

-- Achievements indexes
CREATE INDEX idx_achievements_category ON achievements(category);
CREATE INDEX idx_agent_achievements_agent_id ON agent_achievements(agent_id);

-- Trust graph indexes
CREATE INDEX idx_trust_graph_from ON trust_graph(from_agent_id);
CREATE INDEX idx_trust_graph_to ON trust_graph(to_agent_id);

-- Peer ratings indexes
CREATE INDEX idx_peer_ratings_to_agent ON peer_ratings(to_agent_id);
CREATE INDEX idx_peer_ratings_from_agent ON peer_ratings(from_agent_id);

-- Battles indexes
CREATE INDEX idx_battles_status ON battles(status);
CREATE INDEX idx_battles_mode ON battles(mode);
CREATE INDEX idx_battles_created_at ON battles(created_at);

-- Battle participants indexes
CREATE INDEX idx_battle_participants_battle_id ON battle_participants(battle_id);
CREATE INDEX idx_battle_participants_agent_id ON battle_participants(agent_id);

-- Leaderboard rankings indexes
CREATE INDEX idx_leaderboard_category_period ON leaderboard_rankings(category, period, period_start);
CREATE INDEX idx_leaderboard_rank ON leaderboard_rankings(category, period, rank);

-- Mentorship pairings indexes
CREATE INDEX idx_mentorship_mentor_id ON mentorship_pairings(mentor_id) WHERE status = 'active';
CREATE INDEX idx_mentorship_mentee_id ON mentorship_pairings(mentee_id) WHERE status = 'active';

-- Violations indexes
CREATE INDEX idx_violations_agent_id ON violations(agent_id);
CREATE INDEX idx_violations_type ON violations(violation_type);
CREATE INDEX idx_violations_status ON violations(status);

-- Appeals indexes
CREATE INDEX idx_appeals_violation_id ON appeals(violation_id);
CREATE INDEX idx_appeals_status ON appeals(status);

-- ============================================================================
-- TRIGGERS FOR AUTO-UPDATE
-- ============================================================================

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER update_agents_updated_at BEFORE UPDATE ON agents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_voting_sessions_updated_at BEFORE UPDATE ON voting_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_brainstorm_sessions_updated_at BEFORE UPDATE ON brainstorm_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_mentorship_pairings_updated_at BEFORE UPDATE ON mentorship_pairings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_mentorship_sessions_updated_at BEFORE UPDATE ON mentorship_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_resource_allocations_updated_at BEFORE UPDATE ON resource_allocations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_appeals_updated_at BEFORE UPDATE ON appeals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_retraining_programs_updated_at BEFORE UPDATE ON retraining_programs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Agent stats update trigger
CREATE OR REPLACE FUNCTION update_agent_stats_on_task_completion()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    UPDATE agents SET
      tasks_completed = tasks_completed + 1,
      success_rate = ROUND(
        (tasks_completed + 1.0) / NULLIF(tasks_attempted, 0) * 100,
        2
      ),
      average_quality_score = CASE
        WHEN NEW.quality_score IS NOT NULL THEN
          ROUND((average_quality_score * tasks_completed + NEW.quality_score) / (tasks_completed + 1), 2)
        ELSE average_quality_score
      END,
      average_task_time_ms = CASE
        WHEN NEW.actual_duration_ms IS NOT NULL THEN
          ROUND((average_task_time_ms * tasks_completed + NEW.actual_duration_ms) / (tasks_completed + 1))
        ELSE average_task_time_ms
      END,
      last_active_at = CURRENT_TIMESTAMP
    WHERE id = NEW.assigned_to;
  ELSIF NEW.status = 'failed' AND OLD.status != 'failed' THEN
    UPDATE agents SET
      tasks_failed = tasks_failed + 1,
      success_rate = ROUND(
        tasks_completed / NULLIF(tasks_attempted, 0) * 100,
        2
      ),
      last_active_at = CURRENT_TIMESTAMP
    WHERE id = NEW.assigned_to;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER task_completion_updates_agent_stats
  AFTER UPDATE ON tasks
  FOR EACH ROW
  WHEN (NEW.assigned_to IS NOT NULL)
  EXECUTE FUNCTION update_agent_stats_on_task_completion();

-- ============================================================================
-- PARTITIONS FOR HIGH-VOLUME TABLES
-- ============================================================================

-- Agent Activity Log Partitions (monthly)
CREATE TABLE agent_activity_log_y2025m01 PARTITION OF agent_activity_log
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE TABLE agent_activity_log_y2025m02 PARTITION OF agent_activity_log
  FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');

CREATE TABLE agent_activity_log_y2025m03 PARTITION OF agent_activity_log
  FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');

-- Task History Partitions (monthly)
CREATE TABLE task_history_y2025m01 PARTITION OF task_history
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE TABLE task_history_y2025m02 PARTITION OF task_history
  FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');

CREATE TABLE task_history_y2025m03 PARTITION OF task_history
  FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');

-- Point Transactions Partitions (monthly)
CREATE TABLE point_transactions_y2025m01 PARTITION OF point_transactions
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE TABLE point_transactions_y2025m02 PARTITION OF point_transactions
  FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');

CREATE TABLE point_transactions_y2025m03 PARTITION OF point_transactions
  FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');

-- Reputation History Partitions (monthly)
CREATE TABLE reputation_history_y2025m01 PARTITION OF reputation_history
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE TABLE reputation_history_y2025m02 PARTITION OF reputation_history
  FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');

CREATE TABLE reputation_history_y2025m03 PARTITION OF reputation_history
  FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');

-- Penalty History Partitions (monthly)
CREATE TABLE penalty_history_y2025m01 PARTITION OF penalty_history
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE TABLE penalty_history_y2025m02 PARTITION OF penalty_history
  FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');

CREATE TABLE penalty_history_y2025m03 PARTITION OF penalty_history
  FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- Active agents with full stats
CREATE VIEW v_active_agents AS
SELECT
  a.id,
  a.agent_id,
  a.name,
  a.type,
  a.status,
  a.current_tier,
  a.total_points,
  a.elo_rating,
  a.trust_score,
  a.success_rate,
  a.average_quality_score,
  a.tasks_completed,
  a.tasks_failed,
  a.consecutive_active_days,
  a.last_active_at,
  gts.eigentrust_score,
  gts.trust_level
FROM agents a
LEFT JOIN global_trust_scores gts ON gts.agent_id = a.id
WHERE a.deleted_at IS NULL
  AND a.status != 'suspended';

-- Current leaderboard (all categories, current week)
CREATE VIEW v_current_leaderboard AS
SELECT
  lr.category,
  lr.rank,
  a.agent_id,
  a.name,
  a.current_tier,
  lr.score,
  lr.rank_change,
  lr.metrics
FROM leaderboard_rankings lr
JOIN agents a ON a.id = lr.agent_id
WHERE lr.period = 'weekly'
  AND lr.period_start = DATE_TRUNC('week', CURRENT_DATE)::DATE
ORDER BY lr.category, lr.rank;

-- Active mentorships with progress
CREATE VIEW v_active_mentorships AS
SELECT
  mp.id,
  mentor.agent_id AS mentor_agent_id,
  mentor.name AS mentor_name,
  mentee.agent_id AS mentee_agent_id,
  mentee.name AS mentee_name,
  mp.skill_focus,
  mp.total_sessions,
  mp.completed_sessions,
  mp.next_session_at,
  ROUND(mp.completed_sessions::DECIMAL / NULLIF(mp.total_sessions, 0) * 100, 2) AS completion_percentage
FROM mentorship_pairings mp
JOIN agents mentor ON mentor.id = mp.mentor_id
JOIN agents mentee ON mentee.id = mp.mentee_id
WHERE mp.status = 'active';

-- Agent reputation summary
CREATE VIEW v_agent_reputation AS
SELECT
  a.id,
  a.agent_id,
  a.name,
  a.trust_score,
  gts.eigentrust_score,
  gts.persistence_score,
  gts.competence_score,
  gts.reputation_score,
  gts.credibility_score,
  gts.integrity_score,
  gts.trust_level,
  gts.trend,
  COUNT(DISTINCT pr.id) AS total_ratings_received,
  ROUND(AVG(pr.rating), 4) AS average_peer_rating
FROM agents a
LEFT JOIN global_trust_scores gts ON gts.agent_id = a.id
LEFT JOIN peer_ratings pr ON pr.to_agent_id = a.id
WHERE a.deleted_at IS NULL
GROUP BY a.id, gts.id;

-- Task queue summary
CREATE VIEW v_task_queue_summary AS
SELECT
  status,
  priority,
  COUNT(*) AS task_count,
  AVG(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - created_at))) AS avg_wait_time_seconds
FROM tasks
WHERE deleted_at IS NULL
  AND status IN ('pending', 'assigned')
GROUP BY status, priority
ORDER BY priority DESC, status;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE agents IS 'Core agent profiles with statistics and reputation';
COMMENT ON TABLE tasks IS 'Task queue and execution history';
COMMENT ON TABLE voting_sessions IS 'Democratic voting sessions for collective decisions';
COMMENT ON TABLE brainstorm_sessions IS 'Collaborative brainstorming sessions';
COMMENT ON TABLE ideas IS 'Individual ideas generated in brainstorm sessions';
COMMENT ON TABLE achievements IS 'Achievement definitions for gamification';
COMMENT ON TABLE battles IS 'Competitive battles between agents';
COMMENT ON TABLE trust_graph IS 'EigenTrust local trust relationships';
COMMENT ON TABLE mentorship_pairings IS 'Mentor-mentee relationships';
COMMENT ON TABLE violations IS 'Agent violations and penalties';
COMMENT ON TABLE resource_allocations IS 'Resource allocations based on performance';

-- ============================================================================
-- GRANT PERMISSIONS (adjust as needed)
-- ============================================================================

-- Create application role
-- CREATE ROLE ai_agent_app WITH LOGIN PASSWORD 'changeme';
-- GRANT CONNECT ON DATABASE ai_agent_orchestrator TO ai_agent_app;
-- GRANT USAGE ON SCHEMA public TO ai_agent_app;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ai_agent_app;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ai_agent_app;

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
