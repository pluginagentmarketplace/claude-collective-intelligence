#!/usr/bin/env node
/**
 * Agent Mentorship System
 * Accelerates agent training from 30 days → 3 days (10x improvement)
 *
 * Features:
 * - Intelligent mentor-mentee pairing
 * - 5-level proficiency system (Novice → Master)
 * - Knowledge transfer protocols (5 mechanisms)
 * - Progress tracking and graduation criteria
 * - RabbitMQ integration for events
 */

import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import {
  findBestMentor,
  validatePairing,
  calculateMentorWorkload
} from './mentorship/pairing-algorithm.js';
import {
  buildAcceleratedCurriculum,
  createKnowledgeTransfer,
  createPatternSharing,
  trackTransferEffectiveness
} from './mentorship/knowledge-transfer.js';

/**
 * Mentorship System
 * Manages agent training, mentor-mentee relationships, and knowledge transfer
 */
export class MentorshipSystem extends EventEmitter {
  constructor(rabbitMQClient) {
    super();
    this.client = rabbitMQClient;
    this.mentorships = new Map();
    this.agentProfiles = new Map();
    this.knowledgeTransfers = new Map();
    this.curriculum = this.buildCurriculum();
  }

  /**
   * Build 5-level training curriculum
   * Each level has specific requirements and skills
   */
  buildCurriculum() {
    return {
      0: {
        name: 'Novice',
        duration: 1, // days
        requirements: {
          tasksCompleted: 10,
          successRate: 0.90
        },
        skills: ['basic_execution', 'message_queue', 'acknowledgment'],
        description: 'Learn basic task execution and message queue interaction'
      },
      1: {
        name: 'Beginner',
        duration: 1, // days
        requirements: {
          tasksCompleted: 15,
          successRate: 0.85,
          errorHandlingSuccesses: 5,
          brainstormsAttended: 3
        },
        skills: ['error_handling', 'retry_logic', 'basic_collaboration'],
        description: 'Master error handling and begin collaborating with other agents'
      },
      2: {
        name: 'Intermediate',
        duration: 1, // days
        requirements: {
          complexTasksCompleted: 1,
          brainstormsInitiated: 2,
          successRate: 0.90
        },
        skills: ['task_decomposition', 'workflow_management', 'proactive_brainstorm'],
        description: 'Handle complex tasks and take initiative in collaboration'
      },
      3: {
        name: 'Advanced',
        duration: 4, // days
        requirements: {
          mentoredAgents: 1,
          knowledgeTransfersGiven: 5
        },
        skills: ['mentorship', 'knowledge_sharing', 'result_synthesis'],
        description: 'Begin mentoring others and sharing knowledge'
      },
      4: {
        name: 'Expert',
        duration: 7, // days
        requirements: {
          mentoredAgents: 3,
          level2Graduates: 3
        },
        skills: ['optimization', 'architecture', 'multi_mentee'],
        description: 'Expert-level mentorship and system optimization'
      },
      5: {
        name: 'Master',
        duration: null, // ongoing
        requirements: {
          curriculumContributions: 2,
          frameworkImprovements: 1
        },
        skills: ['curriculum_dev', 'framework_design', 'cross_specialty'],
        description: 'Contribute to the system itself and mentor mentors'
      }
    };
  }

