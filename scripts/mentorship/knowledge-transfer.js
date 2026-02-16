#!/usr/bin/env node
/**
 * Knowledge Transfer System
 * Implements 5 knowledge transfer mechanisms:
 * 1. Observation (Shadowing)
 * 2. Co-Execution (Guided Practice)
 * 3. Independent Practice (Mentor Oversight)
 * 4. Feedback & Reflection
 * 5. Assessment & Validation
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Knowledge Transfer Types
 */
export const TransferType = {
  OBSERVATION: 'observation',          // Mentee watches mentor
  CO_EXECUTION: 'co_execution',        // Work together
  GUIDED_PRACTICE: 'guided_practice',  // Mentee leads, mentor guides
  INDEPENDENT: 'independent',          // Mentee works alone, mentor reviews
  TEACHING: 'teaching',                // Mentee teaches others
  PATTERN_SHARING: 'pattern_sharing',  // Share best practices
  ERROR_ANALYSIS: 'error_analysis',    // Learn from mistakes
  FEEDBACK: 'feedback',                // Mentor provides feedback
  REFLECTION: 'reflection',            // Reflect on learning
  ASSESSMENT: 'assessment'             // Evaluate progress
};

/**
 * Create knowledge transfer session
 * @param {string} mentorId - Mentor agent ID
 * @param {string} menteeId - Mentee agent ID
 * @param {string} transferType - Type of knowledge transfer
 * @param {Object} content - Transfer content
 * @returns {Object} Knowledge transfer message
 */
export function createKnowledgeTransfer(mentorId, menteeId, transferType, content) {
  return {
    id: uuidv4(),
    type: 'knowledge_transfer',
    from: mentorId,
    to: menteeId,
    transferType,
    content,
    timestamp: Date.now(),
    status: 'pending'
  };
}

/**
 * Create observation session (Shadowing)
 * Mentee observes mentor performing tasks
 *
 * @param {string} mentorId - Mentor agent ID
 * @param {string} menteeId - Mentee agent ID
 * @param {Object} taskContext - Task being observed
 * @returns {Object} Observation transfer message
 */
export function createObservationSession(mentorId, menteeId, taskContext) {
  return createKnowledgeTransfer(mentorId, menteeId, TransferType.OBSERVATION, {
    sessionType: 'shadowing',
    task: taskContext.task,
    steps: taskContext.steps || [],
    keyPoints: taskContext.keyPoints || [],
    expectedLearning: taskContext.expectedLearning || [],
    duration: taskContext.duration || 30, // minutes
    instructions: 'Observe how the mentor handles this task. Pay attention to decision-making points and error handling.'
  });
}

/**
 * Create co-execution session (Guided Practice)
 * Mentor and mentee work on task together
 *
 * @param {string} mentorId - Mentor agent ID
 * @param {string} menteeId - Mentee agent ID
 * @param {Object} taskContext - Task to execute together
 * @returns {Object} Co-execution transfer message
 */
export function createCoExecutionSession(mentorId, menteeId, taskContext) {
  return createKnowledgeTransfer(mentorId, menteeId, TransferType.CO_EXECUTION, {
    sessionType: 'guided_practice',
    task: taskContext.task,
    mentorRole: taskContext.mentorRole || 'guide',
    menteeRole: taskContext.menteeRole || 'executor',
    checkpoints: taskContext.checkpoints || [],
    guidance: 'Work together on this task. Ask questions when uncertain. Mentor will provide guidance at key decision points.',
    successCriteria: taskContext.successCriteria || []
  });
}

/**
 * Create independent practice session
 * Mentee executes task independently with mentor oversight
 *
 * @param {string} mentorId - Mentor agent ID
 * @param {string} menteeId - Mentee agent ID
 * @param {Object} taskContext - Task for independent execution
 * @returns {Object} Independent practice transfer message
 */
export function createIndependentPractice(mentorId, menteeId, taskContext) {
  return createKnowledgeTransfer(mentorId, menteeId, TransferType.INDEPENDENT, {
    sessionType: 'independent_execution',
    task: taskContext.task,
    allowedResources: taskContext.allowedResources || ['documentation', 'previous_examples'],
    mentorAvailability: taskContext.mentorAvailability || 'on_request',
    reviewRequired: true,
    timeLimit: taskContext.timeLimit || null,
    instructions: 'Execute this task independently. Mentor will review your work afterward. Ask for help if truly stuck.'
  });
}

