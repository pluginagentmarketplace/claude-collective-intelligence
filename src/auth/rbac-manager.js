/**
 * RBAC Manager - Role-Based Access Control System
 * Manages roles, permissions, and access control for agents
 */

import crypto from 'crypto';

class RBACManager {
  constructor() {
    // Define system roles
    this.roles = new Map();
    this.permissions = new Map();
    this.roleHierarchy = new Map();

    // Initialize default roles and permissions
    this.initializeRoles();
    this.initializePermissions();
    this.initializeHierarchy();

    // Agent role assignments (in production, use database)
    this.agentRoles = new Map();

    // Resource-level permissions
    this.resourcePermissions = new Map();

    // Audit log for security tracking
    this.auditLog = [];
  }

  /**
   * Initialize system roles
   */
  initializeRoles() {
    // Admin - Full system access
    this.roles.set('admin', {
      name: 'Administrator',
      description: 'Full system access and control',
      permissions: [
        'system.*',
        'agent.*',
        'task.*',
        'brainstorm.*',
        'monitor.*',
        'config.*'
      ],
      priority: 100
    });

    // Team Leader - Orchestration and management
    this.roles.set('leader', {
      name: 'Team Leader',
      description: 'Task orchestration and team management',
      permissions: [
        'task.create',
        'task.assign',
        'task.monitor',
        'task.cancel',
        'brainstorm.initiate',
        'brainstorm.moderate',
        'agent.view',
        'agent.coordinate',
        'result.aggregate',
        'monitor.view'
      ],
      priority: 80
    });

    // Worker - Task execution
    this.roles.set('worker', {
      name: 'Worker Agent',
      description: 'Task execution and processing',
      permissions: [
        'task.receive',
        'task.execute',
        'task.report',
        'brainstorm.participate',
        'result.submit',
        'status.update'
      ],
      priority: 50
    });

    // Collaborator - Brainstorming and collaboration
    this.roles.set('collaborator', {
      name: 'Collaborator Agent',
      description: 'Collaboration and brainstorming specialist',
      permissions: [
        'brainstorm.participate',
        'brainstorm.contribute',
        'brainstorm.vote',
        'task.receive',
        'task.collaborate',
        'result.submit',
        'status.update'
      ],
      priority: 60
    });

    // Observer - Read-only monitoring
    this.roles.set('observer', {
      name: 'Observer',
      description: 'Read-only system monitoring',
      permissions: [
        'monitor.view',
        'status.view',
        'result.view',
        'agent.view'
      ],
      priority: 20
    });

    // Specialist - Domain-specific operations
    this.roles.set('specialist', {
      name: 'Specialist Agent',
      description: 'Domain-specific task execution',
      permissions: [
        'task.receive',
        'task.execute.specialist',
        'brainstorm.expert',
        'result.submit.expert',
        'knowledge.contribute'
      ],
      priority: 70
    });
  }

  /**
   * Initialize permission definitions
   */
  initializePermissions() {
    // System permissions
    this.permissions.set('system.*', {
      description: 'All system operations',
      resource: 'system',
      actions: ['*']
    });

    // Agent management
    this.permissions.set('agent.*', {
      description: 'All agent operations',
      resource: 'agent',
      actions: ['*']
    });

    this.permissions.set('agent.view', {
      description: 'View agent information',
      resource: 'agent',
      actions: ['read']
    });

    this.permissions.set('agent.coordinate', {
      description: 'Coordinate agent activities',
      resource: 'agent',
      actions: ['write', 'update']
    });

    // Task management
    this.permissions.set('task.*', {
      description: 'All task operations',
      resource: 'task',
      actions: ['*']
    });

    this.permissions.set('task.create', {
      description: 'Create new tasks',
      resource: 'task',
      actions: ['create']
    });

    this.permissions.set('task.assign', {
      description: 'Assign tasks to agents',
      resource: 'task',
      actions: ['update', 'assign']
    });

    this.permissions.set('task.receive', {
      description: 'Receive task assignments',
      resource: 'task',
      actions: ['read']
    });

    this.permissions.set('task.execute', {
      description: 'Execute assigned tasks',
      resource: 'task',
      actions: ['execute']
    });

    this.permissions.set('task.execute.specialist', {
      description: 'Execute specialist tasks',
      resource: 'task',
      actions: ['execute', 'specialist']
    });

    this.permissions.set('task.monitor', {
      description: 'Monitor task progress',
      resource: 'task',
      actions: ['read', 'monitor']
    });

    this.permissions.set('task.cancel', {
      description: 'Cancel running tasks',
      resource: 'task',
      actions: ['delete', 'cancel']
    });

    // Brainstorm permissions
    this.permissions.set('brainstorm.*', {
      description: 'All brainstorm operations',
      resource: 'brainstorm',
      actions: ['*']
    });

    this.permissions.set('brainstorm.initiate', {
      description: 'Start brainstorm sessions',
      resource: 'brainstorm',
      actions: ['create']
    });

    this.permissions.set('brainstorm.participate', {
      description: 'Participate in brainstorms',
      resource: 'brainstorm',
      actions: ['read', 'contribute']
    });

    this.permissions.set('brainstorm.moderate', {
      description: 'Moderate brainstorm sessions',
      resource: 'brainstorm',
      actions: ['update', 'moderate']
    });

    this.permissions.set('brainstorm.expert', {
      description: 'Expert brainstorm contributions',
      resource: 'brainstorm',
      actions: ['contribute', 'expert']
    });

    // Result and monitoring
    this.permissions.set('result.submit', {
      description: 'Submit task results',
      resource: 'result',
      actions: ['create']
    });

    this.permissions.set('result.aggregate', {
      description: 'Aggregate results',
      resource: 'result',
      actions: ['read', 'aggregate']
    });

    this.permissions.set('monitor.view', {
      description: 'View system monitoring',
      resource: 'monitor',
      actions: ['read']
    });

    this.permissions.set('status.update', {
      description: 'Update agent status',
      resource: 'status',
      actions: ['update']
    });
  }

