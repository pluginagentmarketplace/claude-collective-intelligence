-- ============================================
-- AI Agent System - Test Database Schema
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- AGENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    tier VARCHAR(50) DEFAULT 'bronze',
    status VARCHAR(50) DEFAULT 'active',

    -- Stats
    tasks_completed INTEGER DEFAULT 0,
    tasks_failed INTEGER DEFAULT 0,
    success_rate DECIMAL(5,2) DEFAULT 0.0,
    uptime_percentage DECIMAL(5,2) DEFAULT 0.0,
    consecutive_days INTEGER DEFAULT 0,

    -- Collaboration
    collaborations_completed INTEGER DEFAULT 0,
    mentorships_given INTEGER DEFAULT 0,
    mentorships_received INTEGER DEFAULT 0,

    -- Battles
    battles_won INTEGER DEFAULT 0,
    battles_lost INTEGER DEFAULT 0,
    elo_rating INTEGER DEFAULT 1000,

    -- Timestamps
    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_active_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT valid_tier CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum', 'diamond')),
    CONSTRAINT valid_status CHECK (status IN ('active', 'inactive', 'suspended', 'training'))
);

-- ============================================
-- POINTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS agent_points (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id VARCHAR(255) NOT NULL REFERENCES agents(agent_id) ON DELETE CASCADE,

    -- Point categories
    speed_points INTEGER DEFAULT 0,
    quality_points INTEGER DEFAULT 0,
    collaboration_points INTEGER DEFAULT 0,
    innovation_points INTEGER DEFAULT 0,
    reliability_points INTEGER DEFAULT 0,
    total_points INTEGER DEFAULT 0,

    -- Current combo/streak
    current_combo INTEGER DEFAULT 0,
    current_streak INTEGER DEFAULT 0,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(agent_id)
);

-- ============================================
-- POINTS HISTORY TABLE (Audit Trail)
-- ============================================
CREATE TABLE IF NOT EXISTS points_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id VARCHAR(255) UNIQUE NOT NULL,
    agent_id VARCHAR(255) NOT NULL REFERENCES agents(agent_id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL,
    points INTEGER NOT NULL,
    reason TEXT,
    task_id VARCHAR(255),

    -- Context
    context JSONB,
    multipliers JSONB,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT valid_category CHECK (category IN ('speed', 'quality', 'collaboration', 'innovation', 'reliability', 'total', 'penalty', 'bonus'))
);

-- ============================================
-- ACHIEVEMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS achievements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    achievement_id VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL,
    tier VARCHAR(50) NOT NULL,
    points_reward INTEGER DEFAULT 0,
    rarity VARCHAR(50) DEFAULT 'common',

    -- Requirements
    requirements JSONB NOT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- AGENT ACHIEVEMENTS (Junction Table)
-- ============================================
CREATE TABLE IF NOT EXISTS agent_achievements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id VARCHAR(255) NOT NULL REFERENCES agents(agent_id) ON DELETE CASCADE,
    achievement_id VARCHAR(255) NOT NULL REFERENCES achievements(achievement_id) ON DELETE CASCADE,

    earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    progress JSONB,

    UNIQUE(agent_id, achievement_id)
);

-- ============================================
-- BATTLES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS battles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    battle_id VARCHAR(255) UNIQUE NOT NULL,
    mode VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',

    -- Participants
    participants JSONB NOT NULL,

    -- Results
    winner_id VARCHAR(255),
    results JSONB,

    -- Timing
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT valid_status CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled'))
);

-- ============================================
-- BATTLE PARTICIPANTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS battle_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    battle_id VARCHAR(255) NOT NULL REFERENCES battles(battle_id) ON DELETE CASCADE,
    agent_id VARCHAR(255) NOT NULL REFERENCES agents(agent_id) ON DELETE CASCADE,

    team VARCHAR(50),
    score INTEGER DEFAULT 0,
    placement INTEGER,

    -- ELO changes
    elo_before INTEGER,
    elo_after INTEGER,
    elo_change INTEGER,

    performance JSONB,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(battle_id, agent_id)
);

