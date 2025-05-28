import React, { useEffect, useState } from 'react'
import { NavBar } from '../../components/navbar/NavBar'
import axios from 'axios'
import img from '../../assets/icon.png'

interface User {
  nome: string
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
    try {
      const response = await axios.get(process.env.REACT_APP_URL + '/whatsapp/conversations')
    if (response.status === 200) {
      setConversations(response.data.conversations)
      console.log('Conversations fetched successfully:', response.data.conversations);
      
    }
    } catch (error) {
      console.log('Error fetching conversations:', error);
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
          {conversations.length > 0 && (
            <ul>{conversations.map((conv, index) => (
              <div key={index} className='flex flex-col items-center justify-center'>
                <img src={img} alt="" />
                <li className='flex flex-col items-center justify-center text-white p-4 border-b border-gray-300 hover:bg-gray-700 cursor-pointer'>
                  <p>{conv.user.nome}</p>
                </li>
              </div>
            ))}</ul>
          )}
          {conversations.length <= 0 && (
            <p className='text-center self-center justify-center justify-items-center text-white'>Sem Clientes encontrados</p>
          )}

      </div>
    </>
  )
}
