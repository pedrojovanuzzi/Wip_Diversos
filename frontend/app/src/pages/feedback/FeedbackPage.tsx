import React, { useState } from "react";
import { useParams } from "react-router-dom";

const FeedbackPage = () => {
  const { technician, id } = useParams<{ technician: string; id: string }>();
  const [rating, setRating] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!rating) {
      alert("Por favor, selecione uma nota antes de enviar.");
      return;
    }

    try {
      const response = await fetch(`/api/feedback/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ technician, rating }),
      });

      if (!response.ok) {
        throw new Error("Este link já foi utilizado ou é inválido.");
      }

      setSubmitted(true);
    } catch (error: any) {
      setErrorMessage(error.message);
    }
  };

  if (errorMessage) {
    return <p>{errorMessage}</p>;
  }

  if (submitted) {
    return <p>Obrigado pelo seu feedback!</p>;
  }

  return (
    <div className="flex justify-center flex-col h-screen gap-5 font-semibold">
      <h1>Feedback para {technician}</h1>
      <p>ID do Feedback: {id}</p>

      <div>
        <label>Nota: </label>
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            onClick={() => setRating(value)}
            className={`p-2 mx-1 rounded ${
              rating === value ? "bg-blue-500 text-white" : "bg-gray-300"
            }`}
          >
            {value}
          </button>
        ))}
      </div>

      <button
        onClick={handleSubmit}
        className="bg-slate-900 text-gray-300 rounded p-5 hover:bg-slate-700"
      >
        Enviar Feedback
      </button>
    </div>
  );
};

export default FeedbackPage;
