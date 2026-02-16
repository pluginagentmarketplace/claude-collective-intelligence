/**
 * Permission Manager - Handles tier-based permissions and upgrades
 * Implements dynamic privilege escalation based on performance
 */

import { EventEmitter } from 'events';

// Permission tier definitions
export const PERMISSION_TIERS = {
  BRONZE: {
    level: 1,
    requiredPoints: 0,
    capabilities: [
      'task.consume',
      'result.publish',
      'status.publish'
    ],
    apiAccess: {
      brainstorm: false,
      workflow: false,
      adminCommands: false
    },
    queueAccess: ['agent.tasks', 'agent.results'],
    label: 'Bronze Agent',
    color: '#CD7F32'
  },
  SILVER: {
    level: 2,
    requiredPoints: 1000,
    capabilities: [
      'task.consume',
      'task.prioritize',
      'result.publish',
      'status.publish',
      'brainstorm.participate'
    ],
    apiAccess: {
      brainstorm: true,
      workflow: false,
      adminCommands: false
    },
    queueAccess: ['agent.tasks', 'agent.results', 'agent.brainstorm'],
    label: 'Silver Agent',
    color: '#C0C0C0'
  },
  GOLD: {
    level: 3,
    requiredPoints: 5000,
    capabilities: [
      'task.consume',
      'task.assign',
      'task.prioritize',
      'result.publish',
      'result.aggregate',
      'status.publish',
      'brainstorm.initiate',
      'workflow.create'
    ],
    apiAccess: {
      brainstorm: true,
      workflow: true,
      adminCommands: false
    },
    queueAccess: ['agent.tasks', 'agent.results', 'agent.brainstorm', 'agent.workflows'],
    specialAbilities: ['delegateTasks', 'createSubTeams'],
    label: 'Gold Agent',
    color: '#FFD700'
  },
  PLATINUM: {
    level: 4,
    requiredPoints: 15000,
    capabilities: [
      'task.*',
      'result.*',
      'status.*',
      'brainstorm.*',
      'workflow.*',
      'agent.manage'
    ],
    apiAccess: {
      brainstorm: true,
      workflow: true,
      adminCommands: true
    },
    queueAccess: ['*'],
    specialAbilities: [
      'delegateTasks',
      'createSubTeams',
      'modifyPriorities',
      'accessMetrics',
      'manageAgents'
    ],
    label: 'Platinum Agent',
    color: '#E5E4E2'
  },
  DIAMOND: {
    level: 5,
    requiredPoints: 50000,
    capabilities: ['*'],
    apiAccess: {
      brainstorm: true,
      workflow: true,
      adminCommands: true,
      systemConfig: true
    },
    queueAccess: ['*'],
    specialAbilities: [
      'fullSystemAccess',
      'createCustomRewards',
      'modifyRewardRules',
      'accessAllMetrics',
      'emergencyOverride'
    ],
    label: 'Diamond Agent',
    color: '#B9F2FF',
    exclusive: true
  }
};

// Unlock criteria for each tier
export const UNLOCK_CRITERIA = {
  SILVER: {
    minTasksCompleted: 50,
    minSuccessRate: 0.80,
    minBrainstormsParticipated: 5,
    minUptime: 3600000,  // 1 hour
    requiredAchievements: ['first_task', 'team_player']
  },
  GOLD: {
    minTasksCompleted: 200,
    minSuccessRate: 0.85,
    minBrainstormsParticipated: 20,
    minBrainstormsInitiated: 5,
    minUptime: 14400000,  // 4 hours
    requiredAchievements: ['reliable_agent', 'collaborator', 'speed_demon']
  },
  PLATINUM: {
    minTasksCompleted: 1000,
    minSuccessRate: 0.90,
    minBrainstormsParticipated: 100,
    minBrainstormsInitiated: 25,
    minUptime: 86400000,  // 24 hours
    minAgentsHelped: 10,
    requiredAchievements: ['master_agent', 'mentor', 'perfectionist', 'marathon_runner']
  },
  DIAMOND: {
    minTasksCompleted: 5000,
    minSuccessRate: 0.95,
    minBrainstormsParticipated: 500,
    minBrainstormsInitiated: 100,
    minUptime: 604800000,  // 7 days
    minAgentsHelped: 50,
    specialRequirement: 'nominatedByAdminOrCommunity',
    requiredAchievements: ['legendary', 'visionary', 'guardian', 'architect']
  }
};