/**
 * Create pattern sharing transfer
 * Share best practices, patterns, and solutions
 *
 * @param {string} mentorId - Mentor agent ID
 * @param {string} menteeId - Mentee agent ID
 * @param {Object} pattern - Pattern to share
 * @returns {Object} Pattern sharing transfer message
 */
export function createPatternSharing(mentorId, menteeId, pattern) {
  return createKnowledgeTransfer(mentorId, menteeId, TransferType.PATTERN_SHARING, {
    patternName: pattern.name,
    category: pattern.category || 'general',
    context: pattern.context,
    problem: pattern.problem,
    solution: pattern.solution,
    codeExample: pattern.codeExample || null,
    applicableScenarios: pattern.applicableScenarios || [],
    expectedImprovement: pattern.expectedImprovement || null,
    relatedPatterns: pattern.relatedPatterns || [],
    antiPatterns: pattern.antiPatterns || []
  });
}

/**
 * Create error analysis session
 * Learn from mistakes and failures
 *
 * @param {string} mentorId - Mentor agent ID
 * @param {string} menteeId - Mentee agent ID
 * @param {Object} errorContext - Error details
 * @returns {Object} Error analysis transfer message
 */
export function createErrorAnalysis(mentorId, menteeId, errorContext) {
  return createKnowledgeTransfer(mentorId, menteeId, TransferType.ERROR_ANALYSIS, {
    errorType: errorContext.errorType,
    originalTask: errorContext.task,
    errorDescription: errorContext.description,
    rootCause: errorContext.rootCause || 'To be analyzed',
    correctApproach: errorContext.correctApproach,
    preventionStrategy: errorContext.preventionStrategy,
    lessonLearned: errorContext.lessonLearned,
    similarMistakes: errorContext.similarMistakes || [],
    recoverySteps: errorContext.recoverySteps || []
  });
}

/**
 * Create feedback session
 * Mentor provides constructive feedback
 *
 * @param {string} mentorId - Mentor agent ID
 * @param {string} menteeId - Mentee agent ID
 * @param {Object} feedback - Feedback content
 * @returns {Object} Feedback transfer message
 */
export function createFeedbackSession(mentorId, menteeId, feedback) {
  return createKnowledgeTransfer(mentorId, menteeId, TransferType.FEEDBACK, {
    taskReviewed: feedback.task,
    strengths: feedback.strengths || [],
    areasForImprovement: feedback.areasForImprovement || [],
    specificSuggestions: feedback.specificSuggestions || [],
    nextSteps: feedback.nextSteps || [],
    overallRating: feedback.overallRating || null,
    encouragement: feedback.encouragement || 'Keep up the good work!',
    followUpRequired: feedback.followUpRequired || false
  });
}

/**
 * Create reflection session
 * Encourage mentee to reflect on learning
 *
 * @param {string} mentorId - Mentor agent ID
 * @param {string} menteeId - Mentee agent ID
 * @param {Object} reflectionPrompt - Reflection questions
 * @returns {Object} Reflection transfer message
 */
export function createReflectionSession(mentorId, menteeId, reflectionPrompt) {
  return createKnowledgeTransfer(mentorId, menteeId, TransferType.REFLECTION, {
    topic: reflectionPrompt.topic,
    questions: reflectionPrompt.questions || [
      'What did you learn from this experience?',
      'What would you do differently next time?',
      'What patterns did you recognize?',
      'How can you apply this knowledge to future tasks?'
    ],
    context: reflectionPrompt.context,
    expectedInsights: reflectionPrompt.expectedInsights || [],
    shareWithPeers: reflectionPrompt.shareWithPeers || false
  });
}

/**
 * Create assessment session
 * Evaluate mentee's progress and skills
 *
 * @param {string} mentorId - Mentor agent ID
 * @param {string} menteeId - Mentee agent ID
 * @param {Object} assessment - Assessment details
 * @returns {Object} Assessment transfer message
 */
export function createAssessmentSession(mentorId, menteeId, assessment) {
  return createKnowledgeTransfer(mentorId, menteeId, TransferType.ASSESSMENT, {
    assessmentType: assessment.type || 'skill_check',
    skillsEvaluated: assessment.skills || [],
    tasks: assessment.tasks || [],
    passingCriteria: assessment.passingCriteria || {},
    timeLimit: assessment.timeLimit || null,
    allowedAttempts: assessment.allowedAttempts || 1,
    feedbackTiming: assessment.feedbackTiming || 'immediate',
    certificateOnPass: assessment.certificateOnPass || false
  });
}

