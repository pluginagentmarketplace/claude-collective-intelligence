/**
 * Unit Tests for MentorshipSystem
 * Comprehensive tests for mentorship, pairing algorithm, and knowledge transfer
 * Coverage: 40+ test cases
 */

import { jest } from '@jest/globals';
import { MentorshipSystem } from '../../../../src/systems/mentorship/system.js';
import {
  findBestMentor,
  calculatePairingScore,
  calculateSkillGapScore,
  calculateAvailabilityScore,
  calculateSpecializationMatch,
  validatePairing,
  calculateMentorWorkload
} from '../../scripts/mentorship/pairing-algorithm.js';
import {
  TransferType,
  createObservationSession,
  createCoExecutionSession,
  createPatternSharing,
  buildAcceleratedCurriculum,
  recommendTransferTypes
} from '../../scripts/mentorship/knowledge-transfer.js';

describe('MentorshipSystem', () => {
  let mentorshipSystem;
  let mockClient;

  beforeEach(() => {
    mockClient = {
      isHealthy: jest.fn().mockReturnValue(true),
      publishStatus: jest.fn().mockResolvedValue('msg-123'),
      publishTask: jest.fn().mockResolvedValue('msg-456')
    };

    mentorshipSystem = new MentorshipSystem(mockClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // Constructor & Initialization Tests (5 tests)
  // ============================================================================

  describe('Constructor', () => {
    test('should initialize with RabbitMQ client', () => {
      expect(mentorshipSystem.client).toBe(mockClient);
      expect(mentorshipSystem.mentorships).toBeInstanceOf(Map);
      expect(mentorshipSystem.agentProfiles).toBeInstanceOf(Map);
      expect(mentorshipSystem.curriculum).toBeDefined();
    });

    test('should build 6-level curriculum (0-5)', () => {
      expect(mentorshipSystem.curriculum).toHaveProperty('0');
      expect(mentorshipSystem.curriculum).toHaveProperty('1');
      expect(mentorshipSystem.curriculum).toHaveProperty('2');
      expect(mentorshipSystem.curriculum).toHaveProperty('3');
      expect(mentorshipSystem.curriculum).toHaveProperty('4');
      expect(mentorshipSystem.curriculum).toHaveProperty('5');
    });

    test('should have correct Level 0 requirements', () => {
      const level0 = mentorshipSystem.curriculum[0];
      expect(level0.name).toBe('Novice');
      expect(level0.duration).toBe(1);
      expect(level0.requirements.tasksCompleted).toBe(10);
      expect(level0.requirements.successRate).toBe(0.90);
    });

    test('should have correct Level 2 requirements', () => {
      const level2 = mentorshipSystem.curriculum[2];
      expect(level2.name).toBe('Intermediate');
      expect(level2.requirements.complexTasksCompleted).toBe(1);
      expect(level2.requirements.brainstormsInitiated).toBe(2);
    });

    test('should emit events', () => {
      expect(mentorshipSystem.on).toBeDefined();
      expect(mentorshipSystem.emit).toBeDefined();
    });
  });

  // ============================================================================
  // Agent Initialization Tests (5 tests)
  // ============================================================================

  describe('initializeAgent()', () => {
    test('should create new agent profile', () => {
      const profile = mentorshipSystem.initializeAgent('agent-1');

      expect(profile.agentId).toBe('agent-1');
      expect(profile.currentLevel).toBe(0);
      expect(profile.mentorId).toBeNull();
      expect(profile.mentees).toEqual([]);
    });

    test('should initialize skill proficiency to 0', () => {
      const profile = mentorshipSystem.initializeAgent('agent-2');

      expect(profile.skillProficiency.taskExecution).toBe(0.0);
      expect(profile.skillProficiency.errorHandling).toBe(0.0);
      expect(profile.skillProficiency.collaboration).toBe(0.0);
    });

    test('should initialize training progress to 0', () => {
      const profile = mentorshipSystem.initializeAgent('agent-3');

      expect(profile.trainingProgress.tasksCompleted).toBe(0);
      expect(profile.trainingProgress.tasksSuccessRate).toBe(0.0);
      expect(profile.trainingProgress.brainstormsAttended).toBe(0);
    });

    test('should store profile in Map', () => {
      mentorshipSystem.initializeAgent('agent-4');

      expect(mentorshipSystem.agentProfiles.has('agent-4')).toBe(true);
      expect(mentorshipSystem.getAgentProfile('agent-4')).toBeDefined();
    });

    test('should emit agent_enrolled event', () => {
      const eventSpy = jest.fn();
      mentorshipSystem.on('agent_enrolled', eventSpy);

      mentorshipSystem.initializeAgent('agent-5');

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({ agentId: 'agent-5' })
      );
    });
  });

  // ============================================================================
  // Pairing Algorithm Tests (10 tests)
  // ============================================================================

  describe('Pairing Algorithm', () => {
    test('calculateSkillGapScore should return 1.0 for gap of 2', () => {
      const score = calculateSkillGapScore(2, 0);
      expect(score).toBe(1.0);
    });

    test('calculateSkillGapScore should return 0.9 for gap of 3', () => {
      const score = calculateSkillGapScore(3, 0);
      expect(score).toBe(0.9);
    });

    test('calculateSkillGapScore should return 0 for gap < 2', () => {
      const score = calculateSkillGapScore(1, 0);
      expect(score).toBe(0);
    });

    test('calculateAvailabilityScore should return 1.0 for 0 mentees', () => {
      const score = calculateAvailabilityScore(0);
      expect(score).toBe(1.0);
    });

    test('calculateAvailabilityScore should return 0.33 for 2 mentees', () => {
      const score = calculateAvailabilityScore(2);
      expect(score).toBeCloseTo(0.33, 1);
    });

    test('calculateAvailabilityScore should return 0 for 3 mentees', () => {
      const score = calculateAvailabilityScore(3);
      expect(score).toBe(0);
    });

    test('calculateSpecializationMatch should return similarity score', () => {
      const mentor = {
        skillProficiency: {
          taskExecution: 0.9,
          errorHandling: 0.8,
          collaboration: 0.6
        }
      };

      const mentee = { currentLevel: 0 };

      const curriculum = {
        1: {
          skills: ['error_handling', 'retry_logic']
        }
      };

      const score = calculateSpecializationMatch(mentor, mentee, curriculum);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    test('validatePairing should reject if level gap < 2', () => {
      const mentor = { agentId: 'm1', currentLevel: 1, mentees: [], status: 'active' };
      const mentee = { agentId: 'me1', currentLevel: 0, mentorId: null };

      const result = validatePairing(mentor, mentee);
      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('Mentor must be at least 2 levels above mentee');
    });

    test('validatePairing should reject if mentor at capacity', () => {
      const mentor = {
        agentId: 'm2',
        currentLevel: 3,
        mentees: ['a1', 'a2', 'a3'],
        status: 'active'
      };
      const mentee = { agentId: 'me2', currentLevel: 0, mentorId: null };

      const result = validatePairing(mentor, mentee);
      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('Mentor has reached maximum capacity (3 mentees)');
    });

    test('validatePairing should approve valid pairing', () => {
      const mentor = {
        agentId: 'm3',
        currentLevel: 3,
        mentees: ['a1'],
        status: 'active'
      };
      const mentee = { agentId: 'me3', currentLevel: 0, mentorId: null };

      const result = validatePairing(mentor, mentee);
      expect(result.isValid).toBe(true);
      expect(result.issues).toEqual([]);
    });
  });

  // ============================================================================
  // Mentor-Mentee Pairing Tests (6 tests)
  // ============================================================================

  describe('pairMentorMentee()', () => {
    beforeEach(() => {
      // Create mentor and mentee
      mentorshipSystem.initializeAgent('mentor-1');
      mentorshipSystem.initializeAgent('mentee-1');

      // Promote mentor to Level 3
      const mentor = mentorshipSystem.getAgentProfile('mentor-1');
      mentor.currentLevel = 3;
      mentor.skillProficiency.taskExecution = 0.9;
    });

    test('should pair mentor with mentee', async () => {
      const pairing = await mentorshipSystem.pairMentorMentee('mentee-1');

      expect(pairing).toBeDefined();
      expect(pairing.mentorId).toBe('mentor-1');
      expect(pairing.menteeId).toBe('mentee-1');
      expect(pairing.status).toBe('active');
    });

    test('should update mentee profile with mentor ID', async () => {
      await mentorshipSystem.pairMentorMentee('mentee-1');

      const mentee = mentorshipSystem.getAgentProfile('mentee-1');
      expect(mentee.mentorId).toBe('mentor-1');
    });

    test('should add mentee to mentor\'s mentee list', async () => {
      await mentorshipSystem.pairMentorMentee('mentee-1');

      const mentor = mentorshipSystem.getAgentProfile('mentor-1');
      expect(mentor.mentees).toContain('mentee-1');
    });

    test('should publish pairing event via RabbitMQ', async () => {
      await mentorshipSystem.pairMentorMentee('mentee-1');

      expect(mockClient.publishStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'mentorship_paired',
          mentorId: 'mentor-1',
          menteeId: 'mentee-1'
        }),
        'agent.mentorship.paired'
      );
    });

    test('should throw error if mentee not found', async () => {
      await expect(
        mentorshipSystem.pairMentorMentee('non-existent')
      ).rejects.toThrow('Mentee not found');
    });

    test('should throw error if no mentors available', async () => {
      // Remove mentor
      const mentor = mentorshipSystem.getAgentProfile('mentor-1');
      mentor.currentLevel = 0;

      await expect(
        mentorshipSystem.pairMentorMentee('mentee-1')
      ).rejects.toThrow('No available mentors found');
    });
  });

  // ============================================================================
  // Knowledge Transfer Tests (8 tests)
  // ============================================================================

  describe('transferKnowledge()', () => {
    beforeEach(() => {
      mentorshipSystem.initializeAgent('mentor-2');
      mentorshipSystem.initializeAgent('mentee-2');
    });

    test('should create knowledge transfer message', async () => {
      const transferId = await mentorshipSystem.transferKnowledge(
        'mentor-2',
        'mentee-2',
        TransferType.OBSERVATION,
        { task: 'test-task' }
      );

      expect(transferId).toBeDefined();
      expect(typeof transferId).toBe('string');
    });

    test('should publish transfer via RabbitMQ', async () => {
      await mentorshipSystem.transferKnowledge(
        'mentor-2',
        'mentee-2',
        TransferType.PATTERN_SHARING,
        { pattern: 'test-pattern' }
      );

      expect(mockClient.publishTask).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'knowledge_transfer',
          from: 'mentor-2',
          to: 'mentee-2',
          transferType: TransferType.PATTERN_SHARING
        }),
        'agent.knowledge'
      );
    });

    test('should increment mentee knowledgeTransfersReceived', async () => {
      await mentorshipSystem.transferKnowledge(
        'mentor-2',
        'mentee-2',
        TransferType.CO_EXECUTION,
        {}
      );

      const mentee = mentorshipSystem.getAgentProfile('mentee-2');
      expect(mentee.trainingProgress.knowledgeTransfersReceived).toBe(1);
    });

    test('should increment mentor knowledgeTransfersGiven', async () => {
      await mentorshipSystem.transferKnowledge(
        'mentor-2',
        'mentee-2',
        TransferType.FEEDBACK,
        {}
      );

      const mentor = mentorshipSystem.getAgentProfile('mentor-2');
      expect(mentor.trainingProgress.knowledgeTransfersGiven).toBe(1);
    });

    test('should store transfer in Map', async () => {
      const transferId = await mentorshipSystem.transferKnowledge(
        'mentor-2',
        'mentee-2',
        TransferType.INDEPENDENT,
        {}
      );

      expect(mentorshipSystem.knowledgeTransfers.has(transferId)).toBe(true);
    });

    test('should emit knowledge_transferred event', async () => {
      const eventSpy = jest.fn();
      mentorshipSystem.on('knowledge_transferred', eventSpy);

      await mentorshipSystem.transferKnowledge(
        'mentor-2',
        'mentee-2',
        TransferType.TEACHING,
        {}
      );

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'knowledge_transfer',
          from: 'mentor-2',
          to: 'mentee-2'
        })
      );
    });

    test('createObservationSession should create valid message', () => {
      const session = createObservationSession('m1', 'me1', {
        task: 'test',
        steps: ['step1', 'step2']
      });

      expect(session.transferType).toBe(TransferType.OBSERVATION);
      expect(session.content.sessionType).toBe('shadowing');
    });

    test('createCoExecutionSession should create valid message', () => {
      const session = createCoExecutionSession('m1', 'me1', {
        task: 'test',
        mentorRole: 'guide'
      });

      expect(session.transferType).toBe(TransferType.CO_EXECUTION);
      expect(session.content.sessionType).toBe('guided_practice');
    });
  });

  // ============================================================================
  // Progress Tracking Tests (6 tests)
  // ============================================================================

  describe('updateProgress()', () => {
    beforeEach(() => {
      mentorshipSystem.initializeAgent('agent-progress');
    });

    test('should update tasksCompleted', () => {
      mentorshipSystem.updateProgress('agent-progress', {
        tasksCompleted: 5
      });

      const agent = mentorshipSystem.getAgentProfile('agent-progress');
      expect(agent.trainingProgress.tasksCompleted).toBe(5);
    });

    test('should update multiple metrics', () => {
      mentorshipSystem.updateProgress('agent-progress', {
        tasksCompleted: 10,
        brainstormsAttended: 3,
        errorHandlingSuccesses: 5
      });

      const agent = mentorshipSystem.getAgentProfile('agent-progress');
      expect(agent.trainingProgress.tasksCompleted).toBe(10);
      expect(agent.trainingProgress.brainstormsAttended).toBe(3);
      expect(agent.trainingProgress.errorHandlingSuccesses).toBe(5);
    });

    test('should accumulate values on multiple updates', () => {
      mentorshipSystem.updateProgress('agent-progress', { tasksCompleted: 5 });
      mentorshipSystem.updateProgress('agent-progress', { tasksCompleted: 3 });

      const agent = mentorshipSystem.getAgentProfile('agent-progress');
      expect(agent.trainingProgress.tasksCompleted).toBe(8);
    });

    test('should emit progress_updated event', () => {
      const eventSpy = jest.fn();
      mentorshipSystem.on('progress_updated', eventSpy);

      mentorshipSystem.updateProgress('agent-progress', { tasksCompleted: 1 });

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({ agentId: 'agent-progress' })
      );
    });

    test('should handle non-existent agent gracefully', () => {
      // Should not throw
      expect(() => {
        mentorshipSystem.updateProgress('non-existent', { tasksCompleted: 1 });
      }).not.toThrow();
    });

    test('should ignore unknown fields', () => {
      mentorshipSystem.updateProgress('agent-progress', {
        tasksCompleted: 5,
        unknownField: 100
      });

      const agent = mentorshipSystem.getAgentProfile('agent-progress');
      expect(agent.trainingProgress.tasksCompleted).toBe(5);
      expect(agent.trainingProgress.unknownField).toBeUndefined();
    });
  });

  // ============================================================================
  // Graduation Tests (6 tests)
  // ============================================================================

  describe('checkGraduationCriteria() and graduateAgent()', () => {
    beforeEach(() => {
      mentorshipSystem.initializeAgent('grad-agent');
    });

    test('should return false if criteria not met', () => {
      const result = mentorshipSystem.checkGraduationCriteria('grad-agent');
      expect(result).toBe(false);
    });

    test('should return true when Level 0 criteria met', () => {
      const agent = mentorshipSystem.getAgentProfile('grad-agent');
      agent.trainingProgress.tasksCompleted = 10;
      agent.trainingProgress.tasksSuccessRate = 0.91;

      const result = mentorshipSystem.checkGraduationCriteria('grad-agent');
      expect(result).toBe(true);
    });

    test('should auto-graduate when criteria met', () => {
      const agent = mentorshipSystem.getAgentProfile('grad-agent');
      agent.trainingProgress.tasksCompleted = 10;
      agent.trainingProgress.tasksSuccessRate = 0.91;

      mentorshipSystem.checkGraduationCriteria('grad-agent');

      expect(agent.currentLevel).toBe(1);
    });

    test('should add milestone on graduation', async () => {
      const agent = mentorshipSystem.getAgentProfile('grad-agent');
      agent.trainingProgress.tasksCompleted = 10;
      agent.trainingProgress.tasksSuccessRate = 0.91;

      await mentorshipSystem.graduateAgent('grad-agent');

      expect(agent.milestones.length).toBe(1);
      expect(agent.milestones[0].level).toBe(0);
    });

    test('should award badge on graduation', async () => {
      const agent = mentorshipSystem.getAgentProfile('grad-agent');

      await mentorshipSystem.graduateAgent('grad-agent');

      expect(agent.badges.length).toBe(1);
      expect(agent.badges[0].name).toBe('Level 1 Graduate');
    });

    test('should publish graduation event', async () => {
      const agent = mentorshipSystem.getAgentProfile('grad-agent');

      await mentorshipSystem.graduateAgent('grad-agent');

      expect(mockClient.publishStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'agent_graduated',
          agentId: 'grad-agent',
          previousLevel: 0,
          newLevel: 1
        }),
        'agent.mentorship.graduated'
      );
    });
  });

  // ============================================================================
  // Statistics Tests (4 tests)
  // ============================================================================

  describe('getMentorshipStats()', () => {
    test('should return empty stats for no agents', () => {
      const stats = mentorshipSystem.getMentorshipStats();

      expect(stats.totalAgents).toBe(0);
      expect(stats.averageLevel).toBe(0);
      expect(stats.activeMentorships).toBe(0);
    });

    test('should calculate total agents', () => {
      mentorshipSystem.initializeAgent('a1');
      mentorshipSystem.initializeAgent('a2');
      mentorshipSystem.initializeAgent('a3');

      const stats = mentorshipSystem.getMentorshipStats();
      expect(stats.totalAgents).toBe(3);
    });

    test('should calculate average level', () => {
      mentorshipSystem.initializeAgent('a1');
      mentorshipSystem.initializeAgent('a2');

      const a1 = mentorshipSystem.getAgentProfile('a1');
      a1.currentLevel = 2;

      const a2 = mentorshipSystem.getAgentProfile('a2');
      a2.currentLevel = 4;

      const stats = mentorshipSystem.getMentorshipStats();
      expect(stats.averageLevel).toBe(3); // (2 + 4) / 2
    });

    test('should calculate graduation rate', () => {
      mentorshipSystem.initializeAgent('a1');
      mentorshipSystem.initializeAgent('a2');
      mentorshipSystem.initializeAgent('a3');

      const a1 = mentorshipSystem.getAgentProfile('a1');
      a1.currentLevel = 1;

      const a2 = mentorshipSystem.getAgentProfile('a2');
      a2.currentLevel = 2;

      const stats = mentorshipSystem.getMentorshipStats();
      expect(stats.graduationRate).toBeCloseTo(0.67, 1); // 2/3 graduated
    });
  });

  // ============================================================================
  // Knowledge Transfer Module Tests (6 tests)
  // ============================================================================

  describe('Knowledge Transfer Functions', () => {
    test('createPatternSharing should include all pattern details', () => {
      const pattern = {
        name: 'Retry Pattern',
        category: 'resilience',
        context: 'Network errors',
        problem: 'Transient failures',
        solution: 'Exponential backoff',
        applicableScenarios: ['timeout', 'network']
      };

      const transfer = createPatternSharing('m1', 'me1', pattern);

      expect(transfer.content.patternName).toBe('Retry Pattern');
      expect(transfer.content.category).toBe('resilience');
      expect(transfer.content.applicableScenarios).toContain('timeout');
    });

    test('buildAcceleratedCurriculum should create 3-day plan', () => {
      const mentee = { agentId: 'me1', currentLevel: 0 };
      const mentor = { agentId: 'm1', currentLevel: 3 };

      const curriculum = buildAcceleratedCurriculum(mentee, mentor);

      expect(curriculum.duration).toBe(3);
      expect(curriculum.day1).toBeDefined();
      expect(curriculum.day2).toBeDefined();
      expect(curriculum.day3).toBeDefined();
    });

    test('buildAcceleratedCurriculum day 1 should have 4 sessions', () => {
      const mentee = { agentId: 'me1', currentLevel: 0 };
      const mentor = { agentId: 'm1', currentLevel: 3 };

      const curriculum = buildAcceleratedCurriculum(mentee, mentor);

      expect(curriculum.day1.sessions.length).toBe(4);
      expect(curriculum.day1.sessions[0].type).toBe(TransferType.OBSERVATION);
    });

    test('recommendTransferTypes should handle empty history', () => {
      const mentee = { agentId: 'me1', currentLevel: 0 };
      const history = [];

      const recommendations = recommendTransferTypes(mentee, history);

      expect(recommendations.topPerforming).toEqual([]);
      expect(recommendations.underutilized.length).toBeGreaterThan(0);
    });

    test('recommendTransferTypes should rank by effectiveness', () => {
      const mentee = { agentId: 'me1', currentLevel: 0 };
      const history = [
        { transferType: TransferType.OBSERVATION, effectiveness: 0.8 },
        { transferType: TransferType.OBSERVATION, effectiveness: 0.9 },
        { transferType: TransferType.CO_EXECUTION, effectiveness: 0.6 }
      ];

      const recommendations = recommendTransferTypes(mentee, history);

      expect(recommendations.topPerforming[0].type).toBe(TransferType.OBSERVATION);
      expect(recommendations.topPerforming[0].averageEffectiveness).toBeCloseTo(0.85, 1);
    });

    test('calculateMentorWorkload should return workload stats', () => {
      const profiles = [
        { agentId: 'm1', currentLevel: 3, mentees: ['a1', 'a2'] },
        { agentId: 'm2', currentLevel: 4, mentees: ['a3'] },
        { agentId: 'm3', currentLevel: 3, mentees: [] }
      ];

      const workload = calculateMentorWorkload(profiles);

      expect(workload.totalMentors).toBe(3);
      expect(workload.averageMentees).toBe(1); // (2+1+0)/3
      expect(workload.maxMentees).toBe(2);
      expect(workload.minMentees).toBe(0);
    });
  });
});

