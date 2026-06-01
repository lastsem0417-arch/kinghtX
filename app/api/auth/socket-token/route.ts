import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

// GET /api/auth/socket-token
// Retrieves the current knightx_session token to pass to the Socket.io client
export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('knightx_session')?.value || null;
    return NextResponse.json({ token });
  } catch (err) {
    return NextResponse.json({ token: null }, { status: 500 });
  }
}
