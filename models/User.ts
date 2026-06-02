import mongoose, { Schema, Document, Model } from 'mongoose';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface IUser extends Document {
  username: string;
  email: string;
  passwordHash: string;
  avatar: string;
  country: string;
  bio: string;
  rating: {
    rapid: number;
    blitz: number;
    bullet: number;
    puzzle: number;
  };
  stats: {
    wins: number;
    losses: number;
    draws: number;
  };
  friends: mongoose.Types.ObjectId[];
  friendRequests: mongoose.Types.ObjectId[];
  gameHistory: mongoose.Types.ObjectId[];
  botProgress?: Record<string, number>;
  createdAt: Date;
  lastSeen: Date;
  resetToken?: string | null;
  resetTokenExpires?: Date | null;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const UserSchema = new Schema<IUser>(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 20,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    avatar: {
      type: String,
      default: '',
    },
    country: {
      type: String,
      default: '',
    },
    bio: {
      type: String,
      default: '',
      maxlength: 200,
    },
    rating: {
      rapid: { type: Number, default: 800 },
      blitz: { type: Number, default: 800 },
      bullet: { type: Number, default: 800 },
      puzzle: { type: Number, default: 800 },
    },
    stats: {
      wins: { type: Number, default: 0 },
      losses: { type: Number, default: 0 },
      draws: { type: Number, default: 0 },
    },
    friends: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    friendRequests: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    gameHistory: [{ type: Schema.Types.ObjectId, ref: 'Game' }],
    botProgress: {
      type: Map,
      of: Number,
      default: {},
    },
    lastSeen: { type: Date, default: Date.now },
    resetToken: { type: String, default: null },
    resetTokenExpires: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

UserSchema.index({ username: 1 });
UserSchema.index({ email: 1 });
UserSchema.index({ 'rating.rapid': -1 });
UserSchema.index({ 'rating.blitz': -1 });
UserSchema.index({ 'rating.bullet': -1 });

// ─── Model ────────────────────────────────────────────────────────────────────

const User: Model<IUser> =
  mongoose.models.User ?? mongoose.model<IUser>('User', UserSchema);

export default User;