describe('Integration: Full Mentorship Flow', () => {
  let mentorshipSystem;
  let mockClient;

  beforeEach(() => {
    mockClient = {
      isHealthy: jest.fn().mockReturnValue(true),
      publishStatus: jest.fn().mockResolvedValue('msg-123'),
      publishTask: jest.fn().mockResolvedValue('msg-456')
    };

    mentorshipSystem = new MentorshipSystem(mockClient);
  });

  test('Complete Level 0 to Level 1 graduation flow', async () => {
    // 1. Initialize mentor and mentee
    mentorshipSystem.initializeAgent('mentor-complete');
    mentorshipSystem.initializeAgent('mentee-complete');

    const mentor = mentorshipSystem.getAgentProfile('mentor-complete');
    mentor.currentLevel = 3;

    // 2. Pair them
    await mentorshipSystem.pairMentorMentee('mentee-complete');

    // 3. Transfer knowledge
    await mentorshipSystem.transferKnowledge(
      'mentor-complete',
      'mentee-complete',
      TransferType.OBSERVATION,
      { task: 'test' }
    );

    // 4. Update progress to meet graduation criteria
    mentorshipSystem.updateProgress('mentee-complete', {
      tasksCompleted: 10,
      tasksSuccessRate: 0.95
    });

    // 5. Verify graduation
    const mentee = mentorshipSystem.getAgentProfile('mentee-complete');
    expect(mentee.currentLevel).toBe(1);
    expect(mentee.milestones.length).toBe(1);
    expect(mentee.badges.length).toBe(1);
  });
});
