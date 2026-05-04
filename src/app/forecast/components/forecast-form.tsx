
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useState } from 'react';
import type { CostOverrunPredictionOutput } from '@/ai/types/cost-prediction-types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal, Sparkles, DollarSign, BarChart, Lightbulb, TrendingDown, TrendingUp, AlertCircle, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const forecastSchema = z.object({
  projectParameters: z.string().min(10, 'Please provide detailed project parameters.'),
  historicalData: z.string().min(10, 'Please provide a summary of historical data.'),
  marketConditions: z.string().min(10, 'Please provide an overview of market conditions.'),
});

type ForecastFormValues = z.infer<typeof forecastSchema>;

type ForecastFormProps = {
    getCostPrediction: (values: ForecastFormValues) => Promise<CostOverrunPredictionOutput>;
};

export default function ForecastForm({ getCostPrediction }: ForecastFormProps) {
  const [prediction, setPrediction] = useState<CostOverrunPredictionOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<ForecastFormValues>({
    resolver: zodResolver(forecastSchema),
    defaultValues: {
      projectParameters: '',
      historicalData: '',
      marketConditions: '',
    },
  });

  const onSubmit = async (data: ForecastFormValues) => {
    setIsLoading(true);
    setPrediction(null);
    setError(null);
    try {
      const result = await getCostPrediction(data);
      setPrediction(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-MY', {
      style: 'currency',
      currency: 'MYR',
      minimumFractionDigits: 2,
    }).format(amount);
  };
  
  const PredictionResult = () => {
    if (isLoading) {
        return (
            <Card className="lg:col-span-2">
                <CardHeader>
                    <Skeleton className='h-8 w-1/2' />
                    <Skeleton className='h-4 w-3/4' />
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                        <Skeleton className='h-24 w-full' />
                        <Skeleton className='h-24 w-full' />
                    </div>
                    <Skeleton className='h-32 w-full' />
                    <Skeleton className='h-32 w-full' />
                </CardContent>
            </Card>
        )
    }

    if(error) {
        return (
            <Alert variant="destructive" className="lg:col-span-2">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        )
    }

    if(!prediction) {
        return (
             <Card className="lg:col-span-2 flex flex-col items-center justify-center text-center p-8 border-dashed">
                <Sparkles className="h-16 w-16 text-muted-foreground/50 mb-4" />
                <h3 className="text-xl font-semibold font-headline text-muted-foreground">Ready for Insights?</h3>
                <p className="text-muted-foreground mt-2">
                    Fill out the form to get your AI-powered cost forecast.
                </p>
            </Card>
        )
    }

    const isOverrun = prediction.predictedCostVariance > 0;

    return (
        <Card className="lg:col-span-2">
            <CardHeader>
                <CardTitle className='font-headline text-2xl'>Forecast Result</CardTitle>
                <CardDescription>AI-generated cost prediction analysis.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                    <Card className={isOverrun ? 'bg-red-50 dark:bg-red-900/20' : 'bg-green-50 dark:bg-green-900/20'}>
                        <CardHeader className='flex-row items-center justify-between pb-2'>
                            <CardTitle className='text-sm font-medium'>Predicted Variance</CardTitle>
                            {isOverrun ? <TrendingUp className="h-4 w-4 text-red-600 dark:text-red-400" /> : <TrendingDown className="h-4 w-4 text-green-600 dark:text-green-400" />}
                        </CardHeader>
                        <CardContent>
                            <div className={`text-2xl font-bold ${isOverrun ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                {formatCurrency(prediction.predictedCostVariance)}
                            </div>
                            <p className='text-xs text-muted-foreground'>{isOverrun ? 'Potential Overrun' : 'Potential Savings'}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className='flex-row items-center justify-between pb-2'>
                            <CardTitle className='text-sm font-medium'>Confidence Level</CardTitle>
                            <BarChart className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-primary">
                                {(prediction.confidenceLevel * 100).toFixed(0)}%
                            </div>
                            <p className='text-xs text-muted-foreground'>Prediction confidence</p>
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader className='flex-row items-center gap-4 space-y-0'>
                        <Lightbulb className='h-6 w-6 text-accent' />
                        <CardTitle className='text-lg font-semibold font-headline'>Key Factors</CardTitle>
                    </CardHeader>
                    <CardContent className='pt-2 pl-12'>
                        <p className='text-sm text-muted-foreground'>{prediction.keyFactors}</p>
                    </CardContent>
                </Card>

                 <Card>
                    <CardHeader className='flex-row items-center gap-4 space-y-0'>
                        <Terminal className='h-6 w-6 text-accent' />
                        <CardTitle className='text-lg font-semibold font-headline'>Recommendations</CardTitle>
                    </CardHeader>
                    <CardContent className='pt-2 pl-12'>
                         <p className='text-sm text-muted-foreground'>{prediction.recommendations}</p>
                    </CardContent>
                </Card>
            </CardContent>
        </Card>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="font-headline text-2xl">Project Data</CardTitle>
          <CardDescription>
            Provide the necessary data for the AI to analyze. The more detailed, the better the prediction.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="projectParameters"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project Parameters</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe project size, location, complexity, timeline, quality standards, etc."
                        className="min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="historicalData"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Historical Data</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Summarize past similar projects: final costs vs. budget, unexpected issues, team performance."
                        className="min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="marketConditions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Market Conditions</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Current material costs (steel, concrete), labor availability and rates, inflation, and any known supply chain issues."
                        className="min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Get Forecast
                  </>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
      
      <PredictionResult />
    </div>
  );
}
