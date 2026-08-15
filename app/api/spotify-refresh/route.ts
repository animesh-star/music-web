import { NextResponse } from "next/server";
import SpotifyWebApi from "spotify-web-api-node";

const clientId = process.env.SPOTIFY_CLIENT_ID || "";
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET || "";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const refreshTokenParam = searchParams.get("refresh_token");

  if (!refreshTokenParam) {
    return NextResponse.json({ error: "Missing refresh_token" }, { status: 400 });
  }

  try {
    const spotifyApi = new SpotifyWebApi({
      clientId,
      clientSecret,
      refreshToken: refreshTokenParam,
    });

    const data = await spotifyApi.refreshAccessToken();
    const { access_token, expires_in } = data.body;

    const response = NextResponse.json({ access_token, expires_in });

    response.cookies.set("spotify_access_token", access_token, {
      path: "/",
      maxAge: expires_in || 3600,
      httpOnly: false,
      sameSite: "lax",
      secure: true,
    });

    return response;
  } catch (error) {
    console.error("Error refreshing Spotify access token:", error);
    return NextResponse.json({ error: "Refresh failed" }, { status: 500 });
  }
}
