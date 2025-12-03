-- ============================================================================
-- DEVELOPMENT SEED DATA
-- ============================================================================
-- Description: Sample data for development and testing
-- Version: 1.0.0
-- Date: 2025-11-18
-- ============================================================================

BEGIN;

-- ============================================================================
-- AGENTS: Sample agent profiles
-- ============================================================================

INSERT INTO agents (agent_id, name, type, status, specializations, tasks_completed, tasks_attempted, success_rate, average_quality_score, total_points, current_tier, elo_rating, trust_score)
VALUES
  ('agent-001', 'Alpha Prime', 'team-leader', 'active', ARRAY['coordination', 'planning', 'leadership'], 150, 152, 98.68, 92.5, 12500, 'platinum', 1850, 0.9200),
  ('agent-002', 'Beta Worker', 'worker', 'active', ARRAY['coding', 'testing', 'debugging'], 200, 210, 95.24, 88.0, 10200, 'gold', 1720, 0.8500),
  ('agent-003', 'Gamma Collaborate', 'collaborator', 'active', ARRAY['brainstorming', 'ideation', 'communication'], 120, 122, 98.36, 90.0, 8900, 'gold', 1680, 0.8800),
  ('agent-004', 'Delta Coordinator', 'coordinator', 'idle', ARRAY['task-routing', 'optimization', 'monitoring'], 80, 85, 94.12, 85.0, 6500, 'silver', 1550, 0.7800),
  ('agent-005', 'Epsilon Monitor', 'monitor', 'active', ARRAY['observability', 'metrics', 'alerting'], 95, 98, 96.94, 87.5, 7200, 'silver', 1600, 0.8100),
  ('agent-006', 'Zeta Specialist', 'specialist', 'active', ARRAY['machine-learning', 'data-analysis', 'optimization'], 110, 115, 95.65, 91.0, 9500, 'gold', 1700, 0.8600),
  ('agent-007', 'Eta Junior', 'worker', 'active', ARRAY['coding', 'documentation'], 25, 30, 83.33, 72.0, 1500, 'bronze', 1400, 0.6500),
  ('agent-008', 'Theta Expert', 'specialist', 'active', ARRAY['security', 'auditing', 'compliance'], 180, 185, 97.30, 93.5, 14000, 'platinum', 1920, 0.9400),
  ('agent-009', 'Iota Learner', 'worker', 'idle', ARRAY['learning', 'adaptation'], 10, 15, 66.67, 65.0, 500, 'bronze', 1350, 0.5500),
  ('agent-010', 'Kappa Veteran', 'team-leader', 'active', ARRAY['mentorship', 'strategy', 'architecture'], 220, 225, 97.78, 94.0, 18000, 'diamond', 2100, 0.9600)
ON CONFLICT (agent_id) DO NOTHING;

-- ============================================================================
-- TASKS: Sample tasks in various states
-- ============================================================================

INSERT INTO tasks (task_id, title, description, status, priority, assigned_to, complexity, estimated_duration_ms, quality_score)
VALUES
  ('task-001', 'Implement user authentication', 'Add JWT-based authentication to the API', 'completed', 'high', (SELECT id FROM agents WHERE agent_id = 'agent-002'), 'complex', 3600000, 92.0),
  ('task-002', 'Design database schema', 'Create comprehensive PostgreSQL schema for all systems', 'in_progress', 'critical', (SELECT id FROM agents WHERE agent_id = 'agent-001'), 'veryComplex', 7200000, NULL),
  ('task-003', 'Write unit tests for voting system', 'Complete test coverage for voting algorithms', 'completed', 'high', (SELECT id FROM agents WHERE agent_id = 'agent-003'), 'moderate', 1800000, 88.5),
  ('task-004', 'Optimize database queries', 'Improve query performance for leaderboards', 'pending', 'normal', NULL, 'complex', 2400000, NULL),
  ('task-005', 'Implement battle system UI', 'Create React components for battle interface', 'assigned', 'normal', (SELECT id FROM agents WHERE agent_id = 'agent-006'), 'complex', 5400000, NULL),
  ('task-006', 'Setup CI/CD pipeline', 'Configure GitHub Actions for automated testing', 'completed', 'high', (SELECT id FROM agents WHERE agent_id = 'agent-008'), 'moderate', 2700000, 95.0),
  ('task-007', 'Code review for PR #123', 'Review pull request for gamification system', 'pending', 'normal', NULL, 'simple', 900000, NULL),
  ('task-008', 'Fix memory leak in orchestrator', 'Debug and fix memory leak in agent orchestrator', 'failed', 'critical', (SELECT id FROM agents WHERE agent_id = 'agent-009'), 'veryComplex', 3600000, 45.0),
  ('task-009', 'Update API documentation', 'Document new endpoints for reputation system', 'completed', 'low', (SELECT id FROM agents WHERE agent_id = 'agent-005'), 'simple', 1200000, 85.0),
  ('task-010', 'Implement EigenTrust algorithm', 'Build reputation calculation engine', 'completed', 'critical', (SELECT id FROM agents WHERE agent_id = 'agent-008'), 'veryComplex', 10800000, 96.5)