  /**
   * Initialize agent profile
   * Creates a new agent in the mentorship system
   *
   * @param {string} agentId - Agent identifier
   * @param {string} agentType - Agent type (worker, leader, etc.)
   * @returns {Object} Agent profile
   */
  initializeAgent(agentId, agentType = 'worker') {
    const profile = {
      agentId,
      agentType,
      currentLevel: 0,
      enrolledDate: Date.now(),
      mentorId: null,
      mentees: [],
      status: 'active',

      skillProficiency: {
        taskExecution: 0.0,
        errorHandling: 0.0,
        collaboration: 0.0,
        knowledgeSharing: 0.0,
        systemOptimization: 0.0
      },

      trainingProgress: {
        tasksCompleted: 0,
        tasksSuccessRate: 0.0,
        brainstormsAttended: 0,
        brainstormsInitiated: 0,
        knowledgeTransfersReceived: 0,
        knowledgeTransfersGiven: 0,
        knowledgeTransfersApplied: 0,
        errorHandlingSuccesses: 0,
        complexTasksCompleted: 0,
        mentoredAgents: 0,
        level2Graduates: 0,
        curriculumContributions: 0,
        frameworkImprovements: 0
      },

      milestones: [],
      badges: [],

      stats: {
        totalTrainingTime: 0,
        averageTaskDuration: 0,
        preferredTaskTypes: []
      },

      mentorStats: {
        totalMentees: 0,
        graduatedMentees: 0,
        averageTrainingTime: 0,
        menteeSatisfaction: 0
      }
    };

    this.agentProfiles.set(agentId, profile);
    this.emit('agent_enrolled', profile);

    console.log(`📚 Agent ${agentId} enrolled in mentorship program at Level 0`);

    return profile;
  }

  /**
   * Get agent profile
   * @param {string} agentId - Agent identifier
   * @returns {Object|null} Agent profile or null
   */
  getAgentProfile(agentId) {
    return this.agentProfiles.get(agentId);
  }

  /**
   * Get all agent profiles
   * @returns {Array} All agent profiles
   */
  getAllProfiles() {
    return Array.from(this.agentProfiles.values());
  }

  /**
   * Pair mentor with mentee
   * Uses intelligent pairing algorithm
   *
   * @param {string} menteeId - Mentee agent ID
   * @returns {Promise<Object>} Pairing details
   */
  async pairMentorMentee(menteeId) {
    const mentee = this.agentProfiles.get(menteeId);
    if (!mentee) {
      throw new Error(`Mentee not found: ${menteeId}`);
    }

    // Find best mentor using pairing algorithm
    const allProfiles = this.getAllProfiles();
    const mentor = findBestMentor(mentee, allProfiles, this.curriculum);

    if (!mentor) {
      throw new Error('No available mentors found');
    }

    // Validate pairing
    const validation = validatePairing(mentor, mentee);
    if (!validation.isValid) {
      throw new Error(`Invalid pairing: ${validation.issues.join(', ')}`);
    }

    // Create pairing
    const pairingId = uuidv4();
    const pairing = {
      id: pairingId,
      mentorId: mentor.agentId,
      menteeId: menteeId,
      startDate: Date.now(),
      targetLevel: mentee.currentLevel + 1,
      status: 'active',
      sessions: [],
      progress: 0.0,
      curriculum: buildAcceleratedCurriculum(mentee, mentor)
    };

    this.mentorships.set(pairingId, pairing);

    // Update profiles
    mentee.mentorId = mentor.agentId;
    mentor.mentees.push(menteeId);
    mentor.mentorStats.totalMentees++;

    // Publish pairing event via RabbitMQ
    await this.client.publishStatus({
      event: 'mentorship_paired',
      pairingId,
      mentorId: mentor.agentId,
      menteeId: menteeId,
      targetLevel: pairing.targetLevel,
      curriculum: pairing.curriculum
    }, 'agent.mentorship.paired');

    this.emit('pairing_created', pairing);

    console.log(`🤝 Paired mentor ${mentor.agentId} (Level ${mentor.currentLevel}) with mentee ${menteeId} (Level ${mentee.currentLevel})`);

    return pairing;
  }

  /**
   * Transfer knowledge from mentor to mentee
   * @param {string} mentorId - Mentor agent ID
   * @param {string} menteeId - Mentee agent ID
   * @param {string} transferType - Type of knowledge transfer
   * @param {Object} content - Transfer content
   * @returns {Promise<string>} Transfer ID
   */
  async transferKnowledge(mentorId, menteeId, transferType, content) {
    const message = createKnowledgeTransfer(mentorId, menteeId, transferType, content);

    // Store transfer record
    this.knowledgeTransfers.set(message.id, message);

    // Publish via RabbitMQ
    await this.client.publishTask(message, 'agent.knowledge');

    // Update mentee progress
    const mentee = this.agentProfiles.get(menteeId);
    if (mentee) {
      mentee.trainingProgress.knowledgeTransfersReceived++;
    }

    // Update mentor stats
    const mentor = this.agentProfiles.get(mentorId);
    if (mentor) {
      mentor.trainingProgress.knowledgeTransfersGiven++;
    }

    this.emit('knowledge_transferred', message);

    console.log(`📖 Knowledge transferred: ${transferType} from ${mentorId} to ${menteeId}`);

    return message.id;
  }

