import React, { useEffect, useState } from 'react'
import { NavBar } from '../../components/navbar/NavBar'
import axios from 'axios'

interface User {
  name: string
  telefone: string
}

interface Conversation {
  id: string
  user: User
  messages: Array<{
    conv_id: number
    sender_id: number
    content: string
    timestamp: Date
  }>
}


export default function WhatsappChat () {
  const [user, setUser] = useState<string>('')
  const [conversations, setConversations] = useState<Conversation[]>([])


  async function fetchConversations () {
    const response = await axios.get(process.env.REACT_APP_URL + '/whatsapp/conversations')
    if (response.status === 200) {
      setConversations(response.data.name)
    }
  }

  useEffect(() => {
    fetchConversations()
  }
  , [])

  return (
    <>
      <NavBar/>
      <div className='grid bg-slate-500 min-h-screen max-w-36 overflow-auto'>
        
          {conversations && (
            <ul>{conversations.map((conv, index) => (
              <li key={index}>
                <p>{conv.user.name}</p>
              </li>
            ))}</ul>
          )}
          {!conversations && (
            <p className='text-center self-center justify-center justify-items-center'>Sem Clientes encontrados</p>
          )}

      </div>
    </>
  )
}
