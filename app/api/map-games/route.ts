import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { names } = body

    if (!names || !Array.isArray(names)) {
      return NextResponse.json({ error: "Names array is required" }, { status: 400 })
    }

    const response = await fetch("https://bunter.ejer.lol/api/items/map", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "app",
        names: names,
      }),
    })

    if (!response.ok) {
      throw new Error(`External API responded with status: ${response.status}`)
    }

    const data = await response.json()

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error in map-games API:", error)
    return NextResponse.json({ error: "Failed to map game names" }, { status: 500 })
  }
}
