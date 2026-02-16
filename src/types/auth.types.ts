/**
 * Authentication & Authorization Types
 * Type definitions for JWT, RBAC, and user management
 */

/**
 * User roles
 */
export type UserRole =
  | 'ADMIN'
  | 'ORCHESTRATOR'
  | 'AGENT'
  | 'MONITOR'
  | 'SERVICE';

/**
 * Permission types
 */
export type Permission =
  | 'READ'
  | 'WRITE'
  | 'DELETE'
  | 'EXECUTE'
  | 'ADMIN'
  | 'MONITOR'
  | string;

/**
 * Token type
 */
export type TokenType = 'access' | 'refresh' | 'bearer' | 'basic';

/**
 * JWT payload structure
 */
export interface ITokenPayload {
  agentId: string;
  agentType?: string;
  role: UserRole;
  permissions: Permission[];
  userId?: string;
  username?: string;
  email?: string;
  scopes?: string[];
  custom?: Record<string, unknown>;
}

/**
 * JWT token data (with metadata)
 */
export interface ITokenData {
  token: string;
  type: TokenType;
  agentId: string;
  issuedAt: number;
  expiresAt: number;
  expiresIn?: number;
  tokenId?: string;
}

/**
 * Token pair (access + refresh)
 */
export interface ITokenPair {
  access: {
    token: string;
    tokenId: string;
    expiresIn: string;
    type: 'access';
  };
  refresh: {
    token: string;
    tokenId: string;
    expiresIn: string;
    type: 'refresh';
  };
  issuedAt: string;
  rotated?: boolean;
}

/**
 * Token verification result
 */
export interface ITokenVerification {
  valid: boolean;
  decoded?: ITokenPayload & { jti?: string; iat?: number; exp?: number };
  tokenId?: string;
  error?: string;
  expired?: boolean;
  revoked?: boolean;
}

/**
 * Token refresh result
 */
export interface ITokenRefreshResult {
  access: {
    token: string;
    tokenId: string;
    expiresIn: string;
  };
  refresh?: {
    token: string;
    tokenId: string;
    expiresIn: string;
  };
  rotated: boolean;
}

/**
 * User object
 */
export interface IUser extends IEntity {
  username: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  permissions: Permission[];
  active: boolean;
  lastLogin?: Date;
  loginCount: number;
  metadata?: Record<string, unknown>;
}

/**
 * Agent user (extends IUser)
 */
export interface IAgentUser extends IUser {
  agentId: string;
  agentType: string;
  apiKey?: string;
  apiKeyHash?: string;
  capabilities?: string[];
}

/**
 * Base entity interface (imported)
 */
export interface IEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Credentials for authentication
 */
export interface ICredentials {
  username?: string;
  email?: string;
  password: string;
  apiKey?: string;
  token?: string;
}

/**
 * Authentication result
 */
export interface IAuthenticationResult {
  authenticated: boolean;
  user?: IUser;
  tokens?: ITokenPair;
  error?: string;
  timestamp: string;
}

/**
 * Authorization context
 */
export interface IAuthorizationContext {
  userId: string;
  userRole: UserRole;
  permissions: Permission[];
  scopes?: string[];
  agentId?: string;
  organizationId?: string;
}

/**
 * Permission check result
 */
export interface IPermissionCheckResult {
  granted: boolean;
  reason?: string;
  deniedBy?: string[];
}

/**
 * Role definition
 */
export interface IRoleDefinition {
  role: UserRole;
  permissions: Permission[];
  description: string;
  inherits?: UserRole[];
}

/**
 * RBAC manager interface
 */
export interface IRBACManager {
  hasPermission(user: IUser, permission: Permission): boolean;
  hasRole(user: IUser, role: UserRole): boolean;
  hasAnyPermission(user: IUser, permissions: Permission[]): boolean;
  hasAllPermissions(user: IUser, permissions: Permission[]): boolean;
  grantPermission(userId: string, permission: Permission): Promise<void>;
  revokePermission(userId: string, permission: Permission): Promise<void>;
  assignRole(userId: string, role: UserRole): Promise<void>;
}

/**
 * JWT handler interface
 */
export interface IJWTHandler {
  generateAccessToken(payload: ITokenPayload): ITokenData;
  generateRefreshToken(payload: ITokenPayload): ITokenData;
  generateTokenPair(agentData: unknown): ITokenPair;
  verifyAccessToken(token: string): ITokenVerification;
  verifyRefreshToken(token: string): ITokenVerification;
  refreshAccessToken(refreshToken: string): Promise<ITokenRefreshResult>;
  revokeToken(tokenId: string): void;
  revokeAgentTokens(agentId: string): void;
  decodeToken(token: string): unknown;
}

/**
 * Session data
 */
export interface ISession {
  sessionId: string;
  userId: string;
  agentId?: string;
  token: string;
  refreshToken?: string;
  createdAt: Date;
  expiresAt: Date;
  lastActivity: Date;
  ipAddress?: string;
  userAgent?: string;
  active: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Login attempt
 */
export interface ILoginAttempt {
  username: string;
  timestamp: Date;
  ipAddress?: string;
  success: boolean;
  reason?: string;
}

/**
 * Audit log entry for auth events
 */
export interface IAuthAuditLog {
  id: string;
  userId?: string;
  agentId?: string;
  action: string;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
  result: 'success' | 'failure';
  details?: Record<string, unknown>;
}

/**
 * API key data
 */
export interface IAPIKey {
  id: string;
  userId: string;
  keyHash: string;
  lastUsed?: Date;
  createdAt: Date;
  expiresAt?: Date;
  name: string;
  permissions: Permission[];
  active: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * OAuth configuration
 */
export interface IOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scopes: string[];
}

/**
 * OAuth token response
 */
export interface IOAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
}

/**
 * Two-factor authentication settings
 */
export interface I2FASettings {
  enabled: boolean;
  method: '2FA_EMAIL' | '2FA_SMS' | '2FA_AUTHENTICATOR' | 'NONE';
  secret?: string;
  backupCodes?: string[];
  verified: boolean;
}

/**
 * Password policy
 */
export interface IPasswordPolicy {
  minLength: number;
  maxLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  expirationDays?: number;
  historyCount?: number;
}

/**
 * Security headers
 */
export interface ISecurityHeaders {
  'x-content-type-options': string;
  'x-frame-options': string;
  'x-xss-protection': string;
  'strict-transport-security': string;
  'content-security-policy': string;
  'access-control-allow-origin': string;
}