/**
 * Build 3-day accelerated training curriculum
 * @param {Object} mentee - Mentee profile
 * @param {Object} mentor - Mentor profile
 * @returns {Object} 3-day training plan
 */
export function buildAcceleratedCurriculum(mentee, mentor) {
  const currentLevel = mentee.currentLevel;
  const targetLevel = currentLevel + 1;

  const curriculum = {
    duration: 3, // days
    currentLevel,
    targetLevel,
    mentorId: mentor.agentId,
    menteeId: mentee.agentId,

    day1: {
      name: 'Foundation Building',
      goal: `Level ${currentLevel} → Level ${currentLevel + 1}`,
      sessions: [
        {
          time: 'Morning',
          type: TransferType.OBSERVATION,
          description: 'Shadow mentor performing 5 tasks',
          expectedLearning: ['Task execution patterns', 'Error handling', 'Message queue interaction'],
          duration: 120
        },
        {
          time: 'Afternoon',
          type: TransferType.CO_EXECUTION,
          description: 'Work together on 5 tasks',
          expectedLearning: ['Hands-on practice', 'Decision-making', 'Problem-solving'],
          duration: 120
        },
        {
          time: 'Evening',
          type: TransferType.INDEPENDENT,
          description: 'Execute 10 tasks independently',
          expectedLearning: ['Confidence building', 'Pattern application', 'Self-reliance'],
          duration: 180
        },
        {
          time: 'End of Day',
          type: TransferType.FEEDBACK,
          description: 'Review day progress and provide feedback',
          expectedLearning: ['Identify strengths and gaps', 'Plan improvements'],
          duration: 30
        }
      ],
      milestones: [
        'Complete 20 total tasks',
        'Achieve 85% success rate',
        'Understand basic patterns'
      ]
    },

    day2: {
      name: 'Capability Building',
      goal: 'Develop intermediate skills',
      sessions: [
        {
          time: 'Morning',
          type: TransferType.PATTERN_SHARING,
          description: 'Advanced error recovery patterns',
          expectedLearning: ['Retry strategies', 'Graceful degradation', 'Circuit breakers'],
          duration: 90
        },
        {
          time: 'Midday',
          type: TransferType.CO_EXECUTION,
          description: 'Participate in 3 brainstorm sessions',
          expectedLearning: ['Collaboration protocols', 'Contribution strategies', 'Consensus building'],
          duration: 120
        },
        {
          time: 'Afternoon',
          type: TransferType.GUIDED_PRACTICE,
          description: 'Complex task decomposition',
          expectedLearning: ['Breaking down complex problems', 'Planning execution', 'Resource management'],
          duration: 120
        },
        {
          time: 'Evening',
          type: TransferType.ERROR_ANALYSIS,
          description: 'Handle 5 intentionally failed tasks',
          expectedLearning: ['Error diagnosis', 'Recovery strategies', 'Resilience'],
          duration: 90
        },
        {
          time: 'End of Day',
          type: TransferType.REFLECTION,
          description: 'Reflect on collaboration and error handling',
          expectedLearning: ['Self-awareness', 'Continuous improvement mindset'],
          duration: 30
        }
      ],
      milestones: [
        'Handle 5 errors successfully',
        'Participate in 3 brainstorms',
        'Complete 1 complex task'
      ]
    },

    day3: {
      name: 'Mastery Demonstration',
      goal: `Graduate to Level ${currentLevel + 1}`,
      sessions: [
        {
          time: 'Morning',
          type: TransferType.INDEPENDENT,
          description: 'Execute complex multi-step workflow alone',
          expectedLearning: ['End-to-end ownership', 'Complex coordination', 'Quality delivery'],
          duration: 150
        },
        {
          time: 'Midday',
          type: TransferType.TEACHING,
          description: 'Initiate and lead 2 brainstorms',
          expectedLearning: ['Leadership', 'Communication', 'Facilitation'],
          duration: 90
        },
        {
          time: 'Afternoon',
          type: TransferType.TEACHING,
          description: 'Teach pattern to new Level 0 agent',
          expectedLearning: ['Knowledge consolidation', 'Teaching skills', 'Empathy'],
          duration: 120
        },
        {
          time: 'Evening',
          type: TransferType.ASSESSMENT,
          description: 'Final graduation assessment',
          expectedLearning: ['Skill validation', 'Certification readiness'],
          duration: 60
        }
      ],
      milestones: [
        'Complete complex workflow',
        'Lead 2 brainstorms',
        'Successfully teach another agent',
        'Pass graduation assessment'
      ]
    }
  };

  return curriculum;
}