/**
 * Permission Manager Class
 */
export class PermissionManager extends EventEmitter {
  constructor() {
    super();
    this.agentPermissions = new Map();
    this.agentAchievements = new Map();
    this.temporaryElevations = new Map();
  }

  /**
   * Initialize agent with Bronze tier
   */
  initializeAgent(agentId) {
    if (this.agentPermissions.has(agentId)) {
      return this.agentPermissions.get(agentId);
    }

    const permissions = {
      tier: 'BRONZE',
      level: 1,
      points: 0,
      capabilities: [...PERMISSION_TIERS.BRONZE.capabilities],
      apiAccess: { ...PERMISSION_TIERS.BRONZE.apiAccess },
      queueAccess: [...PERMISSION_TIERS.BRONZE.queueAccess],
      specialAbilities: [],
      achievedAt: Date.now()
    };

    this.agentPermissions.set(agentId, permissions);
    this.agentAchievements.set(agentId, []);

    this.emit('agent_initialized', { agentId, tier: 'BRONZE' });

    return permissions;
  }

  /**
   * Check if agent has specific permission
   */
  hasPermission(agentId, capability) {
    const permissions = this.agentPermissions.get(agentId);
    if (!permissions) return false;

    // Check temporary elevations first
    if (this.hasTemporaryElevation(agentId, capability)) {
      return true;
    }

    // Wildcard check
    if (permissions.capabilities.includes('*')) return true;

    // Exact match
    if (permissions.capabilities.includes(capability)) return true;

    // Prefix match (e.g., 'task.*' matches 'task.consume')
    return permissions.capabilities.some(cap => {
      if (cap.endsWith('.*')) {
        const prefix = cap.slice(0, -2);
        return capability.startsWith(prefix + '.');
      }
      return false;
    });
  }

  /**
   * Get agent's current tier
   */
  getAgentTier(agentId) {
    const permissions = this.agentPermissions.get(agentId);
    return permissions ? permissions.tier : 'BRONZE';
  }

  /**
   * Get agent's current points
   */
  getAgentPoints(agentId) {
    const permissions = this.agentPermissions.get(agentId);
    return permissions ? permissions.points : 0;
  }

  /**
   * Award points to agent
   */
  async awardPoints(agentId, points, reason = 'task_completion') {
    const permissions = this.agentPermissions.get(agentId);
    if (!permissions) {
      this.initializeAgent(agentId);
      return this.awardPoints(agentId, points, reason);
    }

    permissions.points += points;

    this.emit('points_awarded', {
      agentId,
      points,
      reason,
      totalPoints: permissions.points
    });

    return permissions.points;
  }

  /**
   * Check if agent meets requirements for achievements
   */
  hasRequiredAchievements(agentId, requiredAchievements = []) {
    if (!requiredAchievements || requiredAchievements.length === 0) {
      return true;
    }

    const agentAchievements = this.agentAchievements.get(agentId) || [];
    return requiredAchievements.every(req => agentAchievements.includes(req));
  }

  /**
   * Award achievement to agent
   */
  async awardAchievement(agentId, achievementId) {
    const achievements = this.agentAchievements.get(agentId) || [];

    if (achievements.includes(achievementId)) {
      return { success: false, reason: 'already_unlocked' };
    }

    achievements.push(achievementId);
    this.agentAchievements.set(agentId, achievements);

    this.emit('achievement_unlocked', {
      agentId,
      achievementId,
      timestamp: Date.now()
    });

    return { success: true };
  }

