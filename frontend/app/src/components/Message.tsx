import React from 'react'

interface MessageProps {
    msg: string;
    type: string;
  }
  
export const Message: React.FC<MessageProps> = ({ msg, type }) => {
return (
    <div className={`message ${type}`}>
    <p>{msg}</p>
    </div>
);
}

export default Message;