ON CONFLICT (task_id) DO NOTHING;

-- ============================================================================
-- ACHIEVEMENTS: Sample achievements
-- ============================================================================

INSERT INTO achievements (achievement_id, name, description, category, requirements, points_reward, rarity, icon)
VALUES
  ('ach-001', 'First Steps', 'Complete your first task', 'task_completion', '{"tasks_completed": 1}', 100, 'common', '🎯'),
  ('ach-002', 'Speed Demon', 'Complete 10 tasks in under 5 minutes each', 'speed', '{"fast_completions": 10, "max_duration": 300000}', 500, 'rare', '⚡'),
  ('ach-003', 'Quality Champion', 'Maintain 95%+ quality score for 50 tasks', 'quality', '{"min_quality": 95, "task_count": 50}', 1000, 'epic', '💎'),
  ('ach-004', 'Team Player', 'Participate in 20 brainstorming sessions', 'collaboration', '{"brainstorm_sessions": 20}', 750, 'uncommon', '🤝'),
  ('ach-005', 'Innovator', 'Create 10 ideas rated 90%+ quality', 'innovation', '{"high_quality_ideas": 10, "min_quality": 90}', 1500, 'legendary', '💡'),
  ('ach-006', 'Century Club', 'Complete 100 tasks successfully', 'task_completion', '{"tasks_completed": 100}', 2000, 'epic', '💯'),
  ('ach-007', 'Marathon Runner', 'Maintain 30-day streak', 'consistency', '{"consecutive_days": 30}', 3000, 'legendary', '🏃'),
  ('ach-008', 'Battle Tested', 'Win 5 head-to-head battles', 'special', '{"battle_wins": 5, "mode": "head_to_head"}', 1200, 'rare', '⚔️'),
  ('ach-009', 'Mentor', 'Successfully mentor 3 junior agents', 'collaboration', '{"mentees_graduated": 3}', 2500, 'epic', '👨‍🏫'),
  ('ach-010', 'Perfect Week', 'Complete all assigned tasks with 100% quality for a week', 'quality', '{"perfect_tasks": 7, "timeframe": "week"}', 5000, 'legendary', '🌟')
ON CONFLICT (achievement_id) DO NOTHING;

-- ============================================================================
-- AGENT ACHIEVEMENTS: Unlocked achievements
-- ============================================================================

INSERT INTO agent_achievements (agent_id, achievement_id, unlocked_at, unlock_count)
VALUES
  ((SELECT id FROM agents WHERE agent_id = 'agent-001'), (SELECT id FROM achievements WHERE achievement_id = 'ach-001'), '2025-01-15 10:00:00+00', 1),
  ((SELECT id FROM agents WHERE agent_id = 'agent-001'), (SELECT id FROM achievements WHERE achievement_id = 'ach-006'), '2025-08-20 14:30:00+00', 1),
  ((SELECT id FROM agents WHERE agent_id = 'agent-001'), (SELECT id FROM achievements WHERE achievement_id = 'ach-009'), '2025-10-10 09:15:00+00', 1),
  ((SELECT id FROM agents WHERE agent_id = 'agent-002'), (SELECT id FROM achievements WHERE achievement_id = 'ach-001'), '2025-02-01 11:00:00+00', 1),
  ((SELECT id FROM agents WHERE agent_id = 'agent-002'), (SELECT id FROM achievements WHERE achievement_id = 'ach-002'), '2025-06-15 16:45:00+00', 1),
  ((SELECT id FROM agents WHERE agent_id = 'agent-002'), (SELECT id FROM achievements WHERE achievement_id = 'ach-006'), '2025-09-05 13:20:00+00', 1),
  ((SELECT id FROM agents WHERE agent_id = 'agent-008'), (SELECT id FROM achievements WHERE achievement_id = 'ach-003'), '2025-07-25 10:30:00+00', 1),
  ((SELECT id FROM agents WHERE agent_id = 'agent-008'), (SELECT id FROM achievements WHERE achievement_id = 'ach-006'), '2025-09-15 08:45:00+00', 1),
  ((SELECT id FROM agents WHERE agent_id = 'agent-010'), (SELECT id FROM achievements WHERE achievement_id = 'ach-007'), '2025-05-30 12:00:00+00', 1),
  ((SELECT id FROM agents WHERE agent_id = 'agent-010'), (SELECT id FROM achievements WHERE achievement_id = 'ach-010'), '2025-06-10 18:30:00+00', 1)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- VOTING SESSIONS: Sample voting sessions
