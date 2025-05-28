import React, { useEffect, useState } from 'react'
import { NavBar } from '../../components/navbar/NavBar'
import axios from 'axios'

export default function WhatsappChat () {
  const [user, setUser] = useState<string>('')


  async function fetchUser () {
    const response = await axios.get(process.env.REACT_APP_URL + '/whatsapp_chat/user')
    if (response.status === 200) {
      setUser(response.data.name)
    }
  }

  useEffect(() => {
    fetchUser()
  }
  , [])

  return (
    <>
      <NavBar/>
      <div className='grid bg-slate-500 min-h-screen max-w-36 overflow-auto'>
        
          {user && (
            <li>{user}</li>
          )}
          {!user && (
            <p className='text-center self-center justify-center justify-items-center'>Sem Clientes encontrados</p>
          )}

      </div>
    </>
  )
}
