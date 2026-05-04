
"use server";

import { costOverrunPrediction } from "@/ai/flows/cost-overrun-prediction";
import type { CostOverrunPredictionInput, CostOverrunPredictionOutput } from "@/ai/types/cost-prediction-types";

export async function getCostPrediction(
  input: CostOverrunPredictionInput
): Promise<CostOverrunPredictionOutput> {
  try {
    const result = await costOverrunPrediction(input);
    return result;
  } catch (error) {
    console.error("Error in AI Cost Prediction:", error);
    throw new Error("Failed to get cost prediction from AI model.");
  }
}