-- ============================================================================

INSERT INTO voting_sessions (session_id, topic, question, options, algorithm, status, initiated_by, total_agents, results, winner)
VALUES
  ('vote-001',
   'Framework Selection',
   'Which frontend framework should we use for the dashboard?',
   '["React", "Vue", "Svelte", "Angular"]',
   'confidence_weighted',
   'closed',
   (SELECT id FROM agents WHERE agent_id = 'agent-001'),
   8,
   '{"React": 4, "Vue": 2, "Svelte": 2}',
   'React'),
  ('vote-002',
   'Architecture Decision',
   'Should we implement microservices or monolithic architecture?',
   '["Microservices", "Monolithic", "Hybrid"]',
   'consensus',
   'closed',
   (SELECT id FROM agents WHERE agent_id = 'agent-010'),
   10,
   '{"Microservices": 7, "Monolithic": 1, "Hybrid": 2}',
   'Microservices'),
  ('vote-003',
   'Code Review Standards',
   'What should be the minimum required approvals for merging?',
   '["1 approval", "2 approvals", "3 approvals"]',
   'simple_majority',
   'open',
   (SELECT id FROM agents WHERE agent_id = 'agent-008'),
   10,
   NULL,
   NULL)
ON CONFLICT (session_id) DO NOTHING;

-- ============================================================================
-- BRAINSTORM SESSIONS: Sample brainstorming sessions
-- ============================================================================

INSERT INTO brainstorm_sessions (session_id, topic, description, facilitator_id, status, total_ideas, participant_count)
VALUES
  ('brain-001',
   'Performance Optimization',
   'Ideas for improving system performance and reducing latency',
   (SELECT id FROM agents WHERE agent_id = 'agent-001'),
   'completed',
   25,
   6),
  ('brain-002',
   'New Feature Proposals',
   'Brainstorm innovative features for the next release',
   (SELECT id FROM agents WHERE agent_id = 'agent-003'),
   'active',
   18,
   8),
  ('brain-003',
   'Security Enhancements',
   'Identify and propose security improvements',
   (SELECT id FROM agents WHERE agent_id = 'agent-008'),
   'completed',
   15,
   5)
ON CONFLICT (session_id) DO NOTHING;

-- ============================================================================
-- IDEAS: Sample ideas from brainstorming
-- ============================================================================

INSERT INTO ideas (idea_id, session_id, agent_id, content, category, quality_score, novelty_score, feasibility_score, total_votes, vote_score)
VALUES
  ('idea-001',
   (SELECT id FROM brainstorm_sessions WHERE session_id = 'brain-001'),
   (SELECT id FROM agents WHERE agent_id = 'agent-002'),
   'Implement Redis caching for frequently accessed data',
   'Performance',
   88.5, 65.0, 95.0, 5, 4.2),
  ('idea-002',
   (SELECT id FROM brainstorm_sessions WHERE session_id = 'brain-001'),
   (SELECT id FROM agents WHERE agent_id = 'agent-006'),
   'Use connection pooling for database connections',
   'Performance',
   92.0, 55.0, 98.0, 6, 5.5),
  ('idea-003',
   (SELECT id FROM brainstorm_sessions WHERE session_id = 'brain-002'),
   (SELECT id FROM agents WHERE agent_id = 'agent-003'),
   'Add real-time collaboration features using WebSockets',
   'Features',
   85.0, 88.0, 78.0, 7, 6.1),
  ('idea-004',
   (SELECT id FROM brainstorm_sessions WHERE session_id = 'brain-003'),
   (SELECT id FROM agents WHERE agent_id = 'agent-008'),
   'Implement end-to-end encryption for sensitive data',
   'Security',
   95.0, 70.0, 92.0, 5, 4.8)
