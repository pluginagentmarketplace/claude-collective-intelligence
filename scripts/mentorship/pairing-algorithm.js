#!/usr/bin/env node
/**
 * Mentor-Mentee Pairing Algorithm
 * Intelligently matches mentors with mentees based on:
 * - Skill gap (mentor ≥ 2 levels above mentee)
 * - Availability (max 3 mentees per mentor)
 * - Specialization match (Jaccard similarity)
 * - Historical success rate
 */

/**
 * Find best mentor for a mentee
 * @param {Object} mentee - Mentee profile
 * @param {Array} allProfiles - All agent profiles
 * @param {Object} curriculum - Training curriculum
 * @returns {Object|null} Best mentor match or null
 */
export function findBestMentor(mentee, allProfiles, curriculum) {
  const candidates = allProfiles.filter(agent =>
    agent.currentLevel >= mentee.currentLevel + 2 && // 2 levels ahead minimum
    agent.mentees.length < 3 && // Max 3 mentees
    agent.agentId !== mentee.agentId // Not self
  );

  if (candidates.length === 0) {
    return null;
  }

  // Calculate pairing scores for all candidates
  const scoredCandidates = candidates.map(mentor => {
    const score = calculatePairingScore(mentor, mentee, curriculum);
    return { mentor, score };
  });

  // Sort by score (highest first)
  scoredCandidates.sort((a, b) => b.score - a.score);

  return scoredCandidates[0].mentor;
}

/**
 * Calculate pairing score based on multiple factors
 * PairingScore = (SkillGap × 0.4) + (Availability × 0.3) +
 *                (SpecializationMatch × 0.2) + (HistoricalSuccess × 0.1)
 *
 * @param {Object} mentor - Mentor profile
 * @param {Object} mentee - Mentee profile
 * @param {Object} curriculum - Training curriculum
 * @returns {number} Pairing score (0-1)
 */
export function calculatePairingScore(mentor, mentee, curriculum) {
  const skillGap = calculateSkillGapScore(mentor.currentLevel, mentee.currentLevel);
  const availability = calculateAvailabilityScore(mentor.mentees.length);
  const specializationMatch = calculateSpecializationMatch(mentor, mentee, curriculum);
  const historicalSuccess = calculateHistoricalSuccessRate(mentor, mentee);

  const score =
    (skillGap * 0.4) +
    (availability * 0.3) +
    (specializationMatch * 0.2) +
    (historicalSuccess * 0.1);

  return Math.max(0, Math.min(1, score)); // Clamp to [0, 1]
}

/**
 * Calculate skill gap score
 * Optimal gap is 2-3 levels. Too much gap = less effective mentorship
 *
 * @param {number} mentorLevel - Mentor's current level
 * @param {number} menteeLevel - Mentee's current level
 * @returns {number} Skill gap score (0-1)
 */
export function calculateSkillGapScore(mentorLevel, menteeLevel) {
  const gap = mentorLevel - menteeLevel;

  if (gap < 2) return 0; // Too close, not qualified
  if (gap === 2) return 1.0; // Ideal - close enough to relate
  if (gap === 3) return 0.9; // Very good
  if (gap === 4) return 0.7; // Good but may be too advanced
  return 0.5; // Large gap, may struggle to relate
}

/**
 * Calculate availability score
 * Fewer mentees = more availability
 *
 * @param {number} currentMentees - Number of current mentees
 * @returns {number} Availability score (0-1)
 */
export function calculateAvailabilityScore(currentMentees) {
  const maxMentees = 3;

  if (currentMentees >= maxMentees) return 0;

  return (maxMentees - currentMentees) / maxMentees;
}

/**
 * Calculate specialization match using Jaccard similarity
 * Compares mentor's strong skills with target skills for next level
 *
 * @param {Object} mentor - Mentor profile
 * @param {Object} mentee - Mentee profile
 * @param {Object} curriculum - Training curriculum
 * @returns {number} Specialization match score (0-1)
 */
export function calculateSpecializationMatch(mentor, mentee, curriculum) {
  // Get mentor's strong skills (proficiency > 0.7)
  const mentorSkills = new Set(
    Object.keys(mentor.skillProficiency || {})
      .filter(skill => mentor.skillProficiency[skill] > 0.7)
  );

  // Get target skills for mentee's next level
  const nextLevel = mentee.currentLevel + 1;
  const targetSkills = new Set(curriculum[nextLevel]?.skills || []);

  if (mentorSkills.size === 0 || targetSkills.size === 0) {
    return 0.5; // Neutral if no skill data
  }

  // Calculate Jaccard similarity: |intersection| / |union|
  const intersection = new Set(
    [...mentorSkills].filter(skill => targetSkills.has(skill))
  );
  const union = new Set([...mentorSkills, ...targetSkills]);

  return union.size > 0 ? intersection.size / union.size : 0;
}

/**
 * Calculate mentor's historical success rate
 * Based on percentage of mentees who successfully graduated
 *
 * @param {Object} mentor - Mentor profile
 * @param {Object} mentee - Mentee profile (for future contextual matching)
 * @returns {number} Historical success rate (0-1)
 */
