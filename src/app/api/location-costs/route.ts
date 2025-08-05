import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { LOCATION_COST_PROMPT, SYSTEM_PROMPTS } from '@/lib/prompts'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const { location } = await request.json()

    if (!location) {
      return NextResponse.json(
        { error: 'Location is required' },
        { status: 400 }
      )
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      )
    }

    const prompt = LOCATION_COST_PROMPT(location)

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: SYSTEM_PROMPTS.locationCost },
        { role: "user", content: prompt }
      ],
      max_tokens: 150,
      temperature: 0.3
    })

    const responseText = response.choices[0].message.content?.trim()
    
    if (!responseText) {
      throw new Error('No response from OpenAI')
    }

    // Clean the response if there are markdown code blocks
    let cleanedResponse = responseText
    if (cleanedResponse.startsWith("```") && cleanedResponse.endsWith("```")) {
      cleanedResponse = cleanedResponse.slice(3, -3).trim()
    }
    if (cleanedResponse.startsWith("```json") && cleanedResponse.endsWith("```")) {
      cleanedResponse = cleanedResponse.slice(7, -3).trim()
    }

    const data = JSON.parse(cleanedResponse)

    // Validate the response structure
    if (!data.housing_cost || !data.utility_cost || !data.tax_rate) {
      throw new Error('Invalid response structure from OpenAI')
    }

    return NextResponse.json(data)

  } catch (error) {
    console.error('Error getting location costs:', error)
    
    // Return default values if API call fails
    return NextResponse.json({
      housing_cost: 1200,
      utility_cost: 200,
      tax_rate: 25
    })
  }
} 