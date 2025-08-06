export interface AllocationState {
  currentAmount: number
  savingsAmount: number
  debtAmount: number
  isUsingSavings: boolean
  isUsingDebt: boolean
  savingsExhausted: boolean
}

export interface IterationHistoryItem {
  iteration: number
  balance: number
  allocations: Record<string, { amount: number; emoji: string }>
  debt: number
  savings: number
  randomEvent?: {
    message: string
    adjustment: number
  }
}

export interface GameState {
  stage: 'salary' | 'location' | 'budget_allocation' | 'summary' | 'game_over'
  grossMonthlySalary: number
  monthlySalary: number
  location: string
  biweeklyIncome: number
  currentBalance: number
  iteration: number
  currentCategoryIndex: number
  allocations: Record<string, { amount: number; emoji: string }>
  allocatedAmount: number
  debt: number
  costOfDebt: number
  savings: number
  housingCost: number
  utilityCost: number
  taxRate: number
  iterationHistory: IterationHistoryItem[]
}

export interface BudgetAllocation {
  amount: number
  emoji: string
}

// Normal allocation mode - user has money to allocate
export function handleNormalAllocation(
  gameState: GameState,
  currentAmount: number,
  category: string,
  emoji: string
): { newGameState: GameState; newSavings: number; newDebt: number } {
  const newGameState = {
    ...gameState,
    allocations: {
      ...gameState.allocations,
      [category]: { amount: currentAmount, emoji }
    },
    allocatedAmount: gameState.allocatedAmount + currentAmount
  }

  let newSavings = gameState.savings
  let newDebt = gameState.debt

  // Handle savings allocation
  if (category === "Savings & Emergency Fund") {
    newSavings += currentAmount
  }

  // Handle debt repayment
  if (category === "Debt Repayment") {
    if (currentAmount > 0 && newDebt > 0) {
      if (currentAmount >= newDebt) {
        // Pay off all debt, excess goes to savings
        const excess = currentAmount - newDebt
        newSavings += excess
        newDebt = 0
      } else {
        // Pay off partial debt
        newDebt -= currentAmount
      }
    } else if (currentAmount > 0 && newDebt === 0) {
      // No debt to pay, amount goes to savings
      newSavings += currentAmount
    }
  }

  return { newGameState, newSavings, newDebt }
}

// Savings allocation mode - user is using savings to allocate
export function handleSavingsAllocation(
  gameState: GameState,
  savingsAmount: number,
  category: string,
  emoji: string
): { newGameState: GameState; newSavings: number; newDebt: number; savingsExhausted: boolean } {
  const newGameState = {
    ...gameState,
    allocations: {
      ...gameState.allocations,
      [category]: { amount: savingsAmount, emoji }
    },
    allocatedAmount: gameState.allocatedAmount + savingsAmount
  }

  let newSavings = gameState.savings - savingsAmount
  let newDebt = gameState.debt
  let savingsExhausted = newSavings <= 0

  // If we used more than available savings, create debt
  if (savingsAmount > gameState.savings) {
    const excess = savingsAmount - gameState.savings
    newSavings = 0
    newDebt += excess
    savingsExhausted = true
  }

  return { newGameState, newSavings, newDebt, savingsExhausted }
}

// Debt allocation mode - user is using debt to allocate
export function handleDebtAllocation(
  gameState: GameState,
  debtAmount: number,
  category: string,
  emoji: string
): { newGameState: GameState; newSavings: number; newDebt: number } {
  const newGameState = {
    ...gameState,
    allocations: {
      ...gameState.allocations,
      [category]: { amount: debtAmount, emoji }
    },
    allocatedAmount: gameState.allocatedAmount + debtAmount
  }

  const newSavings = gameState.savings
  const newDebt = gameState.debt + debtAmount

  console.log('Debug - handleDebtAllocation:', {
    newGameState,
    newSavings,
    newDebt
  });

  return { newGameState, newSavings, newDebt }
}

// Determine which allocation mode should be active
export function determineAllocationMode(
  gameState: GameState,
  remainingToAllocate: number,
  debtUsedThisRound: number,
  savingsExhausted: boolean = false,
): 'normal' | 'savings' | 'debt' | null {
  console.log('Debug - determineAllocationMode:', {
    remainingToAllocate,
    savingsExhausted,
    debtUsedThisRound,
    gameStateSavings: gameState.savings,
    monthlySalary: gameState.monthlySalary
  })

  // If user has money to allocate, use normal mode
  if (remainingToAllocate > 0) {
    console.log('Debug - Returning normal mode')
    return 'normal'
  }

  // If no money left but has savings and savings are not exhausted, use savings mode
  if (gameState.savings > 0 && !savingsExhausted) {
    console.log('Debug - Returning savings mode')
    return 'savings'
  }

  // If no money and (no savings OR savings exhausted), use debt mode (up to 1/4 monthly salary per round)
  const maxDebtAllocation = gameState.monthlySalary / 4
  const availableDebtAllocation = Math.max(0, maxDebtAllocation - debtUsedThisRound)
  console.log('Debug - Debt mode check:', {
    maxDebtAllocation,
    availableDebtAllocation
  })
  
  if (availableDebtAllocation > 0) {
    console.log('Debug - Returning debt mode')
    return 'debt'
  }

  console.log('Debug - Returning null (no mode available)')
  return null
}

// Calculate available debt allocation
export function getAvailableDebtAllocation(gameState: GameState, debtUsedThisRound: number = 0): number {
  // Since we're working with bi-weekly periods, the debt limit should be 1/4 of monthly salary per round
  // This ensures that over two rounds (one month), the total debt limit is 1/2 of monthly salary
  const maxDebtAllocation = gameState.monthlySalary / 4
  return Math.max(0, maxDebtAllocation - debtUsedThisRound)
} 