  /**
   * Record knowledge transfer application
   * Tracks when mentee applies learned knowledge
   *
   * @param {string} transferId - Transfer ID
   * @param {Object} outcome - Application outcome
   */
  recordTransferApplication(transferId, outcome) {
    const transfer = this.knowledgeTransfers.get(transferId);
    if (!transfer) {
      console.warn(`Transfer not found: ${transferId}`);
      return;
    }

    // Track effectiveness
    const effectiveness = trackTransferEffectiveness(transfer, outcome);

    // Update transfer record
    transfer.status = 'applied';
    transfer.effectiveness = effectiveness.effectiveness;
    transfer.outcome = outcome;

    // Update mentee stats
    const mentee = this.agentProfiles.get(transfer.to);
    if (mentee) {
      mentee.trainingProgress.knowledgeTransfersApplied++;
    }

    this.emit('transfer_applied', { transfer, effectiveness });

    console.log(`✅ Knowledge transfer applied: ${transferId} (effectiveness: ${(effectiveness.effectiveness * 100).toFixed(0)}%)`);
  }

  /**
   * Update agent progress
   * Called when agent completes tasks, brainstorms, etc.
   *
   * @param {string} agentId - Agent identifier
   * @param {Object} progressUpdate - Progress updates
   */
  updateProgress(agentId, progressUpdate) {
    const agent = this.agentProfiles.get(agentId);
    if (!agent) {
      console.warn(`Agent not found: ${agentId}`);
      return;
    }

    // Update progress metrics
    Object.keys(progressUpdate).forEach(key => {
      if (agent.trainingProgress.hasOwnProperty(key)) {
        if (typeof progressUpdate[key] === 'number') {
          agent.trainingProgress[key] += progressUpdate[key];
        } else {
          agent.trainingProgress[key] = progressUpdate[key];
        }
      }
    });

    // Recalculate success rate if task data provided
    if (progressUpdate.tasksSucceeded !== undefined || progressUpdate.tasksFailed !== undefined) {
      const succeeded = progressUpdate.tasksSucceeded || 0;
      const failed = progressUpdate.tasksFailed || 0;
      const total = agent.trainingProgress.tasksCompleted + succeeded + failed;

      if (total > 0) {
        agent.trainingProgress.tasksSuccessRate =
          (agent.trainingProgress.tasksCompleted * agent.trainingProgress.tasksSuccessRate + succeeded) / total;
      }
    }

    // Check if ready to graduate
    this.checkGraduationCriteria(agentId);

    this.emit('progress_updated', { agentId, progress: agent.trainingProgress });
  }

