"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Slider } from "@/components/ui/slider"
import { toast } from "sonner"
import {
  handleNormalAllocation,
  handleSavingsAllocation,
  handleDebtAllocation,
  determineAllocationMode,
  getAvailableDebtAllocation,
  type GameState,
  type BudgetAllocation
} from '@/lib/allocationLogic'
import PieChart from '@/components/PieChart'

// Types are now imported from allocationLogic.ts

// Categories for budget allocation
const categories = [
  { name: "Transportation (Public Transit, Gas, Car Maintenance)", emoji: "🚗" },
  { name: "Groceries", emoji: "🛒" },
  { name: "Dining Out", emoji: "🍽️" },
  { name: "Healthcare (Insurance, Medical Expenses)", emoji: "🏥" },
  { name: "Entertainment (Leisure, Subscriptions, Events)", emoji: "🎮" },
  { name: "Internet and Phone Bills", emoji: "📱" },
  { name: "Miscellaneous (Clothing, Personal Care, Household Items)", emoji: "🛍️" },
  { name: "Savings & Emergency Fund", emoji: "💰" },
  { name: "Debt Repayment", emoji: "💳" }
]

// Random events generator
const generateRandomEvent = (biweeklyIncome: number, iteration: number) => {
  const events = [
    { message: "🚗 Oh no! Your car needs unexpected repairs.", adjustment: -150 },
    { message: "⚡ Surprise! Your utility bill is higher than expected.", adjustment: -Math.floor((biweeklyIncome || 0) * 0.05) },
    { message: "🏥 Uh-oh! You had an unexpected medical expense.", adjustment: -100 },
    { message: "🎉 Great news! You received a small bonus at work!", adjustment: 100 },
    { message: "💫 Lucky you! You got a refund on an overcharge.", adjustment: 50 },
    { message: "🧥 Nice! You found some extra cash in an old jacket!", adjustment: 75 },
    { message: "🏠 Bummer! Your home needs an urgent repair.", adjustment: -120 },
    { message: "🤝 Hey! A friend finally paid you back.", adjustment: 60 },
    { message: "🍽️ Sweet! You got an unexpected dining discount.", adjustment: 30 },
    { message: "⚠️ Oh dear! You fell for a small online scam.", adjustment: -80 }
  ]
  // Use iteration as seed to make it deterministic
  const index = ((biweeklyIncome || 0) + (iteration || 1)) % events.length
  return events[index] || events[0] // Fallback to first event if index is out of bounds
}

// Mock AI functions (in real app, these would call OpenAI API)
const getLocationCostEstimates = async (location: string) => {
  try {
    const response = await fetch('/api/location-costs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ location }),
    })

    if (!response.ok) {
      throw new Error('Failed to fetch location costs')
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error fetching location costs:', error)
    // Fallback to default values
    return { housing_cost: 1200, utility_cost: 200, tax_rate: 25 }
  }
}

const getExpertAdvice = async (
  location: string,
  monthlySalary: number,
  allocations: Record<string, { amount: number; emoji: string }>,
  iteration: number,
  isGameOver: boolean = false
) => {
  try {
    const response = await fetch('/api/expert-advice', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        location,
        monthlySalary,
        allocations,
        iteration,
        isGameOver
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to fetch expert advice')
    }

    const data = await response.json()
    return data.advice
  } catch (error) {
    console.error('Error fetching expert advice:', error)
    return "Unable to get expert advice at this time. Please continue with your budget planning."
  }
}