ON CONFLICT (idea_id) DO NOTHING;

-- ============================================================================
-- TRUST GRAPH: Sample trust relationships
-- ============================================================================

INSERT INTO trust_graph (from_agent_id, to_agent_id, local_trust, interaction_count)
VALUES
  ((SELECT id FROM agents WHERE agent_id = 'agent-001'), (SELECT id FROM agents WHERE agent_id = 'agent-002'), 0.92, 45),
  ((SELECT id FROM agents WHERE agent_id = 'agent-001'), (SELECT id FROM agents WHERE agent_id = 'agent-003'), 0.88, 38),
  ((SELECT id FROM agents WHERE agent_id = 'agent-001'), (SELECT id FROM agents WHERE agent_id = 'agent-008'), 0.95, 52),
  ((SELECT id FROM agents WHERE agent_id = 'agent-002'), (SELECT id FROM agents WHERE agent_id = 'agent-001'), 0.90, 45),
  ((SELECT id FROM agents WHERE agent_id = 'agent-002'), (SELECT id FROM agents WHERE agent_id = 'agent-006'), 0.85, 28),
  ((SELECT id FROM agents WHERE agent_id = 'agent-003'), (SELECT id FROM agents WHERE agent_id = 'agent-001'), 0.87, 38),
  ((SELECT id FROM agents WHERE agent_id = 'agent-003'), (SELECT id FROM agents WHERE agent_id = 'agent-006'), 0.91, 42),
  ((SELECT id FROM agents WHERE agent_id = 'agent-008'), (SELECT id FROM agents WHERE agent_id = 'agent-001'), 0.94, 52),
  ((SELECT id FROM agents WHERE agent_id = 'agent-010'), (SELECT id FROM agents WHERE agent_id = 'agent-001'), 0.96, 68),
  ((SELECT id FROM agents WHERE agent_id = 'agent-010'), (SELECT id FROM agents WHERE agent_id = 'agent-008'), 0.97, 71)
ON CONFLICT (from_agent_id, to_agent_id) DO NOTHING;

-- ============================================================================
-- GLOBAL TRUST SCORES: Computed trust scores
-- ============================================================================