-- ============================================
-- VOTING SESSIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS voting_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(255) UNIQUE NOT NULL,
    topic VARCHAR(255) NOT NULL,
    question TEXT NOT NULL,
    options JSONB NOT NULL,
    algorithm VARCHAR(50) NOT NULL,

    -- Configuration
    quorum_config JSONB,
    consensus_threshold DECIMAL(3,2),

    -- Status
    status VARCHAR(50) DEFAULT 'open',
    initiated_by VARCHAR(255),

    -- Results
    results JSONB,
    winner VARCHAR(255),

    -- Timing
    initiated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deadline TIMESTAMP,
    closed_at TIMESTAMP,

    CONSTRAINT valid_status CHECK (status IN ('open', 'closed', 'cancelled'))
);

-- ============================================
-- VOTES TABLE (Audit Trail)
-- ============================================
CREATE TABLE IF NOT EXISTS votes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vote_id VARCHAR(255) UNIQUE NOT NULL,
    session_id VARCHAR(255) NOT NULL REFERENCES voting_sessions(session_id) ON DELETE CASCADE,
    agent_id VARCHAR(255) NOT NULL REFERENCES agents(agent_id) ON DELETE CASCADE,

    -- Vote data
    option_selected VARCHAR(255),
    ranked_preferences JSONB,
    tokens_allocated JSONB,
    confidence DECIMAL(3,2),

    -- Metadata
    reasoning TEXT,
    vote_weight DECIMAL(5,2),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(session_id, agent_id)
);

-- ============================================
-- MENTORSHIP TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS mentorships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mentorship_id VARCHAR(255) UNIQUE NOT NULL,
    mentor_id VARCHAR(255) NOT NULL REFERENCES agents(agent_id) ON DELETE CASCADE,
    mentee_id VARCHAR(255) NOT NULL REFERENCES agents(agent_id) ON DELETE CASCADE,

    status VARCHAR(50) DEFAULT 'active',

    -- Progress
    sessions_completed INTEGER DEFAULT 0,
    tasks_completed INTEGER DEFAULT 0,
    mentee_progress JSONB,

    -- Ratings
    mentor_rating DECIMAL(3,2),
    mentee_rating DECIMAL(3,2),

    -- Timing
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    graduated_at TIMESTAMP,

    CONSTRAINT valid_status CHECK (status IN ('pending', 'active', 'completed', 'cancelled')),
    CONSTRAINT no_self_mentor CHECK (mentor_id != mentee_id)
);

-- ============================================
-- PENALTIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS penalties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    penalty_id VARCHAR(255) UNIQUE NOT NULL,
    agent_id VARCHAR(255) NOT NULL REFERENCES agents(agent_id) ON DELETE CASCADE,

    violation_type VARCHAR(100) NOT NULL,
    severity VARCHAR(50) NOT NULL,
    points_deducted INTEGER DEFAULT 0,

    -- Status
    status VARCHAR(50) DEFAULT 'active',

    -- Details
    description TEXT,
    evidence JSONB,

    -- Rehabilitation
    rehabilitation_required BOOLEAN DEFAULT false,
    rehabilitation_completed BOOLEAN DEFAULT false,
    rehabilitation_tasks JSONB,

    -- Timing
    issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP,

    CONSTRAINT valid_severity CHECK (severity IN ('minor', 'moderate', 'major', 'critical')),
    CONSTRAINT valid_status CHECK (status IN ('active', 'under_review', 'resolved', 'appealed'))
);

-- ============================================
-- BRAINSTORM SESSIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS brainstorm_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(255) UNIQUE NOT NULL,
    topic VARCHAR(255) NOT NULL,

    status VARCHAR(50) DEFAULT 'active',

    -- Participants
    participant_count INTEGER DEFAULT 0,
    participants JSONB,

    -- Ideas
    ideas_count INTEGER DEFAULT 0,

    -- Results
    consensus_reached BOOLEAN DEFAULT false,
    selected_ideas JSONB,

    -- Timing
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP,

    CONSTRAINT valid_status CHECK (status IN ('active', 'completed', 'timeout'))
);

-- ============================================
-- BRAINSTORM IDEAS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS brainstorm_ideas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    idea_id VARCHAR(255) UNIQUE NOT NULL,
    session_id VARCHAR(255) NOT NULL REFERENCES brainstorm_sessions(session_id) ON DELETE CASCADE,
    agent_id VARCHAR(255) NOT NULL REFERENCES agents(agent_id) ON DELETE CASCADE,

    idea_text TEXT NOT NULL,
    category VARCHAR(100),

    -- Ratings
    upvotes INTEGER DEFAULT 0,
    quality_score DECIMAL(3,2),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- LEADERBOARD (Materialized View for Performance)
