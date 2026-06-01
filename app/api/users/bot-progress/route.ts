import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { connectToDatabase } from '@/lib/mongodb';
import User from '@/models/User';

// POST /api/users/bot-progress — updates stars for a given botId
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { botId, stars } = await req.json();

    if (!botId || typeof stars !== 'number' || stars < 0 || stars > 3) {
      return NextResponse.json({ error: 'Invalid body parameters' }, { status: 400 });
    }

    await connectToDatabase();

    const user = await User.findById(session.userId);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Initialize botProgress Map if not defined
    if (!user.botProgress) {
      user.botProgress = {};
    }

    const currentStars = user.botProgress instanceof Map
      ? (user.botProgress.get(botId) || 0)
      : (user.botProgress[botId] || 0);

    // Only update if the new stars are higher
    if (stars > currentStars) {
      if (user.botProgress instanceof Map) {
        user.botProgress.set(botId, stars);
      } else {
        user.botProgress[botId] = stars;
      }
      user.markModified('botProgress');
      await user.save();
    }

    return NextResponse.json({
      success: true,
      botProgress: user.botProgress
    });
  } catch (err: any) {
    console.error('Error updating bot progress:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
