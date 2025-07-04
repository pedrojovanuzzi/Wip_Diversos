import React from 'react'

export const ErrorMessage = ({ message }: { message: string }) => {
  
  return (
    <div className='ml-5 text-red-500'>{message}</div>
  )
}