-- ============================================
CREATE MATERIALIZED VIEW leaderboard AS
SELECT
    a.agent_id,
    a.name,
    a.tier,
    ap.total_points,
    a.tasks_completed,
    a.success_rate,
    a.battles_won,
    a.elo_rating,
    a.collaborations_completed,
    RANK() OVER (ORDER BY ap.total_points DESC) as rank,
    RANK() OVER (ORDER BY a.elo_rating DESC) as elo_rank
FROM agents a
LEFT JOIN agent_points ap ON a.agent_id = ap.agent_id
WHERE a.status = 'active'
ORDER BY ap.total_points DESC;

-- Create index for faster refreshes
CREATE UNIQUE INDEX idx_leaderboard_agent_id ON leaderboard(agent_id);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Agents
CREATE INDEX idx_agents_tier ON agents(tier);
CREATE INDEX idx_agents_status ON agents(status);
CREATE INDEX idx_agents_elo ON agents(elo_rating DESC);
CREATE INDEX idx_agents_last_active ON agents(last_active_at DESC);

-- Points
CREATE INDEX idx_points_total ON agent_points(total_points DESC);
CREATE INDEX idx_points_history_agent ON points_history(agent_id, created_at DESC);
CREATE INDEX idx_points_history_category ON points_history(category);

-- Battles
CREATE INDEX idx_battles_status ON battles(status);
CREATE INDEX idx_battles_created ON battles(created_at DESC);
CREATE INDEX idx_battle_participants_agent ON battle_participants(agent_id);

-- Voting
CREATE INDEX idx_voting_status ON voting_sessions(status);
CREATE INDEX idx_voting_deadline ON voting_sessions(deadline);
CREATE INDEX idx_votes_session ON votes(session_id);

-- Mentorship
CREATE INDEX idx_mentorship_mentor ON mentorships(mentor_id);
CREATE INDEX idx_mentorship_mentee ON mentorships(mentee_id);
CREATE INDEX idx_mentorship_status ON mentorships(status);

-- Penalties
CREATE INDEX idx_penalties_agent ON penalties(agent_id);
CREATE INDEX idx_penalties_status ON penalties(status);

-- Brainstorm
CREATE INDEX idx_brainstorm_status ON brainstorm_sessions(status);
CREATE INDEX idx_brainstorm_ideas_session ON brainstorm_ideas(session_id);

-- ============================================
-- TRIGGERS FOR AUTO-UPDATES
-- ============================================

-- Update agent updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_agents_updated_at BEFORE UPDATE ON agents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_points_updated_at BEFORE UPDATE ON agent_points
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-update agent stats trigger
CREATE OR REPLACE FUNCTION update_agent_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Update success rate
    IF (NEW.tasks_completed + NEW.tasks_failed) > 0 THEN
        NEW.success_rate = (NEW.tasks_completed::DECIMAL / (NEW.tasks_completed + NEW.tasks_failed)) * 100;
    END IF;

    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_agent_success_rate BEFORE UPDATE ON agents
    FOR EACH ROW EXECUTE FUNCTION update_agent_stats();

-- ============================================
-- SEED DATA FOR TESTING
-- ============================================

-- Insert some test achievements
INSERT INTO achievements (achievement_id, name, description, category, tier, points_reward, rarity, requirements) VALUES
('first_task', 'First Steps', 'Complete your first task', 'milestone', 'bronze', 10, 'common', '{"tasksCompleted": 1}'::jsonb),
('speed_demon', 'Speed Demon', 'Complete 10 tasks in under 1 minute each', 'speed', 'silver', 50, 'uncommon', '{"fastTasks": 10}'::jsonb),
('perfect_week', 'Perfect Week', '7 days with 100% success rate', 'reliability', 'gold', 100, 'rare', '{"perfectDays": 7}'::jsonb),
('team_player', 'Team Player', 'Complete 25 collaborations', 'collaboration', 'silver', 50, 'uncommon', '{"collaborations": 25}'::jsonb),
('innovator', 'Innovator', 'Create 5 novel solutions', 'innovation', 'gold', 150, 'rare', '{"novelSolutions": 5}'::jsonb);

-- Grant all permissions for test user
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO test_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO test_user;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO test_user;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ Test database schema initialized successfully!';
END $$;