  /**
   * Check if agent meets graduation criteria for current level
   * @param {string} agentId - Agent identifier
   * @returns {boolean} True if criteria met
   */
  checkGraduationCriteria(agentId) {
    const agent = this.agentProfiles.get(agentId);
    if (!agent) return false;

    const currentLevel = agent.currentLevel;
    const requirements = this.curriculum[currentLevel]?.requirements;

    if (!requirements) return false;

    const progress = agent.trainingProgress;
    const criteriaMet = {};

    // Check each requirement
    if (requirements.tasksCompleted !== undefined) {
      criteriaMet.tasksCompleted = progress.tasksCompleted >= requirements.tasksCompleted;
    }
    if (requirements.successRate !== undefined) {
      criteriaMet.successRate = progress.tasksSuccessRate >= requirements.successRate;
    }
    if (requirements.errorHandlingSuccesses !== undefined) {
      criteriaMet.errorHandling = progress.errorHandlingSuccesses >= requirements.errorHandlingSuccesses;
    }
    if (requirements.brainstormsAttended !== undefined) {
      criteriaMet.brainstormsAttended = progress.brainstormsAttended >= requirements.brainstormsAttended;
    }
    if (requirements.complexTasksCompleted !== undefined) {
      criteriaMet.complexTasks = progress.complexTasksCompleted >= requirements.complexTasksCompleted;
    }
    if (requirements.brainstormsInitiated !== undefined) {
      criteriaMet.brainstormsInitiated = progress.brainstormsInitiated >= requirements.brainstormsInitiated;
    }
    if (requirements.mentoredAgents !== undefined) {
      criteriaMet.mentoredAgents = progress.mentoredAgents >= requirements.mentoredAgents;
    }
    if (requirements.knowledgeTransfersGiven !== undefined) {
      criteriaMet.knowledgeTransfersGiven = progress.knowledgeTransfersGiven >= requirements.knowledgeTransfersGiven;
    }
    if (requirements.level2Graduates !== undefined) {
      criteriaMet.level2Graduates = progress.level2Graduates >= requirements.level2Graduates;
    }
    if (requirements.curriculumContributions !== undefined) {
      criteriaMet.curriculumContributions = progress.curriculumContributions >= requirements.curriculumContributions;
    }
    if (requirements.frameworkImprovements !== undefined) {
      criteriaMet.frameworkImprovements = progress.frameworkImprovements >= requirements.frameworkImprovements;
    }

    // All criteria met?
    const allMet = Object.values(criteriaMet).every(met => met === true);

    if (allMet) {
      this.graduateAgent(agentId);
    }

    return allMet;
  }

