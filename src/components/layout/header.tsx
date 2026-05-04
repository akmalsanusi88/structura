
'use client';

import { SidebarTrigger } from "@/components/ui/sidebar"

type HeaderProps = {
    title: string;
};

export default function Header({ title }: HeaderProps) {
    return (
        <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-sm md:h-16 md:px-6">
            <div className="flex items-center gap-2 md:gap-4">
                <SidebarTrigger className="block md:hidden"/>
                <h1 className="text-lg font-semibold md:text-2xl font-headline">{title}</h1>
            </div>
        </header>
    )
}
