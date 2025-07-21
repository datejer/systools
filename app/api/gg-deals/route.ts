import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const apiKey = searchParams.get("key")
  const ids = searchParams.get("ids")

  if (!apiKey || !ids) {
    return NextResponse.json({ error: "Missing required parameters" }, { status: 400 })
  }

  try {
    const response = await fetch(`https://api.gg.deals/v1/prices/by-steam-app-id/?key=${apiKey}&ids=${ids}`, {
      headers: {
        "User-Agent": "Game Price Checker Tool",
      },
    })

    if (!response.ok) {
      throw new Error(`gg.deals API responded with status: ${response.status}`)
    }

    const data = await response.json()

    // No caching for price data as it changes frequently
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    })
  } catch (error) {
    console.error("Error fetching from gg.deals:", error)
    return NextResponse.json({ error: "Failed to fetch price data" }, { status: 500 })
  }
}
