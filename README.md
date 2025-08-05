# 🎮 Cost of Living Game

A modern, interactive budget simulation game built with Next.js and shadcn/ui components. Learn to manage your finances in a realistic 6-month simulation with random events and debt management.

## Features

- **💰 Realistic Budget Simulation**: 6-month simulation with bi-weekly pay periods
- **🏠 AI-Powered Location Costs**: Dynamic housing and utility costs using OpenAI API
- **🧠 Expert Financial Advice**: AI-generated personalized budget advice and analysis
- **📊 Interactive Budget Allocation**: Allocate funds across 9 different spending categories
- **🎲 Random Events**: Unexpected expenses and windfalls to test your financial resilience
- **💳 Debt Management**: Realistic debt accumulation with 15% APR interest
- **💰 Emergency Savings System**: Build and use emergency funds strategically
- **📈 Progress Tracking**: Visual progress indicators and detailed financial summaries
- **🎨 Modern UI**: Beautiful, responsive design with dark mode support

## Game Flow

1. **Salary Input**: Enter your gross monthly income
2. **Location Selection**: Choose your location for cost of living estimates
3. **Budget Allocation**: Allocate discretionary funds across spending categories
4. **Round Summary**: See results with random events and balance updates
5. **Next Period**: Continue through 12 rounds (6 months) of simulation

## Spending Categories

- 🚗 Transportation (Public Transit, Gas, Car Maintenance)
- 🛒 Groceries
- 🍽️ Dining Out
- 🏥 Healthcare (Insurance, Medical Expenses)
- 🎮 Entertainment (Leisure, Subscriptions, Events)
- 📱 Internet and Phone Bills
- 🛍️ Miscellaneous (Clothing, Personal Care, Household Items)
- 💰 Savings & Emergency Fund
- 💳 Debt Repayment

## Technology Stack

- **Framework**: Next.js 14 with App Router
- **UI Components**: shadcn/ui
- **Styling**: Tailwind CSS
- **Language**: TypeScript
- **State Management**: React useState

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- OpenAI API key (for AI features)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd living-chatbot
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
# Create .env.local file
cp .env.local.example .env.local

# Add your OpenAI API key to .env.local
OPENAI_API_KEY=your_openai_api_key_here
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

### Building for Production

```bash
npm run build
npm start
```

## Game Mechanics

### Income Calculation
- Gross monthly income is provided by the user
- Tax rate is determined by location using AI analysis
- Net monthly income = Gross × (1 - Tax Rate)
- Bi-weekly income = Net monthly ÷ 2

### Fixed Costs
- Housing and utilities are automatically deducted
- These costs are based on AI-generated location estimates
- Fixed costs are non-negotiable in the simulation

### Discretionary Spending
- Remaining funds after fixed costs are available for allocation
- Users allocate funds across 9 spending categories
- Unallocated funds carry over to the next period

### Random Events
- Unexpected expenses (car repairs, medical bills)
- Windfalls (bonuses, refunds, found money)
- Events affect the final balance for each period

### Debt Management
- Negative balances automatically create debt
- Debt accrues 15% APR interest monthly
- Debt repayment category allows paying down debt
- Interest is calculated bi-weekly

### Emergency Savings System
- Allocate funds to "Savings & Emergency Fund" category
- Savings are used automatically when you run out of money
- Excess debt repayment goes to savings if no debt exists
- Provides a financial safety net during the simulation

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is open source and available under the [MIT License](LICENSE).

## AI Features

### Location Cost Estimates
- Uses OpenAI GPT-3.5-turbo to analyze cost of living data
- Provides realistic housing, utility, and tax rate estimates
- Falls back to default values if API is unavailable

### Expert Financial Advice
- AI-generated personalized budget analysis
- Context-aware advice based on spending patterns
- Special guidance for debt management and financial planning
- Available at the end of each round and game completion

## Future Enhancements

- [ ] More detailed financial advice and tips
- [ ] Export functionality for budget summaries
- [ ] Multiple difficulty levels
- [ ] Achievement system
- [ ] Social sharing of results
- [ ] Historical budget tracking
- [ ] Investment simulation features
