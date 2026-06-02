import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import Chat from '@/models/Chat';
import { getSession } from '@/lib/session';
import mongoose from 'mongoose';

interface Params {
  params: Promise<{ friendId: string }>;
}

// GET /api/chats/[friendId] — Get message history with a friend
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { friendId } = await params;
    if (!mongoose.Types.ObjectId.isValid(friendId)) {
      return NextResponse.json({ error: 'Invalid friend ID' }, { status: 400 });
    }

    await connectToDatabase();

    // Find the chat containing exactly these two participants
    const chat = await Chat.findOne({
      participants: { 
        $all: [
          new mongoose.Types.ObjectId(session.userId),
          new mongoose.Types.ObjectId(friendId)
        ] 
      }
    });

    if (!chat) {
      return NextResponse.json({ messages: [] });
    }

    return NextResponse.json({ messages: chat.messages });
  } catch (err: any) {
    console.error('Error fetching chat history:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/chats/[friendId] — Send a direct message to a friend
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { friendId } = await params;
    if (!mongoose.Types.ObjectId.isValid(friendId)) {
      return NextResponse.json({ error: 'Invalid friend ID' }, { status: 400 });
    }

    const body = await req.json();
    const { text } = body;

    if (!text || typeof text !== 'string' || text.trim() === '') {
      return NextResponse.json({ error: 'Message content cannot be empty' }, { status: 400 });
    }

    await connectToDatabase();

    const currentUserId = new mongoose.Types.ObjectId(session.userId);
    const targetUserId = new mongoose.Types.ObjectId(friendId);

    // Find existing chat or create a new one
    let chat = await Chat.findOne({
      participants: { $all: [currentUserId, targetUserId] }
    });

    if (!chat) {
      chat = new Chat({
        participants: [currentUserId, targetUserId],
        messages: []
      });
    }

    const newMessage = {
      sender: currentUserId,
      text: text.trim(),
      createdAt: new Date()
    };

    chat.messages.push(newMessage);
    await chat.save();

    return NextResponse.json({ success: true, message: newMessage });
  } catch (err: any) {
    console.error('Error saving chat message:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
