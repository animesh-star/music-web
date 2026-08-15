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

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Spotify Login Successful</title>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>
          body {
            background: #09090b;
            color: #ffffff;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
          }
          .card {
            text-align: center;
            padding: 24px;
          }
          .spinner {
            border: 3px solid rgba(255,255,255,0.1);
            width: 36px;
            height: 36px;
            border-radius: 50%;
            border-left-color: #1DB954;
            animation: spin 1s linear infinite;
            margin: 0 auto 16px;
          }
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="spinner"></div>
          <p>Login successful! Closing window...</p>
        </div>
        <script>
          try {
            localStorage.setItem("spotify_connected", "true");
            localStorage.setItem("spotify_refresh_token", "${refresh_token}");
            if (window.opener) {
              window.opener.postMessage("spotify_login_success", "*");
            }
          } catch (e) {
            console.error("Failed to notify parent window:", e);
          }
          setTimeout(() => {
            window.close();
          }, 600);
        </script>
      </body>
      </html>
    `;
    const response = new NextResponse(htmlContent, {
      headers: { "Content-Type": "text/html" },
    });

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
