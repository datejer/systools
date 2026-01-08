"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Download, Play, Square, Loader2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

interface MappedItem {
  id: number
  type: string
  foreign_id: number
  foreign_type: string | null
  name: string
  release_date: string | null
  capsule_image_url: string | null
  achievements: number | null
  cards: number | null
  positive_reviews: number | null
  negative_reviews: number | null
  created_at: string
}

interface MapApiResponse {
  items: MappedItem[]
  failedToMap: string[]
}

interface GamePrice {
  name: string
  appId: number
  price: string | null
  currency: string
  tradingCards: number | null
  status: "pending" | "found" | "not-found" | "error"
}

interface GGDealsResponse {
  success: boolean
  data: {
    [appId: string]: {
      title: string
      url: string
      prices: {
        currentRetail: string
        currentKeyshops: string
        historicalRetail: string
        historicalKeyshops: string
        currency: string
      }
    } | null
  }
}

export default function GamePriceChecker() {
  const [apiKey, setApiKey] = useState("")
  const [gameNames, setGameNames] = useState("")
  const [gameResults, setGameResults] = useState<GamePrice[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [error, setError] = useState("")
  const [countdown, setCountdown] = useState(0)
  const [tradingCardsData, setTradingCardsData] = useState<Record<string, number>>({})

  const queueRef = useRef<number[]>([])
  const processingRef = useRef(false)

  // Load trading cards data on component mount
  useEffect(() => {
    fetchTradingCardsData()
  }, [])

  const fetchTradingCardsData = async () => {
    try {
      const response = await fetch(
        "https://raw.githubusercontent.com/nolddor/steam-badges-db/refs/heads/main/data/badges.slim.json",
      )

      if (!response.ok) {
        console.warn("Failed to fetch trading cards data:", response.status)
        return
      }

      const data = await response.json()
      setTradingCardsData(data)
    } catch (err) {
      console.warn("Error fetching trading cards data:", err)
    }
  }

  const mapGameNamesToAppIds = async (names: string[]): Promise<MapApiResponse> => {
    try {
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
        throw new Error(`API responded with status: ${response.status}`)
      }

      const data: MapApiResponse = await response.json()
      return data
    } catch (err) {
      console.error("Error mapping game names:", err)
      throw err
    }
  }

  const fetchPricesFromQueue = useCallback(async () => {
    if (processingRef.current || queueRef.current.length === 0) return

    processingRef.current = true

    while (queueRef.current.length > 0) {
      const batch = queueRef.current.splice(0, 100) // Max 100 IDs per request

      try {
        const response = await fetch(`/api/gg-deals?key=${apiKey}&ids=${batch.join(",")}`)

        if (!response.ok) {
          throw new Error(`API request failed: ${response.status}`)
        }

        const data: GGDealsResponse = await response.json()

        if (!data.success) {
          throw new Error("API returned unsuccessful response")
        }

        // Update results with fetched prices
        setGameResults((prev) =>
          prev.map((game) => {
            if (batch.includes(game.appId)) {
              const priceData = data.data[game.appId.toString()]

              if (priceData) {
                // Handle null values properly
                const retailPrice = priceData.prices.currentRetail
                  ? Number.parseFloat(priceData.prices.currentRetail)
                  : null
                const keyshopsPrice = priceData.prices.currentKeyshops
                  ? Number.parseFloat(priceData.prices.currentKeyshops)
                  : null

                let cheapestPrice = null

                // Determine the cheapest price, handling null values
                if (retailPrice !== null && keyshopsPrice !== null) {
                  cheapestPrice = Math.min(retailPrice, keyshopsPrice)
                } else if (retailPrice !== null) {
                  cheapestPrice = retailPrice
                } else if (keyshopsPrice !== null) {
                  cheapestPrice = keyshopsPrice
                }

                return {
                  ...game,
                  price: cheapestPrice !== null ? cheapestPrice.toFixed(2) : null,
                  currency: priceData.prices.currency,
                  tradingCards: tradingCardsData[game.appId.toString()] || null,
                  status: "found",
                }
              } else {
                return {
                  ...game,
                  tradingCards: tradingCardsData[game.appId.toString()] || null,
                  status: "not-found",
                }
              }
            }
            return game
          }),
        )

        setProgress((prev) => ({ ...prev, current: prev.current + batch.length }))
      } catch (err) {
        console.error("Error fetching prices:", err)
        // Mark batch items as error
        setGameResults((prev) => prev.map((game) => (batch.includes(game.appId) ? { ...game, status: "error" } : game)))
        setProgress((prev) => ({ ...prev, current: prev.current + batch.length }))
      }

      // Wait 60 seconds (1 minute) between batches of 100 to respect rate limit
      if (queueRef.current.length > 0) {
        // Show countdown for 60 seconds
        setCountdown(60)
        const countdownInterval = setInterval(() => {
          setCountdown((prev) => {
            if (prev <= 1) {
              clearInterval(countdownInterval)
              return 0
            }
            return prev - 1
          })
        }, 1000)

        await new Promise((resolve) => setTimeout(resolve, 60000))
      }
    }

    processingRef.current = false
    setIsProcessing(false)
  }, [apiKey, tradingCardsData])

  const startProcessing = async () => {
    if (!apiKey.trim()) {
      setError("Please enter your gg.deals API key")
      return
    }

    if (!gameNames.trim()) {
      setError("Please enter game names")
      return
    }

    setError("")
    setIsProcessing(true)

    const names = gameNames
      .split("\n")
      .filter((name) => name.trim())
      .map((name) => name.trim())

    try {
      const mappingResult = await mapGameNamesToAppIds(names)

      const results: GamePrice[] = []
      const validAppIds: number[] = []

      // Process successfully mapped items
      mappingResult.items.forEach((item) => {
        results.push({
          name: item.name,
          appId: item.foreign_id,
          price: null,
          currency: "USD",
          tradingCards: tradingCardsData[item.foreign_id.toString()] || null,
          status: "pending",
        })
        validAppIds.push(item.foreign_id)
      })

      // Process failed mappings
      mappingResult.failedToMap.forEach((name) => {
        results.push({
          name: name,
          appId: 0,
          price: null,
          currency: "USD",
          tradingCards: null,
          status: "not-found",
        })
      })

      setGameResults(results)
      setProgress({ current: 0, total: names.length })

      // Add valid app IDs to queue
      queueRef.current = validAppIds

      // Start processing queue
      fetchPricesFromQueue()
    } catch (err) {
      setError("Failed to map game names. Please try again.")
      setIsProcessing(false)
    }
  }

  const stopProcessing = () => {
    queueRef.current = []
    processingRef.current = false
    setIsProcessing(false)
  }

  const generateCSV = () => {
    const headers = ["Game Name", "Price", "Currency", "Trading Cards", "Status"]
    const rows = gameResults.map((game) => [
      game.name,
      game.price || "N/A",
      game.currency,
      game.tradingCards?.toString() || "",
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
    a.download = "game-prices.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  const copyCSV = async () => {
    const csv = generateCSV()
    await navigator.clipboard.writeText(csv)
  }

  const completedCount = gameResults.filter((g) => g.status !== "pending").length
  const isComplete = completedCount === gameResults.length && gameResults.length > 0

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6 flex justify-end">
        <Link
          href="/wishlist-checker"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          Steam Wishlist Checker
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Game Price Checker</CardTitle>
          <CardDescription>
            Get the best prices for your games from gg.deals. Enter your API key and a list of game names to get
            started.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label htmlFor="apiKey" className="block text-sm font-medium mb-2">
              gg.deals API Key
            </label>
            <Input
              id="apiKey"
              type="password"
              placeholder="Enter your gg.deals API key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
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
                  Processing...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Start Processing
                </>
              )}
            </Button>

            {isProcessing && (
              <Button
                onClick={stopProcessing}
                variant="outline"
                size="sm"
                className="flex items-center gap-2 bg-transparent"
              >
                <Square className="w-4 h-4" />
                Stop
              </Button>
            )}
          </div>

          {gameResults.length > 0 && (
            <div className="text-sm text-muted-foreground">
              Progress: {completedCount} / {gameResults.length} games processed
              {countdown > 0 && (
                <div className="text-orange-600 mt-1">
                  Waiting {countdown} seconds before next batch (rate limit: 100 requests per minute)
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {gameResults.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Results</CardTitle>
              <CardDescription>Showing the cheapest available price for each game</CardDescription>
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
                  <TableHead>Price</TableHead>
                  <TableHead>Trading Cards</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gameResults.map((game, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{game.name}</TableCell>
                    <TableCell>{game.price ? `$${game.price} ${game.currency}` : "N/A"}</TableCell>
                    <TableCell>{game.tradingCards || ""}</TableCell>
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
