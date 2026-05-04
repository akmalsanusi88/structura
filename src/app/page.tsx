import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Logo } from '@/components/icons';
import { ArrowRight, BarChart2, Briefcase, DollarSign } from 'lucide-react';
import Image from 'next/image';
import SplitText from '@/components/ui/split-text';

export default function LandingPage() {
  return (
    <div className="relative flex flex-col min-h-screen bg-background">
       {/* Background Image */}
       <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('https://images.unsplash.com/photo-1534229995593-3a304f3d4346?q=80&w=1974&auto=format&fit=crop')",
        }}
        data-ai-hint="abstract architecture"
      >
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm"></div>
      </div>

       {/* Content Wrapper */}
       <div className="relative z-10 flex flex-col min-h-screen">

        {/* Header */}
        <header className="container mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo className="w-8 h-8 text-primary" />
            <h1 className="text-2xl font-bold font-headline">Structura</h1>
          </div>
          <Link href="/login">
            <Button>
              Enter App <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </header>

        {/* Main Content */}
        <main className="flex-1">
          {/* Hero Section */}
          <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32 text-center">
            <div className="max-w-3xl mx-auto">
              <SplitText text="Build Smarter, Not Harder." className="text-4xl font-extrabold tracking-tight font-headline sm:text-5xl md:text-6xl" />
              <p className="mt-6 text-lg text-muted-foreground">
                Structura is the all-in-one platform to manage your construction projects from budget planning to final close-out, powered by intelligent insights.
              </p>
              <div className="mt-8">
                <Link href="/login">
                  <Button size="lg">
                    Get Started
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
              </div>
            </div>
          </section>

          {/* Features Section */}
          <section className="bg-background/50 py-20">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center mb-12">
                <h3 className="text-3xl font-bold font-headline">A New Era of Project Management</h3>
                <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
                  Track every detail, optimize resources, and ensure profitability with our integrated modules.
                </p>
              </div>
              <div className="grid gap-8 md:grid-cols-3">
                <Card className="bg-background/80">
                  <CardHeader className="items-center">
                    <div className="bg-primary/10 p-3 rounded-full mb-4">
                      <DollarSign className="h-8 w-8 text-primary" />
                    </div>
                    <CardTitle className="font-headline">Budget & Cost Control</CardTitle>
                  </CardHeader>
                  <CardContent className="text-center text-muted-foreground text-sm">
                    From initial BOQ to final claims, keep your project financials transparent and under control.
                  </CardContent>
                </Card>
                <Card className="bg-background/80">
                  <CardHeader className="items-center">
                    <div className="bg-primary/10 p-3 rounded-full mb-4">
                      <Briefcase className="h-8 w-8 text-primary" />
                    </div>
                    <CardTitle className="font-headline">Implementation Tracking</CardTitle>
                  </CardHeader>
                  <CardContent className="text-center text-muted-foreground text-sm">
                    Log daily activities, manage site instructions, and track material usage against your purchase orders.
                  </CardContent>
                </Card>
                <Card className="bg-background/80">
                  <CardHeader className="items-center">
                    <div className="bg-primary/10 p-3 rounded-full mb-4">
                      <BarChart2 className="h-8 w-8 text-primary" />
                    </div>
                    <CardTitle className="font-headline">AI-Powered Reports</CardTitle>
                  </CardHeader>
                  <CardContent className="text-center text-muted-foreground text-sm">
                    Gain actionable insights with comprehensive dashboards and predictive cost forecasting.
                  </CardContent>
                </Card>
              </div>
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer className="bg-background/50">
            <div className="container mx-auto py-6 px-4 sm:px-6 lg:px-8 text-center text-muted-foreground text-sm">
                <p>&copy; {new Date().getFullYear()} Structura. All Rights Reserved.</p>
            </div>
        </footer>
      </div>
    </div>
  );
}
