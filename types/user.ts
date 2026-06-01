export interface UserRating {
  rapid: number;
  blitz: number;
  bullet: number;
  puzzle: number;
}

export interface UserStats {
  wins: number;
  losses: number;
  draws: number;
}

export interface User {
  _id: string;
  username: string;
  email: string;
  avatar?: string;
  country?: string;
  bio?: string;
  rating: UserRating;
  stats: UserStats;
  friends: string[];
  friendRequests: string[];
  gameHistory: string[];
  createdAt: string;
  lastSeen: string;
}

export interface SessionPayload {
  userId: string;
  username: string;
  email: string;
  expiresAt: Date;
}

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  rating: UserRating;
  stats: UserStats;
}