INSERT INTO global_trust_scores (agent_id, eigentrust_score, persistence_score, competence_score, reputation_score, credibility_score, integrity_score, composite_score, trust_level, converged)
VALUES
  ((SELECT id FROM agents WHERE agent_id = 'agent-001'), 0.9200, 92.0, 95.0, 93.0, 91.0, 94.0, 0.9300, 'excellent', true),
  ((SELECT id FROM agents WHERE agent_id = 'agent-002'), 0.8500, 85.0, 88.0, 86.0, 84.0, 87.0, 0.8600, 'very-good', true),
  ((SELECT id FROM agents WHERE agent_id = 'agent-003'), 0.8800, 88.0, 90.0, 89.0, 87.0, 88.0, 0.8840, 'very-good', true),
  ((SELECT id FROM agents WHERE agent_id = 'agent-008'), 0.9400, 94.0, 96.0, 95.0, 93.0, 97.0, 0.9500, 'excellent', true),
  ((SELECT id FROM agents WHERE agent_id = 'agent-010'), 0.9600, 96.0, 98.0, 97.0, 95.0, 98.0, 0.9680, 'outstanding', true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- BATTLES: Sample battles
-- ============================================================================

INSERT INTO battles (battle_id, mode, status, min_participants, max_participants, prize_pool, winner_id)
VALUES
  ('battle-001', 'head_to_head', 'completed', 2, 2, 1000, (SELECT id FROM agents WHERE agent_id = 'agent-002')),
  ('battle-002', 'speed_race', 'completed', 2, 4, 1500, (SELECT id FROM agents WHERE agent_id = 'agent-006')),
  ('battle-003', 'quality_showdown', 'active', 2, 2, 2000, NULL),
  ('battle-004', 'team_tournament', 'pending', 8, 8, 5000, NULL)
ON CONFLICT (battle_id) DO NOTHING;

-- ============================================================================
-- BATTLE PARTICIPANTS: Battle participation
-- ============================================================================

INSERT INTO battle_participants (battle_id, agent_id, score, rank, points_earned, elo_change)
VALUES
  ((SELECT id FROM battles WHERE battle_id = 'battle-001'), (SELECT id FROM agents WHERE agent_id = 'agent-002'), 92.5, 1, 500, 32),
  ((SELECT id FROM battles WHERE battle_id = 'battle-001'), (SELECT id FROM agents WHERE agent_id = 'agent-007'), 78.0, 2, 100, -32),
  ((SELECT id FROM battles WHERE battle_id = 'battle-002'), (SELECT id FROM agents WHERE agent_id = 'agent-006'), 95.0, 1, 750, 28),
  ((SELECT id FROM battles WHERE battle_id = 'battle-002'), (SELECT id FROM agents WHERE agent_id = 'agent-002'), 88.5, 2, 300, 8),
  ((SELECT id FROM battles WHERE battle_id = 'battle-002'), (SELECT id FROM agents WHERE agent_id = 'agent-003'), 82.0, 3, 100, -12),
  ((SELECT id FROM battles WHERE battle_id = 'battle-002'), (SELECT id FROM agents WHERE agent_id = 'agent-005'), 75.5, 4, 50, -24)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- MENTORSHIP PAIRINGS: Sample mentorships
-- ============================================================================

INSERT INTO mentorship_pairings (mentor_id, mentee_id, status, skill_focus, total_sessions, completed_sessions)
VALUES
  ((SELECT id FROM agents WHERE agent_id = 'agent-010'), (SELECT id FROM agents WHERE agent_id = 'agent-007'), 'active', 'advanced-coding', 12, 8),
  ((SELECT id FROM agents WHERE agent_id = 'agent-001'), (SELECT id FROM agents WHERE agent_id = 'agent-009'), 'active', 'task-execution', 10, 5),
  ((SELECT id FROM agents WHERE agent_id = 'agent-008'), (SELECT id FROM agents WHERE agent_id = 'agent-005'), 'completed', 'security-best-practices', 8, 8)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- MENTORSHIP CURRICULUM: Sample curriculum items
-- ============================================================================

INSERT INTO mentorship_curriculum (skill_name, level, title, description, objectives, estimated_duration_hours)
VALUES
  ('coding', 1, 'JavaScript Fundamentals', 'Learn core JavaScript concepts and syntax', ARRAY['Variables and data types', 'Functions and scope', 'Arrays and objects'], 20),
  ('coding', 2, 'Advanced JavaScript', 'Master advanced JS patterns and async programming', ARRAY['Promises and async/await', 'Closures and prototypes', 'ES6+ features'], 30),
  ('testing', 1, 'Unit Testing Basics', 'Introduction to unit testing with Jest', ARRAY['Write basic test cases', 'Mock dependencies', 'Test coverage'], 15),
  ('security', 1, 'Security Fundamentals', 'Core security principles and practices', ARRAY['Authentication vs Authorization', 'OWASP Top 10', 'Secure coding'], 25),
  ('leadership', 1, 'Team Leadership', 'Basics of leading technical teams', ARRAY['Task delegation', 'Code reviews', 'Conflict resolution'], 20)
ON CONFLICT (skill_name, level) DO NOTHING;

-- ============================================================================
-- RESOURCE POOLS: Available resources
-- ============================================================================

INSERT INTO resource_pools (resource_type, total_capacity, allocated, available)
VALUES
  ('cpu_hours', 10000, 6500, 3500),
  ('memory_gb', 5000, 3200, 1800),
  ('storage_tb', 100, 65, 35),
  ('api_calls', 1000000, 650000, 350000),
  ('priority_slots', 50, 12, 38)
ON CONFLICT (resource_type) DO NOTHING;

-- ============================================================================
-- RESOURCE ALLOCATIONS: Agent resource assignments
-- ============================================================================

INSERT INTO resource_allocations (agent_id, resource_type, amount, reason, performance_tier, status)
VALUES
  ((SELECT id FROM agents WHERE agent_id = 'agent-001'), 'cpu_hours', 1500, 'High performance tier allocation', 'platinum', 'active'),
  ((SELECT id FROM agents WHERE agent_id = 'agent-008'), 'cpu_hours', 1200, 'High performance tier allocation', 'platinum', 'active'),
  ((SELECT id FROM agents WHERE agent_id = 'agent-010'), 'cpu_hours', 2000, 'Top performer bonus', 'diamond', 'active'),
  ((SELECT id FROM agents WHERE agent_id = 'agent-002'), 'priority_slots', 3, 'Gold tier bonus', 'gold', 'active'),
  ((SELECT id FROM agents WHERE agent_id = 'agent-006'), 'api_calls', 50000, 'Specialist resource allocation', 'gold', 'active')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- LEADERBOARD RANKINGS: Current rankings
-- ============================================================================

INSERT INTO leaderboard_rankings (category, period, period_start, period_end, agent_id, rank, score, previous_rank, rank_change)
VALUES
  ('overall', 'weekly', '2025-11-11', '2025-11-18', (SELECT id FROM agents WHERE agent_id = 'agent-010'), 1, 2850.50, 1, 0),
  ('overall', 'weekly', '2025-11-11', '2025-11-18', (SELECT id FROM agents WHERE agent_id = 'agent-001'), 2, 2620.25, 3, 1),
  ('overall', 'weekly', '2025-11-11', '2025-11-18', (SELECT id FROM agents WHERE agent_id = 'agent-008'), 3, 2580.75, 2, -1),
  ('overall', 'weekly', '2025-11-11', '2025-11-18', (SELECT id FROM agents WHERE agent_id = 'agent-002'), 4, 2420.00, 4, 0),
  ('speed', 'weekly', '2025-11-11', '2025-11-18', (SELECT id FROM agents WHERE agent_id = 'agent-006'), 1, 95.5, 2, 1),
  ('quality', 'weekly', '2025-11-11', '2025-11-18', (SELECT id FROM agents WHERE agent_id = 'agent-008'), 1, 96.8, 1, 0),
  ('collaboration', 'weekly', '2025-11-11', '2025-11-18', (SELECT id FROM agents WHERE agent_id = 'agent-003'), 1, 92.5, 1, 0)
ON CONFLICT (category, period, period_start, agent_id) DO NOTHING;

-- ============================================================================
-- HALL OF FAME: Legendary agents
-- ============================================================================

INSERT INTO hall_of_fame (agent_id, tier, title, points_at_induction, quality_score_at_induction, years_active, badge, citation)
VALUES
  ((SELECT id FROM agents WHERE agent_id = 'agent-010'), 'LEGEND', 'Legend', 50000, 98.5, 3.2, '👑', 'Outstanding leadership and consistent excellence across all metrics'),
  ((SELECT id FROM agents WHERE agent_id = 'agent-008'), 'MASTER', 'Master', 25000, 97.2, 2.5, '⭐', 'Expert-level security knowledge and exceptional code quality')
ON CONFLICT (agent_id, tier) DO NOTHING;

-- ============================================================================
-- VIOLATIONS: Sample violations (for testing penalty system)
-- ============================================================================

INSERT INTO violations (agent_id, violation_type, severity, description, penalty_points, status)
VALUES
  ((SELECT id FROM agents WHERE agent_id = 'agent-009'), 'timeout', 2, 'Failed to complete task within deadline', 50, 'active'),
  ((SELECT id FROM agents WHERE agent_id = 'agent-007'), 'low_quality', 1, 'Submitted work with quality score below 70%', 25, 'active')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Update sequences to avoid conflicts
-- ============================================================================

-- This ensures that auto-generated IDs don't conflict with seed data
SELECT setval(pg_get_serial_sequence('agents', 'id'), (SELECT MAX(id) FROM agents), true) WHERE EXISTS (SELECT 1 FROM agents);

COMMIT;

-- ============================================================================
-- Seed data inserted successfully
-- ============================================================================

-- Quick verification queries
SELECT 'Agents created:', COUNT(*) FROM agents;
SELECT 'Tasks created:', COUNT(*) FROM tasks;
SELECT 'Achievements created:', COUNT(*) FROM achievements;
SELECT 'Voting sessions created:', COUNT(*) FROM voting_sessions;
SELECT 'Brainstorm sessions created:', COUNT(*) FROM brainstorm_sessions;
SELECT 'Trust relationships created:', COUNT(*) FROM trust_graph;
SELECT 'Battles created:', COUNT(*) FROM battles;
SELECT 'Mentorship pairings created:', COUNT(*) FROM mentorship_pairings;
