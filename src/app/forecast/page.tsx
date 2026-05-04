// This is a server component by default
import Header from "@/components/layout/header";
import { getCostPrediction } from "./actions";
import ForecastForm from "./components/forecast-form";

export default function ForecastPage() {
  return (
    <div className="flex flex-col h-full">
      <Header title="AI Cost Forecast" />
      <main className="flex-1 p-4 md:p-6">
        <ForecastForm getCostPrediction={getCostPrediction} />
      </main>
    </div>
  );
}
