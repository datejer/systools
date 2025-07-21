"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Download, Play, Loader2, ArrowLeft } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import Link from "next/link"

interface SteamApp {
  appid: number
  name: string
}

interface WishlistItem {
  appid: number
  priority: number
  date_added: number
}

interface WishlistResponse {
  response: {
    items: WishlistItem[]
  }
}

interface GameWishlistStatus {
  name: string
  appId: number
  isWishlisted: boolean
  dateAdded: string | null
  priority: number | null
  status: "pending" | "found" | "not-found" | "error"
}

export default function WishlistChecker() {
  const [steamId, setSteamId] = useState("")
  const [gameNames, setGameNames] = useState("")
  const [steamApps, setSteamApps] = useState<SteamApp[]>([])
  const [gameResults, setGameResults] = useState<GameWishlistStatus[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState("")

  // Load Steam apps on component mount
  useEffect(() => {
    fetchSteamApps()
  }, [])

  const fetchSteamApps = async () => {
    try {
      const response = await fetch("/api/steam-apps")

      if (!response.ok) {
        throw new Error(`API responded with status: ${response.status}`)
      }

      const data = await response.json()
      const apps = data.applist.apps

      setSteamApps(apps)
    } catch (err) {
      console.error("Error fetching Steam apps:", err)
      setError("Failed to fetch Steam app list. Please try again.")
    }
  }

  const findAppId = (gameName: string): number | null => {
    const normalizedName = gameName.toLowerCase().trim()
    const exactMatch = steamApps.find((app) => app.name.toLowerCase() === normalizedName)

    if (exactMatch) return exactMatch.appid

    // Fuzzy match - find closest match
    const partialMatch = steamApps.find(
      (app) => app.name.toLowerCase().includes(normalizedName) || normalizedName.includes(app.name.toLowerCase()),
    )

    return partialMatch?.appid || null
  }

  const fetchWishlist = async (steamId: string): Promise<WishlistItem[]> => {
    try {
      const response = await fetch(`/api/steam-wishlist?steamid=${steamId}`)

      if (!response.ok) {
        throw new Error(`Wishlist API responded with status: ${response.status}`)
      }

      const data: WishlistResponse = await response.json()
      return data.response.items || []
    } catch (err) {
      console.error("Error fetching wishlist:", err)
      throw new Error("Failed to fetch Steam wishlist")
    }
  }

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp * 1000).toLocaleDateString()
  }

  const startProcessing = async () => {
    if (!steamId.trim()) {
      setError("Please enter a Steam ID64")
      return
    }

    if (!gameNames.trim()) {
      setError("Please enter game names")
      return
    }

    if (steamApps.length === 0) {
      setError("Steam app list not loaded. Please wait or refresh the page.")
      return
    }

    setError("")
    setIsProcessing(true)

    try {
      // Parse game names and find their App IDs
      const names = gameNames.split("\n").filter((name) => name.trim())
      const results: GameWishlistStatus[] = []

      names.forEach((name) => {
        const appId = findAppId(name.trim())
        results.push({
          name: name.trim(),
          appId: appId || 0,
          isWishlisted: false,
          dateAdded: null,
          priority: null,
          status: appId ? "pending" : "not-found",
        })
      })

      setGameResults(results)

      // Fetch user's wishlist
      const wishlistItems = await fetchWishlist(steamId)
      const wishlistAppIds = new Set(wishlistItems.map((item) => item.appid))

      // Update results with wishlist status
      setGameResults((prev) =>
        prev.map((game) => {
          if (game.appId && wishlistAppIds.has(game.appId)) {
            const wishlistItem = wishlistItems.find((item) => item.appid === game.appId)
            return {
              ...game,
              isWishlisted: true,
              dateAdded: wishlistItem ? formatDate(wishlistItem.date_added) : null,
              priority: wishlistItem?.priority || null,
              status: "found",
            }
          } else if (game.appId) {
            return { ...game, status: "found" }
          }
          return game
        }),
      )
    } catch (err) {
      console.error("Error processing wishlist:", err)
      setError(err instanceof Error ? err.message : "An error occurred while processing")
    } finally {
      setIsProcessing(false)
    }
  }

  const generateCSV = () => {
    const headers = ["Game Name", "On Wishlist", "Date Added", "Priority", "Status"]
    const rows = gameResults.map((game) => [
      game.name,
      game.isWishlisted ? "Yes" : "No",
      game.dateAdded || "N/A",
      game.priority?.toString() || "N/A",
      game.status,
    ])

    const csvContent = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n")

    return csvContent
  }

  const downloadCSV = () => {
    const csv = generateCSV()
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "wishlist-check.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  const copyCSV = async () => {
    const csv = generateCSV()
    await navigator.clipboard.writeText(csv)
  }

  const wishlistedCount = gameResults.filter((g) => g.isWishlisted).length
  const isComplete = !isProcessing && gameResults.length > 0

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" />
          Back to Price Checker
        </Link>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Steam Wishlist Checker</CardTitle>
          <CardDescription>
            Check which games from your list are on a Steam user's wishlist. Enter the Steam ID64 and game names to get
            started.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label htmlFor="steamId" className="block text-sm font-medium mb-2">
              Steam ID64
            </label>
            <Input
              id="steamId"
              placeholder="Enter Steam ID64 (e.g., 76561198000000000)"
              value={steamId}
              onChange={(e) => setSteamId(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              You can find your Steam ID64 at{" "}
              <a
                href="https://steamid.io/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                steamid.io
              </a>
            </p>
          </div>

          <div>
            <label htmlFor="gameNames" className="block text-sm font-medium mb-2">
              Game Names (one per line)
            </label>
            <Textarea
              id="gameNames"
              placeholder="Counter-Strike 2&#10;Half-Life 2&#10;Portal 2"
              value={gameNames}
              onChange={(e) => setGameNames(e.target.value)}
              rows={8}
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2">
            <Button onClick={startProcessing} disabled={isProcessing} className="flex items-center gap-2">
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Checking Wishlist...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Check Wishlist
                </>
              )}
            </Button>
          </div>

          {gameResults.length > 0 && (
            <div className="text-sm text-muted-foreground">
              Found {wishlistedCount} out of {gameResults.length} games on the wishlist
            </div>
          )}
        </CardContent>
      </Card>

      {gameResults.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Wishlist Results</CardTitle>
              <CardDescription>Showing which games are on the user's Steam wishlist</CardDescription>
            </div>

            {isComplete && (
              <div className="flex gap-2">
                <Button onClick={downloadCSV} variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  Download CSV
                </Button>
                <Button onClick={copyCSV} variant="outline" size="sm">
                  Copy CSV
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Game Name</TableHead>
                  <TableHead>On Wishlist</TableHead>
                  <TableHead>Date Added</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gameResults.map((game, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{game.name}</TableCell>
                    <TableCell>
                      <Badge variant={game.isWishlisted ? "default" : "outline"}>
                        {game.isWishlisted ? "Yes" : "No"}
                      </Badge>
                    </TableCell>
                    <TableCell>{game.dateAdded || "N/A"}</TableCell>
                    <TableCell>{game.priority !== null ? game.priority : "N/A"}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          game.status === "found"
                            ? "default"
                            : game.status === "pending"
                              ? "secondary"
                              : game.status === "not-found"
                                ? "outline"
                                : "destructive"
                        }
                      >
                        {game.status === "found"
                          ? "Found"
                          : game.status === "pending"
                            ? "Processing..."
                            : game.status === "not-found"
                              ? "Not Found"
                              : "Error"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
