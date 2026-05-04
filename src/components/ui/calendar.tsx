
"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker, useDayPicker, useNavigation } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { Button } from "./button"
import { format } from "date-fns"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-sm font-medium",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell:
          "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
        row: "flex w-full mt-2",
        cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal aria-selected:opacity-100"
        ),
        day_range_end: "day-range-end",
        day_selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        day_today: "bg-accent text-accent-foreground",
        day_outside:
          "day-outside text-muted-foreground aria-selected:bg-accent/50 aria-selected:text-muted-foreground",
        day_disabled: "text-muted-foreground opacity-50",
        day_range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ ...props }) => <ChevronLeft className="h-4 w-4" />,
        IconRight: ({ ...props }) => <ChevronRight className="h-4 w-4" />,
        Caption: ({ displayMonth }) => {
          const { goToMonth, nextMonth, previousMonth } = useNavigation();
          const { fromYear, toYear } = useDayPicker();

          const handleYearChange = (value: string) => {
            const newDate = new Date(displayMonth);
            newDate.setFullYear(parseInt(value, 10));
            goToMonth(newDate);
          };

          const handleMonthChange = (value: string) => {
            const newDate = new Date(displayMonth);
            newDate.setMonth(parseInt(value, 10));
            goToMonth(newDate);
          };
          
          const years: number[] = [];
          const startYear = fromYear || (new Date().getFullYear() - 100);
          const endYear = toYear || (new Date().getFullYear() + 10);
          for(let i = startYear; i <= endYear; i++) {
              years.push(i);
          }

          return (
            <div className="flex justify-between items-center w-full px-1">
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={() => previousMonth && goToMonth(previousMonth)}
                disabled={!previousMonth}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-2">
                 <Select
                    value={displayMonth.getMonth().toString()}
                    onValueChange={handleMonthChange}
                  >
                    <SelectTrigger className="w-[100px] h-8">
                      <SelectValue placeholder="Month" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => (
                        <SelectItem key={i} value={i.toString()}>
                          {format(new Date(0, i), 'MMMM')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                 <Select
                  value={displayMonth.getFullYear().toString()}
                  onValueChange={handleYearChange}
                >
                  <SelectTrigger className="w-[80px] h-8">
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={() => nextMonth && goToMonth(nextMonth)}
                disabled={!nextMonth}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          );
        }
      }}
      footer={
        <div className="flex justify-between pt-4">
            <Button
                type="button"
                variant="ghost"
                onClick={() => props.onSelect && props.onSelect(undefined)}
            >
                Clear
            </Button>
            <Button
                type="button"
                variant="ghost"
                onClick={() => props.onSelect && props.onSelect(new Date())}
            >
                Today
            </Button>
        </div>
      }
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
