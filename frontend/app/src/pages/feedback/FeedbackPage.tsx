import React, { useState } from "react";
import { useParams } from "react-router-dom";

const FeedbackPage = () => {
  const { technician, id } = useParams<{ technician: string; id: string }>();
  const [ratingInternet, setRatingInternet] = useState<number | null>(null);
  const [ratingService, setRatingService] = useState<number | null>(null);
  const [ratingResponseTime, setRatingResponseTime] = useState<number | null>(null);
  const [ratingTechnicianService, setRatingTechnicianService] = useState<number | null>(null);
  const [ratingDoYouRecomend, setRatingDoYouRecomend] = useState<number | null>(null);
  const [ratingDoYouProblemSolved, setRatingDoYouProblemSolved] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    try {
      const response = await fetch(`/api/feedback/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          technician,
          ratingInternet,
          ratingService,
          ratingResponseTime,
          ratingTechnicianService,
          ratingDoYouRecomend,
          ratingDoYouProblemSolved,
        }),
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

  const colors = [
    "bg-red-500",
    "bg-red-400",
    "bg-orange-500",
    "bg-orange-400",
    "bg-yellow-500",
    "bg-yellow-400",
    "bg-blue-500",
    "bg-blue-400",
    "bg-green-500",
    "bg-green-400",
    "bg-purple-500",
  ];

  const renderRatingButtons = (ratingValue: number | null, setRating: (value: number) => void) => {
    return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => {
      const buttonColor = colors[value] || "bg-gray-300";
      return (
        <button
          key={value}
          onClick={() => setRating(value)}
          className={`p-5 m-1 rounded ${buttonColor} ${
            ratingValue === value ? "text-white ring-2 ring-white" : "text-black"
          }`}
        >
          {value}
        </button>
      );
    });
  };

  return (
    <div className="flex justify-center flex-col font-semibold bg-gray-900 text-gray-200">
      <main className="flex flex-col gap-10 sm:h-auto p-10">
        <div>
          <div className="mb-10 justify-self-center">
            <h1 className="text-nowrap text-sky-400 font-Park">Pesquisa de Satisfação</h1>
          </div>
          <label>De 0 a 10 quanto você avalia nossa internet?: </label>
          <div className="mt-5">{renderRatingButtons(ratingInternet, setRatingInternet)}</div>
        </div>

        <div>
          <label>De 0 a 10 quanto você avalia nosso serviço?: </label>
          <div className="mt-5">{renderRatingButtons(ratingService, setRatingService)}</div>
        </div>

        <div>
          <label>De 0 a 10 quanto você avalia nosso tempo de resposta?: </label>
          <div className="mt-5">{renderRatingButtons(ratingResponseTime, setRatingResponseTime)}</div>
        </div>

        <div>
          <label>De 0 a 10 quanto você avalia o serviço do técnico?: </label>
          <div className="mt-5">{renderRatingButtons(ratingTechnicianService, setRatingTechnicianService)}</div>
        </div>

        <div>
          <label>Você recomendaria a Wip Telecom?: </label>
          <div className="mt-5">
            {[1, 0].map((value) => (
              <button
                key={value}
                onClick={() => setRatingDoYouRecomend(value)}
                className={`p-5 m-1 rounded ${
                  ratingDoYouRecomend === value
                    ? value === 1
                      ? "bg-blue-500 text-white ring-2 ring-white"
                      : "bg-blue-500 text-white ring-2 ring-white"
                    : "bg-gray-300 text-black"
                }`}
              >
                {value === 1 ? "Sim" : "Não"}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label>Seu Problema foi Resolvido?: </label>
          <div className="mt-5">
            {[1, 0].map((value) => (
              <button
                key={value}
                onClick={() => setRatingDoYouProblemSolved(value)}
                className={`p-5 m-1 rounded ${
                  ratingDoYouProblemSolved === value
                    ? value === 1
                      ? "bg-blue-500 text-white ring-2 ring-white"
                      : "bg-blue-500 text-white ring-2 ring-white"
                    : "bg-gray-300 text-black"
                }`}
              >
                {value === 1 ? "Sim" : "Não"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col">
          <label>
            Escreva o que desejar, uma opinião ou uma crítica para termos seu Feedback
          </label>
          <textarea
            placeholder="De seu Feedback (Opcional)"
            className="mt-5 resize-none self-center rounded-lg p-2 placeholder:text-gray-600 text-black w-52 h-32 font-Park"
          ></textarea>
        </div>

        <button
          onClick={handleSubmit}
          className="bg-slate-700 text-gray-200 sm:w-1/6 sm:self-center rounded ring-2 ring-white p-5 hover:bg-slate-500 transition-all"
        >
          Enviar Feedback
        </button>
      </main>
    </div>
  );
};

export default FeedbackPage;
