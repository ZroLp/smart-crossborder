import { NextRequest, NextResponse } from 'next/server';
import { generateState } from '@/lib/shopify/oauth-state';

const SHOPIFY_SCOPES = [
  'read_products',
  'write_products',
  'read_orders',
  'write_orders',
  'read_inventory',
  'write_inventory',
  'read_analytics',
].join(',');

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Missing userId' },
        { status: 400 }
      );
    }

    const apiKey = process.env.SHOPIFY_API_KEY;
    const redirectUri = process.env.SHOPIFY_REDIRECT_URI;

    if (!apiKey || !redirectUri) {
      return NextResponse.json(
        { success: false, error: 'Shopify API configuration missing' },
        { status: 500 }
      );
    }

    const state = generateState(Number(userId));

    const authUrl = new URL('https://accounts.shopify.com/authorize');
    authUrl.searchParams.set('client_id', apiKey);
    authUrl.searchParams.set('scope', SHOPIFY_SCOPES);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('state', state);

    return NextResponse.json({ success: true, url: authUrl.toString() });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