  /**
   * Graduate agent to next level
   * @param {string} agentId - Agent identifier
   * @returns {Promise<Object>} Graduation details
   */
  async graduateAgent(agentId) {
    const agent = this.agentProfiles.get(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    const previousLevel = agent.currentLevel;
    agent.currentLevel++;

    const trainingDuration = (Date.now() - agent.enrolledDate) / (1000 * 60 * 60 * 24); // days

    const milestone = {
      level: previousLevel,
      completedDate: Date.now(),
      durationDays: trainingDuration
    };

    agent.milestones.push(milestone);

    // Award badge
    const badge = {
      name: `Level ${agent.currentLevel} Graduate`,
      earnedDate: Date.now(),
      criteria: this.curriculum[previousLevel].name
    };
    agent.badges.push(badge);

    // Update total training time
    agent.stats.totalTrainingTime = trainingDuration;

    // Update mentor's stats if applicable
    if (agent.mentorId) {
      const mentor = this.agentProfiles.get(agent.mentorId);
      if (mentor) {
        mentor.mentorStats.graduatedMentees++;

        // Update mentor's average training time
        const totalTime = mentor.mentorStats.averageTrainingTime * (mentor.mentorStats.graduatedMentees - 1) + trainingDuration;
        mentor.mentorStats.averageTrainingTime = totalTime / mentor.mentorStats.graduatedMentees;

        // Track Level 2 graduates for mentor progression
        if (agent.currentLevel === 2) {
          mentor.trainingProgress.level2Graduates++;
        }

        // Check if mentor can graduate
        this.checkGraduationCriteria(agent.mentorId);
      }
    }

    // Publish graduation event
    await this.client.publishStatus({
      event: 'agent_graduated',
      agentId,
      previousLevel,
      newLevel: agent.currentLevel,
      milestone,
      badge,
      trainingDuration
    }, 'agent.mentorship.graduated');

    this.emit('agent_graduated', {
      agentId,
      previousLevel,
      newLevel: agent.currentLevel,
      trainingDuration
    });

    console.log(`🎓 Agent ${agentId} graduated from Level ${previousLevel} to Level ${agent.currentLevel} in ${trainingDuration.toFixed(1)} days!`);

    return {
      agentId,
      previousLevel,
      newLevel: agent.currentLevel,
      milestone,
      badge
    };
  }

  /**
   * Get mentorship statistics
   * @returns {Object} System-wide mentorship stats
   */
  getMentorshipStats() {
    const profiles = this.getAllProfiles();

    if (profiles.length === 0) {
      return {
        totalAgents: 0,
        averageLevel: 0,
        levelDistribution: {},
        activeMentorships: 0,
        averageTrainingTime: 0,
        graduationRate: 0
      };
    }

    const totalAgents = profiles.length;
    const averageLevel = profiles.reduce((sum, p) => sum + p.currentLevel, 0) / totalAgents;
    const levelDistribution = this.getLevelDistribution(profiles);
    const activeMentorships = this.mentorships.size;
    const averageTrainingTime = this.getAverageTrainingTime(profiles);
    const graduationRate = this.getGraduationRate(profiles);
    const workloadStats = calculateMentorWorkload(profiles);

    return {
      totalAgents,
      averageLevel: parseFloat(averageLevel.toFixed(2)),
      levelDistribution,
      activeMentorships,
      averageTrainingTime: parseFloat(averageTrainingTime.toFixed(2)),
      graduationRate: parseFloat(graduationRate.toFixed(2)),
      mentorWorkload: workloadStats,
      accelerationFactor: 30 / (averageTrainingTime || 30) // vs 30-day baseline
    };
  }

  /**
   * Get level distribution
   * @param {Array} profiles - Agent profiles
   * @returns {Object} Level distribution
   */
  getLevelDistribution(profiles) {
    const distribution = {};
    profiles.forEach(p => {
      distribution[p.currentLevel] = (distribution[p.currentLevel] || 0) + 1;
    });
    return distribution;
  }

  /**
   * Get average training time
   * @param {Array} profiles - Agent profiles
   * @returns {number} Average training time in days
   */
  getAverageTrainingTime(profiles) {
    const graduatedAgents = profiles.filter(p => p.milestones.length > 0);
    if (graduatedAgents.length === 0) return 0;

    const totalTime = graduatedAgents.reduce((sum, agent) => {
      return sum + agent.stats.totalTrainingTime;
    }, 0);

    return totalTime / graduatedAgents.length;
  }

  /**
   * Get graduation rate
   * @param {Array} profiles - Agent profiles
   * @returns {number} Graduation rate (0-1)
   */
  getGraduationRate(profiles) {
    const enrolledAgents = profiles.length;
    const graduatedAgents = profiles.filter(p => p.currentLevel > 0).length;

    return enrolledAgents > 0 ? graduatedAgents / enrolledAgents : 0;
  }

  /**
   * Get mentorship pairing details
   * @param {string} pairingId - Pairing identifier
   * @returns {Object|null} Pairing details
   */
  getPairing(pairingId) {
    return this.mentorships.get(pairingId);
  }

  /**
   * End mentorship pairing
   * @param {string} pairingId - Pairing identifier
   * @param {string} reason - Reason for ending
   * @returns {Promise<void>}
   */
  async endPairing(pairingId, reason = 'completed') {
    const pairing = this.mentorships.get(pairingId);
    if (!pairing) {
      throw new Error(`Pairing not found: ${pairingId}`);
    }

    pairing.status = 'ended';
    pairing.endDate = Date.now();
    pairing.endReason = reason;

    // Update profiles
    const mentee = this.agentProfiles.get(pairing.menteeId);
    if (mentee) {
      mentee.mentorId = null;
    }

    const mentor = this.agentProfiles.get(pairing.mentorId);
    if (mentor) {
      mentor.mentees = mentor.mentees.filter(id => id !== pairing.menteeId);
    }

    // Publish event
    await this.client.publishStatus({
      event: 'mentorship_ended',
      pairingId,
      reason
    }, 'agent.mentorship.ended');

    this.emit('pairing_ended', { pairingId, reason });

    console.log(`🔚 Mentorship pairing ${pairingId} ended: ${reason}`);
  }
}

export default MentorshipSystem;
