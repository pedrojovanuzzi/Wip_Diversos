interface MessageProps {
  msg: string;
  type: string;
}

export default function Message({ msg, type }: MessageProps) {
  return (
    <div className={`message ${type}`}>
      <p>{msg}</p>
    </div>
  );
}
