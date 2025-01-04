import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/20/solid'
import { useState } from 'react'

function getDaysInMonth(year: number, month: number) {
  const date = new Date(year, month, 1)
  const days = []
  while (date.getMonth() === month) {
    days.push(new Date(date))
    date.setDate(date.getDate() + 1)
  }
  return days
}

function classNames(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}

export default function Calendar({ setDateFilter }: { setDateFilter: (dates: { start: string, end: string } | null) => void }) {
  const today = new Date()
  const [currentMonth, setCurrentMonth] = useState(today.getMonth())
  const [currentYear, setCurrentYear] = useState(today.getFullYear())
  const [selectedDates, setSelectedDates] = useState<Date[]>([])
  const days = getDaysInMonth(currentYear, currentMonth)

  const handlePreviousMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11)
      setCurrentYear(currentYear - 1)
    } else {
      setCurrentMonth(currentMonth - 1)
    }
  }

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0)
      setCurrentYear(currentYear + 1)
    } else {
      setCurrentMonth(currentMonth + 1)
    }
  }

  const handleDateClick = (day: Date) => {
    if (selectedDates.length === 0) {
      setSelectedDates([day])
    } else if (selectedDates.length === 1) {
      if (day >= selectedDates[0]) {
        const newSelection = [selectedDates[0], day]
        setSelectedDates(newSelection)
        setDateFilter({
          start: newSelection[0].toISOString().split('T')[0],
          end: newSelection[1].toISOString().split('T')[0]
        })
      } else {
        const newSelection = [day, selectedDates[0]]
        setSelectedDates(newSelection)
        setDateFilter({
          start: newSelection[0].toISOString().split('T')[0],
          end: newSelection[1].toISOString().split('T')[0]
        })
      }
    } else {
      setSelectedDates([day])
      setDateFilter(null)
    }
  }

  const isSelected = (day: Date) => {
    if (selectedDates.length === 0) return false
    if (selectedDates.length === 1) {
      return day.toDateString() === selectedDates[0].toDateString()
    }
    return day >= selectedDates[0] && day <= selectedDates[1]
  }

  const currentMonthName = new Date(currentYear, currentMonth).toLocaleString('default', { month: 'long' })

  return (
    <div className="m-5 max-w-6xl p-10 mx-auto">
      <div className="flex text-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">
          {currentMonthName} {currentYear}
        </h2>
        <div className="flex">
          <button onClick={handlePreviousMonth} className="p-1 text-gray-500 hover:text-gray-700">
            <ChevronLeftIcon className="size-5" />
          </button>
          <button onClick={handleNextMonth} className="p-1 ml-2 text-gray-500 hover:text-gray-700">
            <ChevronRightIcon className="size-5" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 mt-6 text-center text-xs text-gray-500">
        <div>S</div>
        <div>T</div>
        <div>Q</div>
        <div>Q</div>
        <div>S</div>
        <div>S</div>
        <div>D</div>
      </div>
      <div className="grid grid-cols-7 mt-2 text-sm">
        {days.map((day, dayIdx) => (
          <div key={day.toISOString()} className={classNames(dayIdx > 6 && 'border-t border-gray-200', 'py-2')}>
            <button
              onClick={() => handleDateClick(day)}
              className={classNames(
                isSelected(day) && 'bg-indigo-600 text-white',
                day.getMonth() !== currentMonth && 'text-gray-400',
                'rounded-full mx-auto flex items-center justify-center size-8 hover:bg-gray-200'
              )}
            >
              {day.getDate()}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
