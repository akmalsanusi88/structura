
/**
 * @fileOverview Defines the data structures for the AI cost prediction flow.
 */
import { z } from 'zod';

export const CostOverrunPredictionInputSchema = z.object({
  projectParameters: z.string().describe('Detailed parameters of the project including size, location, complexity, timeline, and quality standards.'),
  historicalData: z.string().describe('A summary of historical data from similar past projects, including final costs versus budget, unexpected issues, and team performance.'),
  marketConditions: z.string().describe('Current market conditions including material costs, labor availability and rates, inflation, and known supply chain issues.'),
});
export type CostOverrunPredictionInput = z.infer<typeof CostOverrunPredictionInputSchema>;

export const CostOverrunPredictionOutputSchema = z.object({
  predictedCostVariance: z.number().describe('The predicted cost variance in the project currency. A positive number indicates a cost overrun, while a negative number indicates a saving.'),
  confidenceLevel: z.number().min(0).max(1).describe('The confidence level of the prediction, from 0.0 to 1.0.'),
  keyFactors: z.string().describe('A summary of the key factors influencing the prediction.'),
  recommendations: z.string().describe('Actionable recommendations to mitigate potential cost overruns or capitalize on savings.'),
});
export type CostOverrunPredictionOutput = z.infer<typeof CostOverrunPredictionOutputSchema>;