export default function GameClient() {
  const [mounted, setMounted] = useState(false)
  
  // Initialize game state only on client side
  const [gameState, setGameState] = useState<GameState>(() => ({
    stage: 'salary',
    grossMonthlySalary: 0,
    monthlySalary: 0,
    location: '',
    biweeklyIncome: 0,
    currentBalance: 0,
    iteration: 1,
    currentCategoryIndex: 0,
    allocations: {},
    allocatedAmount: 0,
    debt: 0,
    costOfDebt: 0,
    savings: 0,
    housingCost: 0,
    utilityCost: 0,
    taxRate: 25,
    iterationHistory: []
  }))

  const [grossSalary, setGrossSalary] = useState<number>(0)
  const [location, setLocation] = useState<string>('')
  const [currentAmount, setCurrentAmount] = useState<number>(0)
  const [savingsAmount, setSavingsAmount] = useState<number>(0)
  const [debtAmount, setDebtAmount] = useState<number>(0)
  const [isUsingSavings, setIsUsingSavings] = useState<boolean>(false)
  const [isUsingDebt, setIsUsingDebt] = useState<boolean>(false)
  const [savingsExhausted, setSavingsExhausted] = useState<boolean>(false)
  const [debtUsedThisRound, setDebtUsedThisRound] = useState<number>(0)
  const [expertAdvice, setExpertAdvice] = useState<string>('')
  const [isLoadingAdvice, setIsLoadingAdvice] = useState<boolean>(false)
  const [isLoadingLocation, setIsLoadingLocation] = useState<boolean>(false)
  const [locationEstimates, setLocationEstimates] = useState<{
    housing_cost: number
    utility_cost: number
    tax_rate: number
  } | null>(null)
  const [editableCosts, setEditableCosts] = useState<{
    housing_cost: number
    utility_cost: number
    tax_rate: number
  }>({
    housing_cost: 1200,
    utility_cost: 200,
    tax_rate: 25
  })

  // Ensure component is mounted on client side
  useEffect(() => {
    setMounted(true)
  }, [])

  // Monitor when savings are exhausted during allocation
  useEffect(() => {
    if (isUsingSavings && savingsAmount >= gameState.savings && gameState.savings > 0) {
      setSavingsExhausted(true)
    }
  }, [savingsAmount, gameState.savings, isUsingSavings])

  // Reset savings exhausted when starting a new category allocation
  useEffect(() => {
    if (gameState.currentCategoryIndex === 0) {
      setSavingsExhausted(false)
    }
  }, [gameState.currentCategoryIndex])

  // Monitor savings state changes and set exhaustion accordingly
  useEffect(() => {
    console.log('Debug - Savings changed to:', gameState.savings)
    if (gameState.savings === 0) {
      console.log('Debug - Setting savingsExhausted to TRUE (savings are 0)')
      setSavingsExhausted(true)
    }
  }, [gameState.savings])

  // Auto-trigger expert review when summary stage loads
  useEffect(() => {
    if (gameState.stage === 'summary' && !expertAdvice && !isLoadingAdvice) {
      fetchExpertAdvice(gameState.currentBalance < 0)
    }
  }, [gameState.stage, gameState.iteration])

  // Memoize the loading component to prevent re-renders
  const loadingComponent = useMemo(() => (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">Loading...</p>
      </div>
    </div>
  ), [])

  // Don't render until mounted to prevent hydration issues
  if (!mounted) {
    return loadingComponent
  }

  const handleSalarySubmit = () => {
    if (grossSalary <= 0) return
    
    setGameState(prev => ({
      ...prev,
      grossMonthlySalary: grossSalary,
      stage: 'location'
    }))
  }

  const handleLocationSubmit = async () => {
    if (!location.trim()) return
    
    setIsLoadingLocation(true)
    const loadingToast = toast.loading(`Getting cost estimates for ${location}...`)
    
    try {
      const estimates = await getLocationCostEstimates(location)
      setLocationEstimates(estimates)
      setEditableCosts(estimates)
      toast.dismiss(loadingToast)
      toast.success(`Cost estimates loaded for ${location}!`)
    } catch (error) {
      console.error('Error getting location estimates:', error)
      // Use default values if API fails
      const defaultEstimates = { housing_cost: 1200, utility_cost: 200, tax_rate: 25 }
      setLocationEstimates(defaultEstimates)
      setEditableCosts(defaultEstimates)
      toast.dismiss(loadingToast)
      toast.error('Failed to get cost estimates. Using default values.')
    } finally {
      setIsLoadingLocation(false)
    }
  }

  const handleContinueWithCosts = () => {
    const taxRate = editableCosts.tax_rate
    const monthlySalary = Number(grossSalary) * (1 - taxRate / 100)
    const biweeklyIncome = monthlySalary / 2
    
    console.log('Debug - Setting costs:', {
      housingCost: editableCosts.housing_cost,
      utilityCost: editableCosts.utility_cost,
      taxRate: taxRate
    })
    
    setGameState(prev => ({
      ...prev,
      location: location,
      monthlySalary: monthlySalary,
      biweeklyIncome: biweeklyIncome,
      currentBalance: 0, // Start with 0 carryover for Round 1
      housingCost: editableCosts.housing_cost,
      utilityCost: editableCosts.utility_cost,
      taxRate: taxRate,
      stage: 'budget_allocation'
    }))
    
    toast.success('Budget allocation started!')
  }



  const handleAllocationSubmit = (overrideAmount?: number, mode?: 'normal' | 'savings' | 'debt') => {
    const currentCategory = categories[gameState.currentCategoryIndex]
    const amountToUse = overrideAmount !== undefined ? overrideAmount : currentAmount
    
    setGameState(prev => {
      let newGameState: GameState
      let newSavings: number
      let newDebt: number
      let savingsExhausted = false
      
      // Determine which allocation mode to use
      const actualMode = mode || (isUsingSavings ? 'savings' : isUsingDebt ? 'debt' : 'normal')
      console.log('Debug - handleAllocationSubmit called with:', {
        mode,
        actualMode,
        isUsingSavings,
        isUsingDebt,
        amountToUse,
        categoryName: currentCategory.name
      })
      
      if (actualMode === 'savings') {
        console.log('Debug - Entering savings allocation mode')
        // Savings allocation mode
        const result = handleSavingsAllocation(prev, amountToUse, currentCategory.name, currentCategory.emoji)
        newGameState = result.newGameState
        newSavings = result.newSavings
        newDebt = result.newDebt
        savingsExhausted = result.savingsExhausted

        console.log('Debug - Savings Exhausted:', result.savingsExhausted)
        
        // Update the component's savingsExhausted state immediately
        if (result.savingsExhausted) {
          setSavingsExhausted(true)
        }
      } else if (actualMode === 'debt') {
        console.log('Debug - Entering debt allocation mode')
        // Debt allocation mode
        const result = handleDebtAllocation(prev, amountToUse, currentCategory.name, currentCategory.emoji)
        newGameState = result.newGameState
        newSavings = result.newSavings
        newDebt = result.newDebt
        
        // Track debt used in this round
        setDebtUsedThisRound(prev => prev + amountToUse)
      } else {
        // Normal allocation mode
        const result = handleNormalAllocation(prev, amountToUse, currentCategory.name, currentCategory.emoji)
        newGameState = result.newGameState
        newSavings = result.newSavings
        newDebt = result.newDebt
      }
      
      const newCategoryIndex = prev.currentCategoryIndex + 1
      
      // If we've allocated all categories, move to summary
      if (newCategoryIndex >= categories.length) {
        return {
          ...newGameState,
          currentCategoryIndex: newCategoryIndex,
          savings: newSavings,
          debt: newDebt,
          costOfDebt: newDebt * 0.15 / 26, // Update debt interest
          stage: 'summary'
        }
      }
      
      return {
        ...newGameState,
        currentCategoryIndex: newCategoryIndex,
        savings: newSavings,
        debt: newDebt,
        costOfDebt: newDebt * 0.15 / 26 // Update debt interest
      }
    })
    
    setCurrentAmount(0)
    setSavingsAmount(0)
    setDebtAmount(0)
    setIsUsingSavings(false)
    setIsUsingDebt(false)
  }

  const handleNextPeriod = () => {
    const biweeklyHousing = gameState.housingCost / 2
    const biweeklyUtilities = gameState.utilityCost / 2
    const biweeklyFixedCosts = biweeklyHousing + biweeklyUtilities
    
    // Calculate new balance
    let newBalance = gameState.currentBalance + gameState.biweeklyIncome
    let newDebt = gameState.debt
    let newSavings = gameState.savings
    
    // Apply fixed costs
    newBalance -= biweeklyFixedCosts
    
    // Apply discretionary spending
    newBalance -= gameState.allocatedAmount
    
    // Generate random event
    const event = generateRandomEvent(gameState.biweeklyIncome || 0, gameState.iteration)
    newBalance += event?.adjustment || 0
    
    // Handle debt repayment (already handled in allocation stage)
    if (gameState.allocations["Debt Repayment"]) {
      const debtPayment = gameState.allocations["Debt Repayment"].amount
      if (debtPayment > 0 && newDebt > 0) {
        newDebt = Math.max(0, newDebt - debtPayment)
      }
    }
    
    // If balance goes negative, use savings first, then create debt
    if (newBalance < 0) {
      const shortfall = Math.abs(newBalance)
      
      // Use savings first
      if (newSavings >= shortfall) {
        newSavings -= shortfall
        newBalance = 0
      } else {
        // If savings aren't enough, use all savings and create debt for the rest
        const remainingShortfall = shortfall - newSavings
        newSavings = 0
        newDebt += remainingShortfall
        newBalance = 0
      }
    }
    
    // Add monthly interest to debt (every 2 iterations = 1 month)
    if (gameState.iteration % 2 === 0 && newDebt > 0) {
      const monthlyInterest = newDebt * 0.15 / 12 // 15% APR
      newDebt += monthlyInterest
    }
    
    const newIteration = gameState.iteration + 1
    
    setGameState(prev => ({
      ...prev,
      currentBalance: newBalance,
      debt: newDebt,
      savings: newSavings,
      costOfDebt: newDebt * 0.15 / 26, // Biweekly interest
      iteration: newIteration,
      currentCategoryIndex: 0,
      allocations: {},
      allocatedAmount: 0,
      stage: newIteration > 12 ? 'game_over' : 'budget_allocation'
    }))
    
    // Reset debt tracking for new round
    setDebtUsedThisRound(0)
  }

  const resetGame = () => {
    setGameState({
      stage: 'salary',
      grossMonthlySalary: 0,
      monthlySalary: 0,
      location: '',
      biweeklyIncome: 0,
      currentBalance: 0,
      iteration: 1,
      currentCategoryIndex: 0,
      allocations: {},
      allocatedAmount: 0,
      debt: 0,
      costOfDebt: 0,
      savings: 0,
      housingCost: 0,
      utilityCost: 0,
      taxRate: 25,
      iterationHistory: []
    })
    setGrossSalary(0)
    setLocation('')
    setCurrentAmount(0)
    setSavingsAmount(0)
    setDebtAmount(0)
    setIsUsingSavings(false)
    setIsUsingDebt(false)
    setSavingsExhausted(false)
    setDebtUsedThisRound(0)
    setExpertAdvice('')
    setIsLoadingAdvice(false)
    setIsLoadingLocation(false)
    setLocationEstimates(null)
    setEditableCosts({
      housing_cost: 1200,
      utility_cost: 200,
      tax_rate: 25
    })
  }

  const fetchExpertAdvice = async (isGameOver: boolean = false) => {
    setIsLoadingAdvice(true)
    try {
      const advice = await getExpertAdvice(
        gameState.location,
        gameState.monthlySalary,
        gameState.allocations,
        gameState.iteration,
        isGameOver
      )
      setExpertAdvice(advice)
    } catch (error) {
      console.error('Error fetching expert advice:', error)
      setExpertAdvice('Unable to get expert advice at this time.')
    } finally {
      setIsLoadingAdvice(false)
    }
  }

  // Salary Input Stage
  if (gameState.stage === 'salary') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
        <div className="max-w-2xl mx-auto pt-20">
          <Card className="shadow-xl">
            <CardHeader className="text-center">
              <CardTitle className="text-3xl font-bold text-gray-800 dark:text-white">
                🎮 Cost of Living Game
              </CardTitle>
              <CardDescription className="text-lg">
                Learn to manage your budget in a realistic 6-month simulation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  💰 What's your gross monthly income?
                </label>
                <Input
                  type="number"
                  placeholder="Enter amount in USD"
                  value={grossSalary || ''}
                  onChange={(e) => setGrossSalary(Number(e.target.value))}
                  className="text-lg"
                />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  This is your income before taxes are deducted
                </p>
              </div>
              
              {grossSalary > 0 && (
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                  <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">
                    📊 Income Summary
                  </h4>
                  <p className="text-blue-700 dark:text-blue-300">
                    Gross Monthly Income: ${grossSalary.toLocaleString()}
                  </p>
                  <p className="text-blue-700 dark:text-blue-300">
                    We'll calculate your tax rate based on your location in the next step.
                  </p>
                </div>
              )}
              
              <Button 
                onClick={handleSalarySubmit}
                disabled={grossSalary <= 0}
                className="w-full"
                size="lg"
              >
                Continue ➡️
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Location Input Stage
  if (gameState.stage === 'location') {
    const calculatedNetMonthly = Number(grossSalary) * (1 - editableCosts.tax_rate / 100)
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
        <div className="max-w-4xl mx-auto pt-10">
          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle className="text-2xl font-bold">
                📍 Where would you like to live?
              </CardTitle>
              <CardDescription>
                Enter a state or city to get cost of living estimates
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                    <h4 className="font-semibold mb-2">Income Summary</h4>
                    <p>Gross Monthly: ${grossSalary.toLocaleString()}</p>
                    <p>Tax-Free Monthly: ${calculatedNetMonthly.toLocaleString()}</p>
                    <p>Bi-weekly Budget: ${(calculatedNetMonthly / 2).toLocaleString()}</p>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Location</label>
                    <Input
                      placeholder="Enter state or city"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      disabled={isLoadingLocation}
                    />
                  </div>
                  
                  <Button 
                    onClick={handleLocationSubmit}
                    disabled={!location.trim() || isLoadingLocation}
                    className="w-full"
                  >
                    {isLoadingLocation ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Getting Estimates...
                      </>
                    ) : (
                      'Get Cost Estimates'
                    )}
                  </Button>
                </div>
                
                <div className="space-y-4">
                  <h4 className="font-semibold">
                    {locationEstimates ? `Cost Estimates for ${location}` : 'Estimated Costs for your location'}
                  </h4>
                  
                  {locationEstimates ? (
                    <div className="space-y-4">
                      <div className="grid gap-3">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">🏠 Housing Cost (Monthly)</label>
                          <Input
                            type="number"
                            value={editableCosts.housing_cost}
                            onChange={(e) => setEditableCosts(prev => ({
                              ...prev,
                              housing_cost: Number(e.target.value)
                            }))}
                            className="w-full"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">⚡ Utilities (Monthly)</label>
                          <Input
                            type="number"
                            value={editableCosts.utility_cost}
                            onChange={(e) => setEditableCosts(prev => ({
                              ...prev,
                              utility_cost: Number(e.target.value)
                            }))}
                            className="w-full"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">💰 Tax Rate (%)</label>
                          <Input
                            type="number"
                            value={editableCosts.tax_rate}
                            onChange={(e) => setEditableCosts(prev => ({
                              ...prev,
                              tax_rate: Number(e.target.value)
                            }))}
                            className="w-full"
                          />
                        </div>
                      </div>
                      
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                        <h5 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">
                          📊 Updated Income Summary
                        </h5>
                        <div className="space-y-1 text-sm text-blue-700 dark:text-blue-300">
                          <p>Gross Monthly: ${grossSalary.toLocaleString()}</p>
                                                  <p>Tax-Free Monthly: ${(Number(grossSalary) * (1 - editableCosts.tax_rate / 100)).toLocaleString()}</p>
                        <p>Bi-weekly Budget: ${(Number(grossSalary) * (1 - editableCosts.tax_rate / 100) / 2).toLocaleString()}</p>
                        </div>
                      </div>
                      
                      <Button 
                        onClick={handleContinueWithCosts}
                        className="w-full"
                        size="lg"
                      >
                        Continue with These Costs ➡️
                      </Button>
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      <div className="flex justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border">
                        <span>🏠 Housing Cost</span>
                        <span className="font-semibold">${editableCosts.housing_cost.toLocaleString()}/month</span>
                      </div>
                      <div className="flex justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border">
                        <span>⚡ Utilities</span>
                        <span className="font-semibold">${editableCosts.utility_cost.toLocaleString()}/month</span>
                      </div>
                      <div className="flex justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border">
                        <span>💰 Tax Rate</span>
                        <span className="font-semibold">{editableCosts.tax_rate}%</span>
                      </div>
                    </div>
                  )}
                  
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
                    <h5 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
                      ⚠️ Important Notes
                    </h5>
                    <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
                      <li>• Housing costs are automatically deducted from your budget</li>
                      <li>• You'll allocate the remaining funds to other categories</li>
                      <li>• Random events will occur throughout the simulation</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Budget Allocation Stage
  if (gameState.stage === 'budget_allocation') {
    const biweeklyHousing = gameState.housingCost / 2
    const biweeklyUtilities = gameState.utilityCost / 2
    const biweeklyFixedCosts = biweeklyHousing + biweeklyUtilities
    
    // For Round 1: Only use current bi-weekly income
    // For subsequent rounds: Use previous balance + current bi-weekly income
    const currentPeriodIncome = gameState.iteration === 1 ? gameState.biweeklyIncome : gameState.currentBalance + gameState.biweeklyIncome
    

    
    const discretionaryIncome = currentPeriodIncome - biweeklyFixedCosts - gameState.costOfDebt
    const remainingToAllocate = discretionaryIncome - gameState.allocatedAmount
    const currentCategory = categories[gameState.currentCategoryIndex]
    
    // Handle case where fixed costs exceed income
    const fixedCostsExceedIncome = discretionaryIncome < 0
    const debtNeeded = fixedCostsExceedIncome ? Math.abs(discretionaryIncome) : 0
    
    // Use the new allocation mode logic
    const allocationMode = determineAllocationMode(gameState, remainingToAllocate, savingsExhausted)
    const maxDebtAllocation = getAvailableDebtAllocation(gameState)
    const availableDebtAllocation = Math.max(0, maxDebtAllocation - debtUsedThisRound)
    
    // Debug logging
    console.log('Debug - Debt Allocation:', {
      maxDebtAllocation,
      debtUsedThisRound,
      availableDebtAllocation,
      allocationMode
    })
    
    // Determine which mode is active
    const shouldActivateSavings = allocationMode === 'savings' && !isUsingSavings && !isUsingDebt
    const shouldActivateDebt = allocationMode === 'debt' && !isUsingDebt && availableDebtAllocation > 0
    
    // Calculate available amounts
    const availableWithSavings = shouldActivateSavings ? gameState.savings : remainingToAllocate
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
        <div className="max-w-4xl mx-auto pt-10">
          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle className="text-2xl font-bold">
                🎯 Round {gameState.iteration} of 12 (Month {Math.ceil(gameState.iteration / 2)})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Financial Summary */}
              <div className="grid md:grid-cols-3 gap-4">
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                  <h4 className="font-semibold text-green-800 dark:text-green-200">💵 Bi-weekly Income</h4>
                  <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                    ${gameState.biweeklyIncome.toLocaleString()}
                  </p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                  <h4 className="font-semibold text-blue-800 dark:text-blue-200">
                    {gameState.iteration === 1 ? '💳 This Period\'s Budget' : '💳 Available Budget'}
                  </h4>
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                    ${currentPeriodIncome.toLocaleString()}
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-400">
                    {gameState.iteration === 1 ? 'Current bi-weekly income' : 'Previous balance + current income'}
                  </p>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                  <h4 className="font-semibold text-purple-800 dark:text-purple-200">
                    {shouldActivateSavings ? '💰 Available from Savings' : 
                     shouldActivateDebt ? '💳 Available from Debt' : '🛍️ Available to Allocate'}
                  </h4>
                  <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                    ${shouldActivateDebt ? availableDebtAllocation.toLocaleString() : availableWithSavings.toLocaleString()}
                  </p>
                  {shouldActivateSavings && (
                    <p className="text-xs text-purple-600 dark:text-purple-400">
                      Using emergency savings
                    </p>
                  )}
                  {shouldActivateDebt && (
                    <p className="text-xs text-purple-600 dark:text-purple-400">
                      Using debt allocation (1/2 monthly salary)
                    </p>
                  )}
                </div>
              </div>

              {/* Fixed Costs */}
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <h4 className="font-semibold mb-3">🏠 Fixed Bi-weekly Costs (Automatically Deducted)</h4>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="flex justify-between">
                    <span>Housing</span>
                    <span className="font-semibold">${biweeklyHousing.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Utilities</span>
                    <span className="font-semibold">${biweeklyUtilities.toLocaleString()}</span>
                  </div>
                </div>
                <div className="border-t mt-3 pt-3">
                  <div className="flex justify-between font-semibold">
                    <span>Total Fixed Costs</span>
                    <span>${biweeklyFixedCosts.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Warning when fixed costs exceed income */}
              {fixedCostsExceedIncome && (
                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                  <h4 className="font-semibold text-red-800 dark:text-red-200 mb-2">
                    ⚠️ Fixed Costs Exceed Income!
                  </h4>
                  <p className="text-red-700 dark:text-red-300">
                    Your fixed costs (${biweeklyFixedCosts.toLocaleString()}) exceed your available income (${currentPeriodIncome.toLocaleString()}).
                  </p>
                  <p className="text-red-700 dark:text-red-300 font-semibold">
                    ${debtNeeded.toLocaleString()} will be automatically added to your debt to cover essential expenses.
                  </p>
                </div>
              )}

              {/* Savings Information */}
              {gameState.savings > 0 && (
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                  <h4 className="font-semibold text-green-800 dark:text-green-200 mb-2">
                    💰 Emergency Savings: ${gameState.savings.toLocaleString()}
                  </h4>
                  <p className="text-green-700 dark:text-green-300">
                    This will be used automatically if you run out of money.
                  </p>
                </div>
              )}

              {/* Debt Information */}
              {gameState.debt > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                  <h4 className="font-semibold text-red-800 dark:text-red-200 mb-2">
                    💸 Current Debt: ${gameState.debt.toLocaleString()}
                  </h4>
                  <p className="text-red-700 dark:text-red-300">
                    Bi-weekly interest charge (15% APR): ${gameState.costOfDebt.toLocaleString()}
                  </p>
                </div>
              )}

              {/* Allocation Progress */}
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span>Allocation Progress</span>
                  <span>
                    {gameState.allocatedAmount.toLocaleString()} / {discretionaryIncome.toLocaleString()}
                    {shouldActivateSavings && ` + ${savingsAmount.toLocaleString()} from savings`}
                    {shouldActivateDebt && ` + ${debtAmount.toLocaleString()} from debt`}
                  </span>
                </div>
                <Progress 
                  value={shouldActivateSavings 
                    ? ((gameState.allocatedAmount + savingsAmount) / Math.max(0.01, discretionaryIncome + savingsAmount)) * 100
                    : shouldActivateDebt
                    ? ((gameState.allocatedAmount + debtAmount) / Math.max(0.01, discretionaryIncome + debtAmount)) * 100
                    : (gameState.allocatedAmount / Math.max(0.01, discretionaryIncome)) * 100
                  } 
                  className="h-3"
                />
                {shouldActivateSavings && (
                  <div className="bg-green-50 dark:bg-green-900/20 p-2 rounded text-center">
                    <p className="text-sm text-green-700 dark:text-green-300">
                      💰 Using emergency savings: ${savingsAmount.toLocaleString()}
                    </p>
                  </div>
                )}
                {shouldActivateDebt && (
                  <div className="bg-red-50 dark:bg-red-900/20 p-2 rounded text-center">
                    <p className="text-sm text-red-700 dark:text-red-300">
                      💳 Using debt allocation: ${debtAmount.toLocaleString()}
                    </p>
                  </div>
                )}
              </div>

              {/* Current Category Allocation */}
              {currentCategory && (
                <div className={`p-6 rounded-lg border ${(shouldActivateSavings || shouldActivateDebt) ? 'bg-gray-100 dark:bg-gray-700 opacity-50' : 'bg-white dark:bg-gray-800'}`}>
                  <h3 className="text-xl font-semibold mb-4">
                    {currentCategory.emoji} {currentCategory.name}
                  </h3>
                  
                  {shouldActivateSavings ? (
                    <div className="text-center py-8">
                      <p className="text-gray-600 dark:text-gray-400 mb-4">
                        You have allocated all available funds. Use your savings to continue allocating.
                      </p>
                      <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
                        <p className="text-yellow-800 dark:text-yellow-200 font-semibold">
                          💰 Activate Emergency Savings
                        </p>
                        <p className="text-yellow-700 dark:text-yellow-300 text-sm">
                          Click below to use your savings for this allocation.
                        </p>
                      </div>
                    </div>
                  ) : shouldActivateDebt ? (
                    <div className="text-center py-8">
                      <p className="text-gray-600 dark:text-gray-400 mb-4">
                        You have allocated all available funds and exhausted your savings. Use debt to continue allocating.
                      </p>
                      <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                        <p className="text-red-800 dark:text-red-200 font-semibold">
                          💳 Activate Debt Allocation
                        </p>
                        <p className="text-red-700 dark:text-red-300 text-sm">
                          Click below to use debt for this allocation (1/2 monthly salary limit).
                        </p>
                      </div>
                    </div>
                  ) : remainingToAllocate <= 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-600 dark:text-gray-400">
                        You have allocated all available funds. This category will be set to $0.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="text-center">
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          You can allocate up to: ${remainingToAllocate.toLocaleString()}
                        </p>
                        <Slider
                          value={[currentAmount]}
                          onValueChange={(value) => setCurrentAmount(value[0])}
                          max={remainingToAllocate}
                          step={5}
                          className="w-full"
                        />
                        <p className="text-2xl font-bold mt-2">
                          ${currentAmount.toLocaleString()}
                        </p>
                      </div>
                      
                      {currentCategory.name === "Debt Repayment" && gameState.debt > 0 && (
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg">
                          <p className="text-sm text-yellow-800 dark:text-yellow-200">
                            💡 Tip: To avoid your debt growing, you should allocate at least ${gameState.costOfDebt.toLocaleString()} to cover the interest.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                  
                  <Button 
                    onClick={() => handleAllocationSubmit()}
                    className="w-full mt-4"
                    size="lg"
                    disabled={shouldActivateSavings || shouldActivateDebt}
                  >
                    Continue ➡️
                  </Button>
                </div>
              )}

              {/* Savings Allocation Section */}
              {shouldActivateSavings && (
                <div className="bg-green-50 dark:bg-green-900/20 p-6 rounded-lg border-2 border-green-300 dark:border-green-600">
                  <h3 className="text-xl font-semibold mb-4 text-green-800 dark:text-green-200">
                    💰 Emergency Savings Allocation
                  </h3>
                  
                  <div className="space-y-4">
                    <div className="text-center">
                      <p className="text-sm text-green-700 dark:text-green-300 mb-2">
                        Available from savings: ${gameState.savings.toLocaleString()}
                      </p>
                      <Slider
                        value={[savingsAmount]}
                        onValueChange={(value) => setSavingsAmount(value[0])}
                        max={gameState.savings}
                        step={5}
                        className="w-full"
                      />
                      <p className="text-2xl font-bold mt-2 text-green-800 dark:text-green-200">
                        ${savingsAmount.toLocaleString()}
                      </p>
                    </div>
                    
                    <div className="bg-white dark:bg-gray-800 p-3 rounded-lg">
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        <strong>Category:</strong> {currentCategory?.emoji} {currentCategory?.name}
                      </p>
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        <strong>Amount:</strong> ${savingsAmount.toLocaleString()}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex gap-3 mt-4">
                    {/* <Button 
                      onClick={() => {
                        setSavingsAmount(0)
                        setIsUsingSavings(false)
                        setSavingsExhausted(false)
                      }}
                      variant="outline"
                      className="flex-1"
                    >
                      Cancel
                    </Button> */}
                    <Button 
                      onClick={() => {
                        handleAllocationSubmit(savingsAmount, 'savings')
                      }}
                      className="flex-1"
                      size="lg"
                    >
                      Use Savings ➡️
                    </Button>
                  </div>
                </div>
              )}

              {/* Debt Allocation Section */}
              {shouldActivateDebt && (
                <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-lg border-2 border-red-300 dark:border-red-600">
                  <h3 className="text-xl font-semibold mb-4 text-red-800 dark:text-red-200">
                    💳 Debt Allocation
                  </h3>
                  
                  <div className="space-y-4">
                    <div className="text-center">
                      <p className="text-sm text-red-700 dark:text-red-300 mb-2">
                        Available from debt allocation: ${availableDebtAllocation.toLocaleString()}
                      </p>
                      <Slider
                        value={[debtAmount]}
                        onValueChange={(value) => setDebtAmount(value[0])}
                        max={availableDebtAllocation}
                        step={5}
                        className="w-full"
                      />
                      <p className="text-2xl font-bold mt-2 text-red-800 dark:text-red-200">
                        ${debtAmount.toLocaleString()}
                      </p>
                    </div>
                    
                    <div className="bg-white dark:bg-gray-800 p-3 rounded-lg">
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        <strong>Category:</strong> {currentCategory?.emoji} {currentCategory?.name}
                      </p>
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        <strong>Amount:</strong> ${debtAmount.toLocaleString()}
                      </p>
                    </div>
                    
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg">
                      <p className="text-sm text-yellow-700 dark:text-yellow-300">
                        ⚠️ This amount will be added to your debt with 15% APR interest.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex gap-3 mt-4">
                    <Button 
                      onClick={() => {
                        setDebtAmount(0)
                        setIsUsingDebt(false)
                      }}
                      variant="outline"
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={() => {
                        handleAllocationSubmit(debtAmount, 'debt')
                      }}
                      className="flex-1 bg-red-600 hover:bg-red-700"
                      size="lg"
                    >
                      Use Debt ➡️
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Summary Stage
  if (gameState.stage === 'summary') {
    const biweeklyHousing = gameState.housingCost / 2
    const biweeklyUtilities = gameState.utilityCost / 2
    const biweeklyFixedCosts = biweeklyHousing + biweeklyUtilities
    
    console.log('Debug - Summary costs:', {
      housingCost: gameState.housingCost,
      utilityCost: gameState.utilityCost,
      biweeklyHousing,
      biweeklyUtilities,
      biweeklyFixedCosts
    })
    
    // Use the same logic as budget allocation stage
    const currentPeriodIncome = gameState.iteration === 1 ? gameState.biweeklyIncome : gameState.currentBalance + gameState.biweeklyIncome
    const event = generateRandomEvent(gameState.biweeklyIncome || 0, gameState.iteration)
    
    // Calculate new balance
    let newBalance = currentPeriodIncome - biweeklyFixedCosts - gameState.allocatedAmount + (event?.adjustment || 0)
    let newDebt = gameState.debt
    let newSavings = gameState.savings
    
    // Handle debt repayment (already handled in allocation stage)
    if (gameState.allocations["Debt Repayment"]) {
      const debtPayment = gameState.allocations["Debt Repayment"].amount
      if (debtPayment > 0 && newDebt > 0) {
        newDebt = Math.max(0, newDebt - debtPayment)
      }
    }
    
    // If balance goes negative, use savings first, then create debt
    if (newBalance < 0) {
      const shortfall = Math.abs(newBalance)
      
      // Use savings first
      if (newSavings >= shortfall) {
        newSavings -= shortfall
        newBalance = 0
      } else {
        // If savings aren't enough, use all savings and create debt for the rest
        const remainingShortfall = shortfall - newSavings
        newSavings = 0
        newDebt += remainingShortfall
        newBalance = 0
      }
    }
    
    // Check if fixed costs exceeded income
    const discretionaryIncome = currentPeriodIncome - biweeklyFixedCosts - gameState.costOfDebt
    const fixedCostsExceededIncome = discretionaryIncome < 0
    const debtFromFixedCosts = fixedCostsExceededIncome ? Math.abs(discretionaryIncome) : 0
    
    // Add debt from fixed costs if they exceeded income (use savings first)
    if (debtFromFixedCosts > 0) {
      if (newSavings >= debtFromFixedCosts) {
        newSavings -= debtFromFixedCosts
      } else {
        const remainingDebt = debtFromFixedCosts - newSavings
        newSavings = 0
        newDebt += remainingDebt
      }
    }
    
    // Prepare pie chart data
    const pieChartData = [
      {
        label: "Housing",
        value: biweeklyHousing,
        color: "#8B5CF6",
        emoji: "🏠"
      },
      {
        label: "Utilities", 
        value: biweeklyUtilities,
        color: "#06B6D4",
        emoji: "⚡"
      },
      ...Object.entries(gameState.allocations)
        .filter(([_, data]) => data.amount > 0)
        .map(([category, data], index) => ({
          label: category,
          value: data.amount,
          color: `hsl(${(index * 137.5) % 360}, 70%, 60%)`,
          emoji: data.emoji
        }))
    ]
    

    
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
        <div className="max-w-4xl mx-auto pt-10">
          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle className="text-2xl font-bold">
                📊 Round {gameState.iteration} Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Budget Breakdown */}
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-semibold text-lg">💰 Budget Breakdown</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded">
                      <span>🏠 Housing</span>
                      <span className="font-semibold">${(gameState.housingCost / 2).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded">
                      <span>⚡ Utilities</span>
                      <span className="font-semibold">${(gameState.utilityCost / 2).toLocaleString()}</span>
                    </div>
                    {Object.entries(gameState.allocations).map(([category, data]) => (
                      <div key={category} className="flex justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded">
                        <span>{data.emoji} {category}</span>
                        <span className="font-semibold">${data.amount.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="space-y-4">
                  <h4 className="font-semibold text-lg">📈 Financial Summary</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
                      <span>💵 Bi-weekly Income</span>
                      <span className="font-semibold">${gameState.biweeklyIncome.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-red-50 dark:bg-red-900/20 rounded">
                      <span>💸 Total Expenses</span>
                      <span className="font-semibold">${(biweeklyFixedCosts + gameState.allocatedAmount).toLocaleString()}</span>
                    </div>
                    {gameState.debt > 0 && (
                      <div className="flex justify-between p-2 bg-orange-50 dark:bg-orange-900/20 rounded">
                        <span>💳 Debt Interest</span>
                        <span className="font-semibold">${gameState.costOfDebt.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Pie Chart Visualization */}
              <PieChart 
                data={pieChartData}
                title={`Round ${gameState.iteration} Spending Breakdown`}
              />

              {/* Random Event */}
              {event && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
                  <h4 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
                    🎲 Random Event!
                  </h4>
                  <p className="text-yellow-700 dark:text-yellow-300 font-semibold">
                    {event.message || "A random event occurred!"}
                  </p>
                  <p className="text-yellow-700 dark:text-yellow-300">
                    Impact on your budget: ${(event.adjustment || 0).toLocaleString()}
                  </p>
                </div>
              )}

              {/* Final Balance */}
              <div className={`p-4 rounded-lg ${newBalance >= 0 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                <h4 className={`font-semibold mb-2 ${newBalance >= 0 ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}`}>
                  {newBalance >= 0 ? '✨ Remaining Balance' : '⚠️ Deficit'}
                </h4>
                <p className={`text-2xl font-bold ${newBalance >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                  ${newBalance.toLocaleString()}
                </p>
                {newBalance < 0 && (
                  <p className="text-red-700 dark:text-red-300 text-sm mt-2">
                    This amount has been added to your debt.
                  </p>
                )}
              </div>

              {/* Savings Status */}
              {newSavings > 0 && (
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                  <h4 className="font-semibold text-green-800 dark:text-green-200 mb-2">
                    💰 Emergency Savings
                  </h4>
                  <p className="text-green-700 dark:text-green-300">
                    Current savings: ${newSavings.toLocaleString()}
                  </p>
                  <p className="text-green-700 dark:text-green-300 text-sm">
                    This will be used automatically if you run out of money.
                  </p>
                </div>
              )}

              {/* Debt Status */}
              {newDebt > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                  <h4 className="font-semibold text-red-800 dark:text-red-200 mb-2">
                    💸 Debt Status
                  </h4>
                  <p className="text-red-700 dark:text-red-300">
                    Total debt: ${newDebt.toLocaleString()}
                  </p>
                  {debtFromFixedCosts > 0 && (
                    <p className="text-red-700 dark:text-red-300 text-sm">
                      ${debtFromFixedCosts.toLocaleString()} was added because your fixed costs exceeded your income.
                    </p>
                  )}
                  <p className="text-red-700 dark:text-red-300 text-sm">
                    Your debt will accrue 15% APR interest until paid off.
                  </p>
                </div>
              )}

              {/* Expert Advice - Auto-triggered */}
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">
                  🧠 Expert Analysis
                  {isLoadingAdvice && <span className="text-xs ml-2">(Auto-generating...)</span>}
                </h4>
                {isLoadingAdvice ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    <p className="text-blue-700 dark:text-blue-300">Analyzing your spending patterns...</p>
                  </div>
                ) : expertAdvice ? (
                  <div>
                    <div className="text-blue-700 dark:text-blue-300 whitespace-pre-line mb-3">
                      {expertAdvice}
                    </div>
                    <Button 
                      onClick={() => fetchExpertAdvice(newBalance < 0)}
                      size="sm"
                      variant="outline"
                      className="text-xs"
                    >
                      🔄 Get New Analysis
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    <p className="text-blue-700 dark:text-blue-300">Loading expert analysis...</p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4">
                {gameState.iteration < 12 ? (
                  <Button 
                    onClick={handleNextPeriod}
                    className="flex-1"
                    size="lg"
                  >
                    ➡️ Next Period
                  </Button>
                ) : (
                  <Button 
                    onClick={resetGame}
                    className="flex-1"
                    size="lg"
                  >
                    🎉 Play Again
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Game Over Stage
  if (gameState.stage === 'game_over') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
        <div className="max-w-2xl mx-auto pt-20">
          <Card className="shadow-xl text-center">
            <CardHeader>
              <CardTitle className="text-3xl font-bold text-green-600 dark:text-green-400">
                🎉 Congratulations!
              </CardTitle>
              <CardDescription className="text-lg">
                You've completed the 6-month budget simulation!
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-green-50 dark:bg-green-900/20 p-6 rounded-lg">
                <h4 className="font-semibold text-green-800 dark:text-green-200 mb-4">
                  🏆 Final Results
                </h4>
                <div className="space-y-2">
                  <p>Location: {gameState.location}</p>
                  <p>Starting Salary: ${gameState.grossMonthlySalary.toLocaleString()}/month</p>
                  <p>Final Balance: ${gameState.currentBalance.toLocaleString()}</p>
                  {gameState.savings > 0 && (
                    <p className="text-green-600 dark:text-green-400">
                      Final Savings: ${gameState.savings.toLocaleString()}
                    </p>
                  )}
                  {gameState.debt > 0 ? (
                    <p className="text-red-600 dark:text-red-400">
                      Final Debt: ${gameState.debt.toLocaleString()}
                    </p>
                  ) : (
                    <p className="text-green-600 dark:text-green-400">
                      🎉 You managed to avoid debt!
                    </p>
                  )}
                </div>
              </div>

              {/* Final Expert Advice */}
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">
                  🧠 Final Expert Analysis
                </h4>
                {isLoadingAdvice ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    <p className="text-blue-700 dark:text-blue-300">Getting final advice...</p>
                  </div>
                ) : expertAdvice ? (
                  <div className="text-blue-700 dark:text-blue-300 whitespace-pre-line">
                    {expertAdvice}
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <p className="text-blue-700 dark:text-blue-300">
                      Get final analysis of your 6-month budget journey
                    </p>
                    <Button 
                      onClick={() => fetchExpertAdvice(true)}
                      size="sm"
                      variant="outline"
                    >
                      Get Final Advice
                    </Button>
                  </div>
                )}
              </div>
              
              <Button 
                onClick={resetGame}
                className="w-full"
                size="lg"
              >
                🔄 Play Again
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return null
} 