  /**
   * Initialize role hierarchy
   */
  initializeHierarchy() {
    // Admin inherits all permissions
    this.roleHierarchy.set('admin', ['leader', 'specialist', 'collaborator', 'worker', 'observer']);

    // Leader inherits from workers and observers
    this.roleHierarchy.set('leader', ['worker', 'observer']);

    // Specialist inherits from worker
    this.roleHierarchy.set('specialist', ['worker']);

    // Collaborator inherits from observer
    this.roleHierarchy.set('collaborator', ['observer']);
  }

  /**
   * Assign role to agent
   * @param {string} agentId - Agent identifier
   * @param {string} roleName - Role to assign
   */
  assignRole(agentId, roleName) {
    if (!this.roles.has(roleName)) {
      throw new Error(`Unknown role: ${roleName}`);
    }

    const previousRole = this.agentRoles.get(agentId);
    this.agentRoles.set(agentId, roleName);

    // Audit log
    this.logAction({
      action: 'role_assigned',
      agentId,
      role: roleName,
      previousRole,
      timestamp: Date.now()
    });

    return {
      agentId,
      role: roleName,
      permissions: this.getEffectivePermissions(roleName)
    };
  }

  /**
   * Get agent's role
   * @param {string} agentId - Agent identifier
   */
  getAgentRole(agentId) {
    return this.agentRoles.get(agentId) || 'observer';
  }

  /**
   * Check if agent has permission
   * @param {string} agentId - Agent identifier
   * @param {string} permission - Permission to check
   * @param {Object} context - Additional context (resource ID, etc.)
   */
  hasPermission(agentId, permission, context = {}) {
    const role = this.getAgentRole(agentId);
    const permissions = this.getEffectivePermissions(role);

    // Check direct permission
    if (permissions.includes(permission)) {
      this.logAction({
        action: 'permission_granted',
        agentId,
        permission,
        role,
        context
      });
      return true;
    }

    // Check wildcard permissions
    const wildcardPerm = permission.split('.')[0] + '.*';
    if (permissions.includes(wildcardPerm)) {
      this.logAction({
        action: 'permission_granted',
        agentId,
        permission,
        role,
        context,
        wildcard: true
      });
      return true;
    }

    // Check resource-level permissions if context provided
    if (context.resourceId) {
      const hasResourcePerm = this.checkResourcePermission(
        agentId,
        permission,
        context.resourceId
      );

      if (hasResourcePerm) {
        this.logAction({
          action: 'permission_granted',
          agentId,
          permission,
          role,
          context,
          resourceLevel: true
        });
        return true;
      }
    }

    // Permission denied
    this.logAction({
      action: 'permission_denied',
      agentId,
      permission,
      role,
      context
    });

    return false;
  }

  /**
   * Get effective permissions for a role (including inherited)
   * @param {string} roleName - Role name
   */
  getEffectivePermissions(roleName) {
    if (!this.roles.has(roleName)) {
      return [];
    }

    const role = this.roles.get(roleName);
    let effectivePermissions = [...role.permissions];

    // Add inherited permissions
    const inheritedRoles = this.roleHierarchy.get(roleName) || [];
    for (const inheritedRole of inheritedRoles) {
      const inherited = this.roles.get(inheritedRole);
      if (inherited) {
        effectivePermissions.push(...inherited.permissions);
      }
    }

    // Remove duplicates
    return [...new Set(effectivePermissions)];
  }

  /**
   * Grant resource-specific permission
   * @param {string} agentId - Agent identifier
   * @param {string} resourceId - Resource identifier
   * @param {Array} permissions - Permissions to grant
   */
  grantResourcePermission(agentId, resourceId, permissions) {
    const key = `${agentId}:${resourceId}`;

    if (!this.resourcePermissions.has(key)) {
      this.resourcePermissions.set(key, new Set());
    }

    const resourcePerms = this.resourcePermissions.get(key);
    permissions.forEach(perm => resourcePerms.add(perm));

    this.logAction({
      action: 'resource_permission_granted',
      agentId,
      resourceId,
      permissions,
      timestamp: Date.now()
    });

    return {
      agentId,
      resourceId,
      permissions: Array.from(resourcePerms)
    };
  }

