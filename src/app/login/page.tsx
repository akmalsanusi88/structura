
'use client';

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { login } from './actions'
import { Logo } from '@/components/icons'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card"
import { ArrowLeft, Loader2 } from 'lucide-react'
import Image from 'next/image'
import React, { useActionState, useEffect, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { useToast } from '@/hooks/use-toast'
import { useSearchParams } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'

function LoginButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" isPending={pending}>
       Login
    </Button>
  );
}

// This component now handles the client-side logic
function LoginForm() {
  const [state, formAction] = useActionState(login, undefined);
  const { toast } = useToast();
  const searchParams = useSearchParams();

  useEffect(() => {
    const message = searchParams.get('message');
    if (message) {
      toast({
        title: "Authentication Error",
        description: message,
        variant: "destructive",
      });
    }
  }, [searchParams, toast]);

  return (
    <Card className="mx-auto w-full max-w-sm">
        <CardHeader className="text-center">
            <div className='mb-4 flex justify-center items-center gap-2'>
                <Logo className="w-8 h-8 text-primary" />
                <h1 className="text-3xl font-bold font-headline">
                    Structura
                </h1>
            </div>
            <CardTitle className="text-2xl">Login</CardTitle>
            <CardDescription>
            Enter your email below to login to your account
            </CardDescription>
        </CardHeader>
        <CardContent>
            <form action={formAction} className="grid gap-4">
                <div className="grid gap-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                    id="email"
                    type="email"
                    name="email"
                    placeholder="m@example.com"
                    required
                    />
                </div>
                <div className="grid gap-2">
                    <div className="flex items-center">
                    <Label htmlFor="password">Password</Label>
                    </div>
                    <Input id="password" type="password" name="password" required />
                </div>
                <LoginButton />
            </form>
        </CardContent>
        <CardFooter>
            <Button variant="link" asChild className="w-full">
                <Link href="/">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to Landing Page
                </Link>
            </Button>
        </CardFooter>
    </Card>
  )
}

function LoginFormSkeleton() {
    return (
        <Card className="mx-auto w-full max-w-sm">
            <CardHeader className="text-center">
                <Skeleton className="h-10 w-48 mx-auto mb-4" />
                <Skeleton className="h-8 w-24 mx-auto" />
                <Skeleton className="h-5 w-64 mx-auto" />
            </CardHeader>
            <CardContent className="grid gap-4">
                <div className="grid gap-2">
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-10 w-full" />
                </div>
                <div className="grid gap-2">
                    <Skeleton className="h-5 w-20" />
                    <Skeleton className="h-10 w-full" />
                </div>
                <Skeleton className="h-10 w-full" />
            </CardContent>
            <CardFooter>
                 <Skeleton className="h-10 w-full" />
            </CardFooter>
        </Card>
    );
}

// The main export is now a parent component that uses Suspense
export default function LoginPage() {
  return (
    <div className="w-full h-screen lg:grid lg:grid-cols-2">
      <div className="flex items-center justify-center py-12">
        <React.Suspense fallback={<LoginFormSkeleton />}>
            <LoginForm />
        </React.Suspense>
      </div>
      <div className="hidden bg-muted lg:block h-full">
        <Image
          src="https://images.unsplash.com/photo-1572177812156-58036aae439c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NDE5ODJ8MHwxfHNlYXJjaHwxMnx8cHJvamVjdCUyMG1hbmFnZW1lbnR8ZW58MHx8fHwxNzUwOTUxMDc3fDA&ixlib=rb-4.1.0&q=80&w=1080"
          alt="Image"
          width={1920}
          height={1080}
          className="h-full w-full object-cover dark:brightness-[0.4] min-h-screen"
          data-ai-hint="project management"
        />
      </div>
    </div>
  )
}
