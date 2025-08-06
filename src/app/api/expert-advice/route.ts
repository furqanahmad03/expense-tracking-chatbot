import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { EXPERT_ADVICE_PROMPT, SYSTEM_PROMPTS } from '@/lib/prompts'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const { 
      location, 
      monthlySalary, 
      allocations, 
      iteration, 
      isGameOver = false,
      locale = 'en'
    } = await request.json()

    if (!location || !monthlySalary || !allocations || !iteration) {
      return NextResponse.json(
        { error: 'Missing required fields: location, monthlySalary, allocations, iteration' },
        { status: 400 }
      )
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      )
    }

    const prompt = EXPERT_ADVICE_PROMPT(
      location, 
      monthlySalary, 
      allocations, 
      iteration, 
      isGameOver,
      locale
    )

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: SYSTEM_PROMPTS.expertAdvice },
        { role: "user", content: prompt }
      ],
      max_tokens: 400,
      temperature: 0.7
    })

    const advice = response.choices[0].message.content?.trim()
    
    if (!advice) {
      throw new Error('No response from OpenAI')
    }

    return NextResponse.json({ advice })

  } catch (error) {
    console.error('Error getting expert advice:', error)
    
    // Return a fallback message if API call fails
    return NextResponse.json({
      advice: "Unable to get expert advice at this time. Please continue with your budget planning."
    })
  }
} 