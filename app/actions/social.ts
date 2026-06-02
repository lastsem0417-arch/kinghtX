'use server';

import { revalidatePath } from 'next/cache';
import { connectToDatabase } from '@/lib/mongodb';
import User from '@/models/User';
import { getSession } from '@/lib/session';

// ─── Send Friend Request ──────────────────────────────────────────────────────
export async function sendFriendRequest(usernameToRequest: string) {
  const session = await getSession();
  if (!session) return { error: 'Unauthorized' };

  await connectToDatabase();

  const targetUser = await User.findOne({
    username: { $regex: new RegExp(`^${usernameToRequest.trim()}$`, 'i') }
  });

  if (!targetUser) {
    return { error: 'User not found' };
  }

  if (targetUser._id.toString() === session.userId) {
    return { error: 'You cannot add yourself as a friend' };
  }

  const currentUser = await User.findById(session.userId);
  if (!currentUser) return { error: 'Current user not found' };

  // Check if already friends
  if (currentUser.friends.includes(targetUser._id as any)) {
    return { error: 'You are already friends with this user' };
  }

  // Check if request already sent (exist in target's requests)
  if (targetUser.friendRequests.includes(currentUser._id as any)) {
    return { error: 'Friend request already pending' };
  }

  // Send request (push current user's ID into target's requests)
  await User.findByIdAndUpdate(targetUser._id, {
    $addToSet: { friendRequests: currentUser._id }
  });

  revalidatePath('/dashboard');
  return { success: true };
}

// ─── Accept Friend Request ────────────────────────────────────────────────────
export async function acceptFriendRequest(senderId: string) {
  const session = await getSession();
  if (!session) return { error: 'Unauthorized' };

  await connectToDatabase();

  const currentUser = await User.findById(session.userId);
  if (!currentUser) return { error: 'User not found' };

  // Verify request exists
  const hasRequest = currentUser.friendRequests.some(id => id.toString() === senderId);
  if (!hasRequest) return { error: 'No friend request found from this user' };

  // Add to friends for both users, and remove request
  await User.findByIdAndUpdate(session.userId, {
    $addToSet: { friends: senderId },
    $pull: { friendRequests: senderId }
  });

  await User.findByIdAndUpdate(senderId, {
    $addToSet: { friends: session.userId }
  });

  revalidatePath('/dashboard');
  return { success: true };
}

// ─── Reject Friend Request ────────────────────────────────────────────────────
export async function rejectFriendRequest(senderId: string) {
  const session = await getSession();
  if (!session) return { error: 'Unauthorized' };

  await connectToDatabase();

  // Remove request from current user's list
  await User.findByIdAndUpdate(session.userId, {
    $pull: { friendRequests: senderId }
  });

  revalidatePath('/dashboard');
  return { success: true };
}

// ─── Search User Profile ──────────────────────────────────────────────────────
export async function searchUserProfile(usernameToSearch: string) {
  const session = await getSession();
  if (!session) return { error: 'Unauthorized' };

  await connectToDatabase();

  const targetUser = await User.findOne({
    username: { $regex: new RegExp(`^${usernameToSearch.trim()}$`, 'i') }
  });

  if (!targetUser) {
    return { error: 'User not found' };
  }

  const currentUserId = session.userId;
  let relationship: 'self' | 'friend' | 'incoming_request' | 'outgoing_request' | 'none' = 'none';

  if (targetUser._id.toString() === currentUserId) {
    relationship = 'self';
  } else {
    const currentUser = await User.findById(currentUserId);
    if (currentUser) {
      if (currentUser.friends.some(id => id.toString() === targetUser._id.toString())) {
        relationship = 'friend';
      } else if (currentUser.friendRequests.some(id => id.toString() === targetUser._id.toString())) {
        relationship = 'incoming_request';
      } else if (targetUser.friendRequests.some(id => id.toString() === currentUserId)) {
        relationship = 'outgoing_request';
      }
    }
  }

  return {
    success: true,
    user: {
      _id: targetUser._id.toString(),
      username: targetUser.username,
      avatar: targetUser.avatar,
      rating: {
        rapid: targetUser.rating?.rapid ?? 800,
        blitz: targetUser.rating?.blitz ?? 800,
        bullet: targetUser.rating?.bullet ?? 800,
        puzzle: targetUser.rating?.puzzle ?? 800,
      },
      stats: {
        wins: targetUser.stats?.wins ?? 0,
        losses: targetUser.stats?.losses ?? 0,
        draws: targetUser.stats?.draws ?? 0,
      },
      lastSeen: targetUser.lastSeen.toISOString(),
      relationship,
    }
  };
}
