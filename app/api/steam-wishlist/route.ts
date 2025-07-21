import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const steamId = searchParams.get("steamid")

  if (!steamId) {
    return NextResponse.json({ error: "Missing steamid parameter" }, { status: 400 })
  }

  try {
    const response = await fetch(`https://api.steampowered.com/IWishlistService/GetWishlist/v1?steamid=${steamId}`, {
      headers: {
        "User-Agent": "Steam Wishlist Checker Tool",
      },
    })

    if (!response.ok) {
      throw new Error(`Steam API responded with status: ${response.status}`)
    }

    const data = await response.json()

    // Don't cache wishlist data as it changes frequently
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    })
  } catch (error) {
    console.error("Error fetching Steam wishlist:", error)
    return NextResponse.json({ error: "Failed to fetch Steam wishlist" }, { status: 500 })
  }
}
