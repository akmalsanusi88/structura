
'use server';
/**
 * @fileOverview An AI flow for predicting construction project cost overruns.
 *
 * - costOverrunPrediction - A function that handles the cost prediction process.
 */

import {ai} from '@/ai/genkit';
import {
    CostOverrunPredictionInputSchema,
    CostOverrunPredictionOutputSchema,
    type CostOverrunPredictionInput,
    type CostOverrunPredictionOutput
} from '@/ai/types/cost-prediction-types';


export async function costOverrunPrediction(input: CostOverrunPredictionInput): Promise<CostOverrunPredictionOutput> {
  return costOverrunFlow(input);
}

const prompt = ai.definePrompt({
  name: 'costOverrunPrompt',
  input: {schema: CostOverrunPredictionInputSchema},
  output: {schema: CostOverrunPredictionOutputSchema},
  prompt: `You are an expert construction project cost analyst. Your task is to predict potential cost overruns or savings for a new project based on the provided data. Analyze the project parameters, historical data, and market conditions to make your prediction.

Provide a quantitative prediction for the cost variance. Also, provide a confidence level for your prediction.

Finally, summarize the key factors that led to your prediction and provide actionable recommendations.

Project Parameters:
{{{projectParameters}}}

Historical Data from Similar Projects:
{{{historicalData}}}

Current Market Conditions:
{{{marketConditions}}}
`,
});

const costOverrunFlow = ai.defineFlow(
  {
    name: 'costOverrunFlow',
    inputSchema: CostOverrunPredictionInputSchema,
    outputSchema: CostOverrunPredictionOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    return output!;
  }
);