  /**
   * Revoke resource-specific permission
   * @param {string} agentId - Agent identifier
   * @param {string} resourceId - Resource identifier
   * @param {Array} permissions - Permissions to revoke
   */
  revokeResourcePermission(agentId, resourceId, permissions = null) {
    const key = `${agentId}:${resourceId}`;

    if (!this.resourcePermissions.has(key)) {
      return;
    }

    if (permissions === null) {
      // Revoke all permissions
      this.resourcePermissions.delete(key);
    } else {
      // Revoke specific permissions
      const resourcePerms = this.resourcePermissions.get(key);
      permissions.forEach(perm => resourcePerms.delete(perm));

      if (resourcePerms.size === 0) {
        this.resourcePermissions.delete(key);
      }
    }

    this.logAction({
      action: 'resource_permission_revoked',
      agentId,
      resourceId,
      permissions,
      timestamp: Date.now()
    });
  }

  /**
   * Check resource-specific permission
   * @param {string} agentId - Agent identifier
   * @param {string} permission - Permission to check
   * @param {string} resourceId - Resource identifier
   */
  checkResourcePermission(agentId, permission, resourceId) {
    const key = `${agentId}:${resourceId}`;

    if (!this.resourcePermissions.has(key)) {
      return false;
    }

    const resourcePerms = this.resourcePermissions.get(key);
    return resourcePerms.has(permission) || resourcePerms.has('*');
  }

  /**
   * Create access control decorator
   * @param {string|Array} requiredPermissions - Required permissions
   */
  requiresPermission(requiredPermissions) {
    const permissions = Array.isArray(requiredPermissions)
      ? requiredPermissions
      : [requiredPermissions];

    return (target, propertyKey, descriptor) => {
      const originalMethod = descriptor.value;

      descriptor.value = async function(...args) {
        // Extract agent context from first argument or this.agentId
        const agentId = args[0]?.agentId || this.agentId;

        if (!agentId) {
          throw new Error('Agent ID required for permission check');
        }

        // Check all required permissions
        for (const permission of permissions) {
          if (!this.rbacManager.hasPermission(agentId, permission, args[0]?.context)) {
            throw new Error(`Permission denied: ${permission} required`);
          }
        }

        // Execute original method
        return originalMethod.apply(this, args);
      };

      return descriptor;
    };
  }

  /**
   * Create role-based access control function
   * @param {string|Array} allowedRoles - Allowed roles
   */
  requiresRole(allowedRoles) {
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

    return (target, propertyKey, descriptor) => {
      const originalMethod = descriptor.value;

      descriptor.value = async function(...args) {
        const agentId = args[0]?.agentId || this.agentId;

        if (!agentId) {
          throw new Error('Agent ID required for role check');
        }

        const agentRole = this.rbacManager.getAgentRole(agentId);

        if (!roles.includes(agentRole)) {
          throw new Error(`Role ${agentRole} not allowed. Required roles: ${roles.join(', ')}`);
        }

        return originalMethod.apply(this, args);
      };

      return descriptor;
    };
  }

  /**
   * Log security action for audit
   * @param {Object} action - Action details
   */
  logAction(action) {
    this.auditLog.push({
      id: crypto.randomBytes(8).toString('hex'),
      ...action,
      timestamp: action.timestamp || Date.now()
    });

    // Keep audit log size manageable (in production, persist to database)
    if (this.auditLog.length > 10000) {
      this.auditLog = this.auditLog.slice(-5000);
    }
  }

  /**
   * Get audit log
   * @param {Object} filters - Filter options
   */
  getAuditLog(filters = {}) {
    let logs = [...this.auditLog];

    if (filters.agentId) {
      logs = logs.filter(log => log.agentId === filters.agentId);
    }

    if (filters.action) {
      logs = logs.filter(log => log.action === filters.action);
    }

    if (filters.startTime) {
      logs = logs.filter(log => log.timestamp >= filters.startTime);
    }

    if (filters.endTime) {
      logs = logs.filter(log => log.timestamp <= filters.endTime);
    }

    return logs;
  }

  /**
   * Get role statistics
   */
  getRoleStats() {
    const stats = {};

    for (const [roleName, role] of this.roles.entries()) {
      const agentsWithRole = Array.from(this.agentRoles.values())
        .filter(r => r === roleName).length;

      stats[roleName] = {
        name: role.name,
        priority: role.priority,
        permissionCount: role.permissions.length,
        agentCount: agentsWithRole
      };
    }

    return stats;
  }

  /**
   * Export role configuration
   */
  exportConfiguration() {
    return {
      roles: Array.from(this.roles.entries()),
      permissions: Array.from(this.permissions.entries()),
      hierarchy: Array.from(this.roleHierarchy.entries())
    };
  }
}

// Export singleton instance
export default new RBACManager();

// Also export class for testing
export { RBACManager };