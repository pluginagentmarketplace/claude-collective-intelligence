/**
 * Central export for all database repositories
 * Provides easy access to all data access layers
 */

export { AgentRepository, default as agentRepository } from './agent-repository.js';
export { TaskRepository, default as taskRepository } from './task-repository.js';
export { VotingRepository, default as votingRepository } from './voting-repository.js';
export { BrainstormRepository, default as brainstormRepository } from './brainstorm-repository.js';
export { GamificationRepository, default as gamificationRepository } from './gamification-repository.js';
export { ReputationRepository, default as reputationRepository } from './reputation-repository.js';
export { BattleRepository, default as battleRepository } from './battle-repository.js';
export { LeaderboardRepository, default as leaderboardRepository } from './leaderboard-repository.js';
export { MentorshipRepository, default as mentorshipRepository } from './mentorship-repository.js';
export { RewardsRepository, default as rewardsRepository } from './rewards-repository.js';
export { PenaltiesRepository, default as penaltiesRepository } from './penalties-repository.js';