/**
 * Track knowledge transfer effectiveness
 * @param {Object} transfer - Knowledge transfer record
 * @param {Object} outcome - Outcome data
 * @returns {Object} Effectiveness metrics
 */
export function trackTransferEffectiveness(transfer, outcome) {
  return {
    transferId: transfer.id,
    transferType: transfer.transferType,
    mentorId: transfer.from,
    menteeId: transfer.to,

    metrics: {
      completed: outcome.completed || false,
      timeSpent: outcome.timeSpent || 0,
      skillsGained: outcome.skillsGained || [],
      proficiencyIncrease: outcome.proficiencyIncrease || 0,
      applicationRate: outcome.applicationRate || 0, // % of times learned skill was applied
      retentionRate: outcome.retentionRate || 0,      // % retained after 7 days
      satisfactionScore: outcome.satisfactionScore || 0
    },

    feedback: {
      menteeComments: outcome.menteeComments || '',
      mentorComments: outcome.mentorComments || '',
      challenges: outcome.challenges || [],
      improvements: outcome.improvements || []
    },

    effectiveness: calculateEffectivenessScore(outcome)
  };
}

/**
 * Calculate effectiveness score for knowledge transfer
 * @param {Object} outcome - Transfer outcome
 * @returns {number} Effectiveness score (0-1)
 */
function calculateEffectivenessScore(outcome) {
  if (!outcome.completed) return 0;

  const factors = {
    proficiency: outcome.proficiencyIncrease || 0,
    application: outcome.applicationRate || 0,
    retention: outcome.retentionRate || 0,
    satisfaction: (outcome.satisfactionScore || 0) / 5 // Normalize to 0-1
  };

  const score =
    (factors.proficiency * 0.35) +
    (factors.application * 0.3) +
    (factors.retention * 0.2) +
    (factors.satisfaction * 0.15);

  return Math.max(0, Math.min(1, score));
}

/**
 * Generate knowledge transfer recommendations
 * Based on mentee's learning style and progress
 *
 * @param {Object} mentee - Mentee profile
 * @param {Array} transferHistory - Previous transfers
 * @returns {Array} Recommended transfer types
 */
export function recommendTransferTypes(mentee, transferHistory) {
  const recommendations = [];

  // Analyze past effectiveness
  const typeEffectiveness = {};
  transferHistory.forEach(transfer => {
    const type = transfer.transferType;
    if (!typeEffectiveness[type]) {
      typeEffectiveness[type] = { total: 0, sum: 0 };
    }
    typeEffectiveness[type].total++;
    typeEffectiveness[type].sum += transfer.effectiveness || 0;
  });

  // Calculate averages
  Object.keys(typeEffectiveness).forEach(type => {
    const avg = typeEffectiveness[type].sum / typeEffectiveness[type].total;
    recommendations.push({
      type,
      averageEffectiveness: avg,
      count: typeEffectiveness[type].total
    });
  });

  // Sort by effectiveness
  recommendations.sort((a, b) => b.averageEffectiveness - a.averageEffectiveness);

  // Add diversity recommendation
  const underutilizedTypes = Object.values(TransferType).filter(type =>
    !typeEffectiveness[type] || typeEffectiveness[type].total < 3
  );

  return {
    topPerforming: recommendations.slice(0, 3),
    underutilized: underutilizedTypes,
    recommendation: recommendations.length > 0
      ? `Focus on ${recommendations[0].type} (${(recommendations[0].averageEffectiveness * 100).toFixed(0)}% effectiveness)`
      : 'Try observation sessions to establish baseline'
  };
}

export default {
  TransferType,
  createKnowledgeTransfer,
  createObservationSession,
  createCoExecutionSession,
  createIndependentPractice,
  createPatternSharing,
  createErrorAnalysis,
  createFeedbackSession,
  createReflectionSession,
  createAssessmentSession,
  buildAcceleratedCurriculum,
  trackTransferEffectiveness,
  recommendTransferTypes
};