  /**
   * Check and upgrade tier if criteria met
   */
  async checkTierUpgrade(agentId, metrics) {
    const currentPermissions = this.agentPermissions.get(agentId);
    if (!currentPermissions) return null;

    const currentTier = currentPermissions.tier;
    const tierHierarchy = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND'];
    const currentIndex = tierHierarchy.indexOf(currentTier);

    // Check if already at max tier
    if (currentIndex >= tierHierarchy.length - 1) return null;

    const nextTier = tierHierarchy[currentIndex + 1];
    const criteria = UNLOCK_CRITERIA[nextTier];

    // Check all criteria
    const meetsRequirements =
      metrics.tasksCompleted >= (criteria.minTasksCompleted || 0) &&
      metrics.successRate >= (criteria.minSuccessRate || 0) &&
      (metrics.brainstormsParticipated || 0) >= (criteria.minBrainstormsParticipated || 0) &&
      (metrics.brainstormsInitiated || 0) >= (criteria.minBrainstormsInitiated || 0) &&
      (metrics.uptime || 0) >= (criteria.minUptime || 0) &&
      (metrics.agentsHelped || 0) >= (criteria.minAgentsHelped || 0) &&
      currentPermissions.points >= PERMISSION_TIERS[nextTier].requiredPoints &&
      this.hasRequiredAchievements(agentId, criteria.requiredAchievements);

    if (meetsRequirements) {
      return await this.upgradeTier(agentId, nextTier);
    }

    return null;
  }

  /**
   * Upgrade agent to new tier
   */
  async upgradeTier(agentId, newTier) {
    const permissions = this.agentPermissions.get(agentId);
    if (!permissions) {
      throw new Error('Agent not initialized');
    }

    const oldTier = permissions.tier;
    const newTierConfig = PERMISSION_TIERS[newTier];

    permissions.tier = newTier;
    permissions.level = newTierConfig.level;
    permissions.capabilities = [...newTierConfig.capabilities];
    permissions.apiAccess = { ...newTierConfig.apiAccess };
    permissions.queueAccess = [...newTierConfig.queueAccess];
    permissions.specialAbilities = [...(newTierConfig.specialAbilities || [])];
    permissions.upgradedAt = Date.now();

    // Award bonus points
    const bonusPoints = newTierConfig.level * 1000;
    permissions.points += bonusPoints;

    this.emit('tier_upgraded', {
      agentId,
      oldTier,
      newTier,
      bonusPoints,
      newCapabilities: newTierConfig.capabilities
    });

    return {
      success: true,
      oldTier,
      newTier,
      bonusPoints,
      newCapabilities: newTierConfig.capabilities
    };
  }

  /**
   * Grant temporary privilege elevation
   */
  async grantTemporaryElevation(agentId, privilege, duration, reason) {
    const elevation = {
      agentId,
      privilege,
      grantedAt: Date.now(),
      expiresAt: Date.now() + duration,
      reason,
      revokeOnComplete: true
    };

    const agentElevations = this.temporaryElevations.get(agentId) || [];
    agentElevations.push(elevation);
    this.temporaryElevations.set(agentId, agentElevations);

    this.emit('privilege_elevated', {
      agentId,
      privilege,
      duration,
      reason
    });

    // Auto-revoke after duration
    setTimeout(() => {
      this.revokeElevation(agentId, privilege);
    }, duration);

    return elevation;
  }

  /**
   * Check if agent has temporary elevation
   */
  hasTemporaryElevation(agentId, privilege) {
    const elevations = this.temporaryElevations.get(agentId) || [];
    const now = Date.now();

    return elevations.some(elevation =>
      elevation.privilege === privilege &&
      elevation.expiresAt > now
    );
  }

  /**
   * Revoke privilege elevation
   */
  revokeElevation(agentId, privilege) {
    const elevations = this.temporaryElevations.get(agentId) || [];
    const filtered = elevations.filter(e =>
      e.privilege !== privilege || e.expiresAt <= Date.now()
    );
    this.temporaryElevations.set(agentId, filtered);

    this.emit('privilege_revoked', { agentId, privilege });
  }

  /**
   * Get agent's full permission details
   */
  getAgentPermissions(agentId) {
    return this.agentPermissions.get(agentId) || null;
  }

  /**
   * Get all agents by tier
   */
  getAgentsByTier(tier) {
    const agents = [];
    for (const [agentId, permissions] of this.agentPermissions) {
      if (permissions.tier === tier) {
        agents.push(agentId);
      }
    }
    return agents;
  }

  /**
   * Get tier statistics
   */
  getTierStats() {
    const stats = {
      BRONZE: 0,
      SILVER: 0,
      GOLD: 0,
      PLATINUM: 0,
      DIAMOND: 0
    };

    for (const permissions of this.agentPermissions.values()) {
      stats[permissions.tier]++;
    }

    return stats;
  }
}

export default PermissionManager;
