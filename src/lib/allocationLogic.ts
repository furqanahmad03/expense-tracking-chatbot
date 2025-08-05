export interface AllocationState {
  currentAmount: number
  savingsAmount: number
  debtAmount: number
  isUsingSavings: boolean
  isUsingDebt: boolean
  savingsExhausted: boolean
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
  iterationHistory: any[]
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

  return { newGameState, newSavings, newDebt }
}

// Determine which allocation mode should be active
export function determineAllocationMode(
  gameState: GameState,
  remainingToAllocate: number,
  savingsExhausted: boolean = false
): 'normal' | 'savings' | 'debt' | null {
  // If user has money to allocate, use normal mode
  if (remainingToAllocate > 0) {
    return 'normal'
  }

  // If no money left but has savings and savings are not exhausted, use savings mode
  if (gameState.savings > 0 && !savingsExhausted) {
    return 'savings'
  }

  // If no money and (no savings OR savings exhausted), use debt mode (up to 1/2 monthly salary)
  const availableDebtAllocation = gameState.monthlySalary / 2
  if (availableDebtAllocation > 0) {
    return 'debt'
  }

  return null
}

// Calculate available debt allocation
export function getAvailableDebtAllocation(gameState: GameState): number {
  return gameState.monthlySalary / 2
} 