export function calculateHistoricalSuccessRate(mentor, mentee) {
  // Get mentor stats if available
  const mentorStats = mentor.mentorStats || {
    totalMentees: 0,
    graduatedMentees: 0,
    averageTrainingTime: 0
  };

  if (mentorStats.totalMentees === 0) {
    return 0.5; // Default for new mentors
  }

  const successRate = mentorStats.graduatedMentees / mentorStats.totalMentees;

  // Bonus for fast training times (< 4 days)
  let bonus = 0;
  if (mentorStats.averageTrainingTime > 0 && mentorStats.averageTrainingTime <= 4) {
    bonus = 0.1;
  }

  return Math.min(1.0, successRate + bonus);
}

/**
 * Find multiple mentor candidates (for choice/backup)
 * @param {Object} mentee - Mentee profile
 * @param {Array} allProfiles - All agent profiles
 * @param {Object} curriculum - Training curriculum
 * @param {number} count - Number of candidates to return
 * @returns {Array} Top N mentor candidates
 */
export function findTopMentorCandidates(mentee, allProfiles, curriculum, count = 3) {
  const candidates = allProfiles.filter(agent =>
    agent.currentLevel >= mentee.currentLevel + 2 &&
    agent.mentees.length < 3 &&
    agent.agentId !== mentee.agentId
  );

  if (candidates.length === 0) {
    return [];
  }

  const scoredCandidates = candidates.map(mentor => {
    const score = calculatePairingScore(mentor, mentee, curriculum);
    return {
      mentor,
      score,
      breakdown: {
        skillGap: calculateSkillGapScore(mentor.currentLevel, mentee.currentLevel),
        availability: calculateAvailabilityScore(mentor.mentees.length),
        specialization: calculateSpecializationMatch(mentor, mentee, curriculum),
        historicalSuccess: calculateHistoricalSuccessRate(mentor, mentee)
      }
    };
  });

  scoredCandidates.sort((a, b) => b.score - a.score);

  return scoredCandidates.slice(0, count);
}

/**
 * Validate pairing compatibility
 * Ensures minimum requirements are met before pairing
 *
 * @param {Object} mentor - Mentor profile
 * @param {Object} mentee - Mentee profile
 * @returns {Object} Validation result with isValid flag and reasons
 */
export function validatePairing(mentor, mentee) {
  const issues = [];

  // Check level gap
  const levelGap = mentor.currentLevel - mentee.currentLevel;
  if (levelGap < 2) {
    issues.push('Mentor must be at least 2 levels above mentee');
  }

  // Check mentor capacity
  if (mentor.mentees.length >= 3) {
    issues.push('Mentor has reached maximum capacity (3 mentees)');
  }

  // Check mentor availability
  if (mentor.status === 'inactive' || mentor.status === 'suspended') {
    issues.push('Mentor is not currently active');
  }

  // Check for self-pairing
  if (mentor.agentId === mentee.agentId) {
    issues.push('Agent cannot mentor themselves');
  }

  // Check if mentee already has a mentor
  if (mentee.mentorId && mentee.mentorId !== mentor.agentId) {
    issues.push('Mentee already has an active mentor');
  }

  return {
    isValid: issues.length === 0,
    issues,
    recommendation: issues.length === 0 ? 'Pairing approved' : 'Pairing not recommended'
  };
}

/**
 * Calculate workload balance across all mentors
 * Helps identify overloaded or underutilized mentors
 *
 * @param {Array} allProfiles - All agent profiles
 * @returns {Object} Workload statistics
 */
export function calculateMentorWorkload(allProfiles) {
  const mentors = allProfiles.filter(agent => agent.currentLevel >= 3);

  if (mentors.length === 0) {
    return {
      totalMentors: 0,
      averageMentees: 0,
      maxMentees: 0,
      minMentees: 0,
      utilizationRate: 0
    };
  }

  const menteeCounts = mentors.map(m => m.mentees.length);
  const totalMentees = menteeCounts.reduce((sum, count) => sum + count, 0);

  return {
    totalMentors: mentors.length,
    averageMentees: totalMentees / mentors.length,
    maxMentees: Math.max(...menteeCounts),
    minMentees: Math.min(...menteeCounts),
    utilizationRate: totalMentees / (mentors.length * 3), // % of total capacity
    distribution: {
      idle: mentors.filter(m => m.mentees.length === 0).length,
      light: mentors.filter(m => m.mentees.length === 1).length,
      moderate: mentors.filter(m => m.mentees.length === 2).length,
      full: mentors.filter(m => m.mentees.length === 3).length
    }
  };
}

export default {
  findBestMentor,
  calculatePairingScore,
  calculateSkillGapScore,
  calculateAvailabilityScore,
  calculateSpecializationMatch,
  calculateHistoricalSuccessRate,
  findTopMentorCandidates,
  validatePairing,
  calculateMentorWorkload
};
