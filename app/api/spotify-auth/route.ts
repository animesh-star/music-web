import { NextResponse } from "next/server";
import SpotifyWebApi from "spotify-web-api-node";

// Configure Spotify API credentials
const clientId = process.env.SPOTIFY_CLIENT_ID || "";
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET || "";
const redirectUri =
  process.env.SPOTIFY_REDIRECT_URI ||
  "https://music-web-nine-bay.vercel.app/api/spotify-auth";

const spotifyApi = new SpotifyWebApi({
  clientId,
  clientSecret,
  redirectUri,
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  // If no authorization code is present, redirect to Spotify Auth login page
  if (!code) {
    const scopes = [
      "user-read-playback-state",
      "user-modify-playback-state",
      "user-read-currently-playing",
      "streaming",
      "app-remote-control",
      "playlist-read-private",
      "playlist-read-collaborative",
      "user-read-private",
      "user-read-email",
    ];
    // Generate Spotify authorization URL
    const authorizeURL = spotifyApi.createAuthorizeURL(scopes, "state-retro-music");
    return NextResponse.redirect(authorizeURL);
  }

  try {
    // Exchange the authorization code for Access & Refresh tokens
    const data = await spotifyApi.authorizationCodeGrant(code);
    const { access_token, refresh_token, expires_in } = data.body;

    // Redirect the user back to home directory
    const response = NextResponse.redirect(new URL("/", request.url));

    // Store tokens in cookies accessible by client-side JS
    response.cookies.set("spotify_access_token", access_token, {
      path: "/",
      maxAge: expires_in,
      httpOnly: false, // false so client-side components can read it
      sameSite: "lax",
      secure: true,
    });

    response.cookies.set("spotify_refresh_token", refresh_token, {
      path: "/",
      maxAge: 30 * 24 * 60 * 60, // 30 days
      httpOnly: false, // false so client-side components can read it
      sameSite: "lax",
      secure: true,
    });

    return response;
  } catch (error) {
    console.error("Error during Spotify authorization code grant:", error);
    return NextResponse.json(
      { error: "Failed to authorize with Spotify" },
      { status: 500 }
    );
  }
}
