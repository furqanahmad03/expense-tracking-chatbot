export const LOCATION_COST_PROMPT = (location: string) => `As a cost of living expert, provide the following information for ${location}:
1. Average monthly housing cost (rent/mortgage) in USD
2. Average monthly utility costs (electricity, water, gas) in USD 
3. Typical income tax rate as a percentage (federal + state + local)

Return ONLY a JSON object with these three values as numbers (no text, no symbols, just numbers):
{
    "housing_cost": [housing cost number],
    "utility_cost": [utility cost number],
    "tax_rate": [tax rate percentage]
}`

export const EXPERT_ADVICE_PROMPT = (
  location: string, 
  monthlySalary: number, 
  allocations: Record<string, { amount: number; emoji: string }>, 
  iteration: number, 
  isGameOver: boolean = false
) => {
  const allocationText = Object.entries(allocations)
    .map(([cat, data]) => `- ${cat}: $${data.amount.toLocaleString()}`)
    .join('\n')

  if (isGameOver) {
    return `As a professional cost of living expert, analyze this failed budget allocation for someone living in ${location} 
with a monthly salary of $${monthlySalary.toLocaleString()}. The user's budget went negative in iteration ${iteration}.

Their last bi-weekly budget allocation was:
${allocationText}

Please provide:
1. Analysis of what went wrong
2. 3 specific suggestions for better budget management next time
3. Key lessons to learn from this experience

Keep the response encouraging and constructive.`
  } else {
    return `As a professional cost of living expert, analyze this budget allocation for someone living in ${location} 
with a monthly salary of $${monthlySalary.toLocaleString()}. This is iteration ${iteration} of their 6-month budget planning.

Current bi-weekly budget allocation:
${allocationText}

Please provide:
1. Brief analysis of their spending patterns
2. 2-3 specific suggestions for improvement based on typical costs in ${location}
3. Any potential risks or opportunities in their current allocation

Keep the response concise and practical.`
  }
}

export const SYSTEM_PROMPTS = {
  locationCost: "You are a cost of living data expert. Respond only with the requested JSON.",
  expertAdvice: "You are a professional cost of living and budgeting expert."
} 