import { NextResponse } from "next/server"

// Force this route to be treated as static/cacheable
export const dynamic = "force-static"
export const revalidate = 604800 // 7 days in seconds

export async function GET() {
  try {
    const response = await fetch("https://api.steampowered.com/ISteamApps/GetAppList/v2/", {
      // Add cache headers to the upstream request as well
      headers: {
        "User-Agent": "Steam Price Checker Tool",
      },
    })

    if (!response.ok) {
      throw new Error(`Steam API responded with status: ${response.status}`)
    }

    const data = await response.json()

    // Return with aggressive caching headers that meet Vercel's criteria
    return NextResponse.json(data, {
      status: 200,
      headers: {
        // Public cache for 7 days, browser cache for 1 day
        "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
        // Additional Vercel-specific cache headers
        "CDN-Cache-Control": "public, max-age=604800",
        "Vercel-CDN-Cache-Control": "public, max-age=604800",
      },
    })
  } catch (error) {
    console.error("Error fetching Steam apps:", error)

    // Return error with no-cache to avoid caching errors
    return NextResponse.json(
      { error: "Failed to fetch Steam app list" },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      },
    )
  }
}
