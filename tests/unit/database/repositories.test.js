import { jest } from '@jest/globals';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Mock database client
const mockQuery = jest.fn();
const mockTransaction = jest.fn();
const mockConnect = jest.fn();
const mockClose = jest.fn();

const mockDbClient = {
  query: mockQuery,
  transaction: mockTransaction,
  connect: mockConnect,
  close: mockClose,
};

// Mock pg module
jest.unstable_mockModule('pg', () => ({
  default: {
    Pool: jest.fn(() => ({
      query: mockQuery,
      connect: jest.fn(),
      end: jest.fn(),
      on: jest.fn(),
    })),
  },
  Pool: jest.fn(() => ({
    query: mockQuery,
    connect: jest.fn(),
    end: jest.fn(),
    on: jest.fn(),
  })),
}));

describe('Database Integration Layer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('AgentRepository', () => {
    it('should create a new agent', async () => {
      const mockAgent = {
        agent_id: 'agent-1',
        agent_name: 'Test Agent',
        agent_type: 'worker',
        status: 'idle',
        capabilities: JSON.stringify(['coding', 'testing']),
        current_task_id: null,
        heartbeat_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
        tasks_completed: 0,
        tasks_failed: 0,
        messages_processed: 0,
        uptime_seconds: 0,
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockAgent] });

      const { AgentRepository } = await import('../../../src/database/repositories/agent-repository.js');
      const repository = new AgentRepository(mockDbClient);

      const result = await repository.create({
        agentId: 'agent-1',
        agentName: 'Test Agent',
        agentType: 'worker',
        status: 'idle',
        capabilities: ['coding', 'testing'],
        heartbeatAt: new Date(),
      });

      expect(result.agentId).toBe('agent-1');
      expect(result.agentName).toBe('Test Agent');
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    it('should find agent by ID', async () => {
      const mockAgent = {
        agent_id: 'agent-1',
        agent_name: 'Test Agent',
        agent_type: 'worker',
        status: 'idle',
        capabilities: JSON.stringify(['coding']),
        current_task_id: null,
        heartbeat_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
        tasks_completed: 5,
        tasks_failed: 1,
        messages_processed: 10,
        uptime_seconds: 3600,
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockAgent] });

      const { AgentRepository } = await import('../../../src/database/repositories/agent-repository.js');
      const repository = new AgentRepository(mockDbClient);

      const result = await repository.findById('agent-1');

      expect(result.agentId).toBe('agent-1');
      expect(result.tasksCompleted).toBe(5);
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM agents WHERE agent_id = $1',
        ['agent-1']
      );
    });

    it('should update agent heartbeat', async () => {
      const mockAgent = {
        agent_id: 'agent-1',
        agent_name: 'Test Agent',
        agent_type: 'worker',
        status: 'idle',
        capabilities: JSON.stringify(['coding']),
        current_task_id: null,
        heartbeat_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
        tasks_completed: 0,
        tasks_failed: 0,
        messages_processed: 0,
        uptime_seconds: 0,
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockAgent] });

      const { AgentRepository } = await import('../../../src/database/repositories/agent-repository.js');
      const repository = new AgentRepository(mockDbClient);

      const result = await repository.updateHeartbeat('agent-1');

      expect(result.agentId).toBe('agent-1');
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });
  });

  describe('TaskRepository', () => {
    it('should create a new task', async () => {
      const mockTask = {
        task_id: 'task-1',
        task_type: 'code_review',
        priority: 'high',
        status: 'pending',
        payload: JSON.stringify({ file: 'test.js' }),
        assigned_agent_id: null,
        created_by: 'system',
        retry_count: 0,
        max_retries: 3,
        timeout_ms: 300000,
        created_at: new Date(),
        started_at: null,
        completed_at: null,
        failed_at: null,
        updated_at: new Date(),
        result: null,
        error: null,
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockTask] });

      const { TaskRepository } = await import('../../../src/database/repositories/task-repository.js');
      const repository = new TaskRepository(mockDbClient);

      const result = await repository.create({
        taskId: 'task-1',
        taskType: 'code_review',
        priority: 'high',
        payload: { file: 'test.js' },
        createdBy: 'system',
      });

      expect(result.taskId).toBe('task-1');
      expect(result.priority).toBe('high');
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    it('should dequeue next pending task', async () => {
      const mockTask = {
        task_id: 'task-1',
        task_type: 'code_review',
        priority: 'high',
        status: 'in_progress',
        payload: JSON.stringify({ file: 'test.js' }),
        assigned_agent_id: 'agent-1',
        created_by: 'system',
        retry_count: 0,
        max_retries: 3,
        timeout_ms: 300000,
        created_at: new Date(),
        started_at: new Date(),
        completed_at: null,
        failed_at: null,
        updated_at: new Date(),
        result: null,
        error: null,
      };

      mockTransaction.mockImplementation(async (callback) => {
        const mockClient = {
          query: jest.fn()
            .mockResolvedValueOnce({ rows: [mockTask] })
            .mockResolvedValueOnce({ rows: [mockTask] }),
        };
        return await callback(mockClient);
      });

      const { TaskRepository } = await import('../../../src/database/repositories/task-repository.js');
      const repository = new TaskRepository(mockDbClient);

      const result = await repository.dequeue('agent-1');

      expect(result.taskId).toBe('task-1');
      expect(result.status).toBe('in_progress');
      expect(mockTransaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('VotingRepository', () => {
    it('should create a proposal', async () => {
      const mockProposal = {
        proposal_id: 'prop-1',
        proposal_type: 'feature',
        title: 'Add new feature',
        description: 'Implement feature X',
        proposed_by: 'agent-1',
        voting_threshold: 0.6,
        expires_at: new Date(Date.now() + 86400000),
        status: 'active',
        metadata: JSON.stringify({}),
        executed_at: null,
        rejected_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockProposal] });

      const { VotingRepository } = await import('../../../src/database/repositories/voting-repository.js');
      const repository = new VotingRepository(mockDbClient);

      const result = await repository.createProposal({
        proposalId: 'prop-1',
        proposalType: 'feature',
        title: 'Add new feature',
        description: 'Implement feature X',
        proposedBy: 'agent-1',
      });

      expect(result.proposalId).toBe('prop-1');
      expect(result.title).toBe('Add new feature');
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    it('should cast a vote', async () => {
      const mockVote = {
        vote_id: 'vote-1',
        proposal_id: 'prop-1',
        voter_id: 'agent-1',
        vote_value: 'yes',
        weight: 1.0,
        reason: 'Good idea',
        created_at: new Date(),
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockVote] });

      const { VotingRepository } = await import('../../../src/database/repositories/voting-repository.js');
      const repository = new VotingRepository(mockDbClient);

      const result = await repository.castVote({
        voteId: 'vote-1',
        proposalId: 'prop-1',
        voterId: 'agent-1',
        voteValue: 'yes',
        reason: 'Good idea',
      });

      expect(result.voteId).toBe('vote-1');
      expect(result.voteValue).toBe('yes');
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });
  });

  describe('GamificationRepository', () => {
    it('should add points to agent', async () => {
      const mockProfile = {
        agent_id: 'agent-1',
        points: 150,
        level: 2,
        tier: 'silver',
        experience: 150,
        streak_days: 5,
        last_activity_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockTransaction.mockImplementation(async (callback) => {
        const mockClient = {
          query: jest.fn()
            .mockResolvedValueOnce({ rows: [mockProfile] })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rowCount: 0 }),
        };
        return await callback(mockClient);
      });

      const { GamificationRepository } = await import('../../../src/database/repositories/gamification-repository.js');
      const repository = new GamificationRepository(mockDbClient);

      const result = await repository.addPoints('agent-1', 50, 'Task completion');

      expect(result.agentId).toBe('agent-1');
      expect(result.points).toBe(150);
      expect(mockTransaction).toHaveBeenCalledTimes(1);
    });

    it('should award achievement', async () => {
      const mockAchievement = {
        agent_id: 'agent-1',
        achievement_id: 'first_task',
        metadata: JSON.stringify({ taskId: 'task-1' }),
        earned_at: new Date(),
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockAchievement] });

      const { GamificationRepository } = await import('../../../src/database/repositories/gamification-repository.js');
      const repository = new GamificationRepository(mockDbClient);

      const result = await repository.awardAchievement('agent-1', 'first_task', { taskId: 'task-1' });

      expect(result.agentId).toBe('agent-1');
      expect(result.achievementId).toBe('first_task');
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });
  });

  describe('BattleRepository', () => {
    it('should create a battle match', async () => {
      const mockMatch = {
        match_id: 'match-1',
        agent1_id: 'agent-1',
        agent2_id: 'agent-2',
        match_type: 'standard',
        status: 'pending',
        challenge: 'Code optimization',
        metadata: JSON.stringify({}),
        winner_id: null,
        agent1_score: 0,
        agent2_score: 0,
        created_at: new Date(),
        completed_at: null,
        updated_at: new Date(),
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockMatch] });

      const { BattleRepository } = await import('../../../src/database/repositories/battle-repository.js');
      const repository = new BattleRepository(mockDbClient);

      const result = await repository.createMatch({
        matchId: 'match-1',
        agent1Id: 'agent-1',
        agent2Id: 'agent-2',
        challenge: 'Code optimization',
      });

      expect(result.matchId).toBe('match-1');
      expect(result.agent1Id).toBe('agent-1');
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });
  });

  describe('LeaderboardRepository', () => {
    it('should get current leaderboard by points', async () => {
      const mockRows = [
        {
          agent_id: 'agent-1',
          agent_name: 'Agent 1',
          score: 500,
          level: 5,
          tier: 'gold',
          rank: 1,
        },
        {
          agent_id: 'agent-2',
          agent_name: 'Agent 2',
          score: 400,
          level: 4,
          tier: 'silver',
          rank: 2,
        },
      ];

      mockQuery.mockResolvedValueOnce({ rows: mockRows });

      const { LeaderboardRepository } = await import('../../../src/database/repositories/leaderboard-repository.js');
      const repository = new LeaderboardRepository(mockDbClient);

      const result = await repository.getCurrentLeaderboard({ metric: 'points', limit: 10 });

      expect(result).toHaveLength(2);
      expect(result[0].rank).toBe(1);
      expect(result[0].agentName).toBe('Agent 1');
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });
  });

  describe('MentorshipRepository', () => {
    it('should create a mentorship pairing', async () => {
      const mockPairing = {
        pairing_id: 'pair-1',
        mentor_id: 'agent-1',
        mentee_id: 'agent-2',
        status: 'active',
        goals: JSON.stringify(['Learn testing', 'Improve code quality']),
        metadata: JSON.stringify({}),
        started_at: new Date(),
        completed_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockPairing] });

      const { MentorshipRepository } = await import('../../../src/database/repositories/mentorship-repository.js');
      const repository = new MentorshipRepository(mockDbClient);

      const result = await repository.createPairing({
        pairingId: 'pair-1',
        mentorId: 'agent-1',
        menteeId: 'agent-2',
        goals: ['Learn testing', 'Improve code quality'],
      });

      expect(result.pairingId).toBe('pair-1');
      expect(result.mentorId).toBe('agent-1');
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });
  });

  describe('RewardsRepository', () => {
    it('should create reward allocation', async () => {
      const mockAllocation = {
        allocation_id: 'alloc-1',
        agent_id: 'agent-1',
        reward_type: 'bonus_points',
        amount: 100,
        reason: 'Excellent performance',
        expires_at: null,
        status: 'pending',
        metadata: JSON.stringify({}),
        redeemed_at: null,
        created_at: new Date(),
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockAllocation] });

      const { RewardsRepository } = await import('../../../src/database/repositories/rewards-repository.js');
      const repository = new RewardsRepository(mockDbClient);

      const result = await repository.createAllocation({
        allocationId: 'alloc-1',
        agentId: 'agent-1',
        rewardType: 'bonus_points',
        amount: 100,
        reason: 'Excellent performance',
      });

      expect(result.allocationId).toBe('alloc-1');
      expect(result.amount).toBe(100);
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });
  });

  describe('PenaltiesRepository', () => {
    it('should create a violation', async () => {
      const mockViolation = {
        violation_id: 'viol-1',
        agent_id: 'agent-1',
        violation_type: 'spam',
        severity: 'medium',
        description: 'Sent too many messages',
        evidence: JSON.stringify({ count: 100 }),
        reported_by: 'system',
        status: 'pending',
        resolution: null,
        metadata: JSON.stringify({}),
        confirmed_at: null,
        dismissed_at: null,
        created_at: new Date(),
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockViolation] });

      const { PenaltiesRepository } = await import('../../../src/database/repositories/penalties-repository.js');
      const repository = new PenaltiesRepository(mockDbClient);

      const result = await repository.createViolation({
        violationId: 'viol-1',
        agentId: 'agent-1',
        violationType: 'spam',
        description: 'Sent too many messages',
        evidence: { count: 100 },
        reportedBy: 'system',
      });

      expect(result.violationId).toBe('viol-1');
      expect(result.severity).toBe('medium');
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });
  });

  describe('BrainstormRepository', () => {
    it('should create a brainstorm session', async () => {
      const mockSession = {
        session_id: 'session-1',
        topic: 'System improvements',
        description: 'Discuss potential improvements',
        initiated_by: 'agent-1',
        status: 'active',
        max_ideas: 100,
        duration_ms: 300000,
        expires_at: new Date(Date.now() + 300000),
        metadata: JSON.stringify({}),
        completed_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockSession] });

      const { BrainstormRepository } = await import('../../../src/database/repositories/brainstorm-repository.js');
      const repository = new BrainstormRepository(mockDbClient);

      const result = await repository.createSession({
        sessionId: 'session-1',
        topic: 'System improvements',
        description: 'Discuss potential improvements',
        initiatedBy: 'agent-1',
      });

      expect(result.sessionId).toBe('session-1');
      expect(result.topic).toBe('System improvements');
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });
  });

  describe('ReputationRepository', () => {
    it('should add rating for agent', async () => {
      const mockRating = {
        id: 1,
        agent_id: 'agent-1',
        rated_by: 'agent-2',
        rating_type: 'trust',
        score: 85,
        feedback: 'Reliable agent',
        metadata: JSON.stringify({}),
        created_at: new Date(),
      };

      const mockProfile = {
        agent_id: 'agent-1',
        trust_score: 85,
        reliability_score: 80,
        quality_score: 90,
        collaboration_score: 75,
        total_ratings: 10,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockTransaction.mockImplementation(async (callback) => {
        const mockClient = {
          query: jest.fn()
            .mockResolvedValueOnce({ rows: [mockRating] })
            .mockResolvedValueOnce({ rows: [mockProfile] }),
        };
        return await callback(mockClient);
      });

      const { ReputationRepository } = await import('../../../src/database/repositories/reputation-repository.js');
      const repository = new ReputationRepository(mockDbClient);

      const result = await repository.addRating({
        agentId: 'agent-1',
        ratedBy: 'agent-2',
        ratingType: 'trust',
        score: 85,
        feedback: 'Reliable agent',
      });

      expect(result.agentId).toBe('agent-1');
      expect(result.score).toBe(85);
      expect(mockTransaction).toHaveBeenCalledTimes(1);
    });
  });
});
