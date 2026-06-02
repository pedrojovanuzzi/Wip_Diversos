import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import PopUp from "./components/PopUp";
import PopUpError from "./components/PopUpError";

const Card: React.FC<{
  index: number;
  title: string;
  children: React.ReactNode;
}> = ({ index, title, children }) => (
  <section className="bg-slate-800/60 backdrop-blur rounded-2xl border border-slate-700/50 shadow-lg p-5 sm:p-6">
    <div className="flex items-start gap-3 mb-4">
      <span className="inline-flex shrink-0 size-7 rounded-full bg-sky-500/20 text-sky-300 ring-1 ring-inset ring-sky-400/30 items-center justify-center text-xs font-bold">
        {index}
      </span>
      <h3 className="text-base sm:text-lg font-semibold text-white leading-snug">
        {title}
      </h3>
    </div>
    {children}
  </section>
);

const FeedbackPage = () => {
  const { technician, id } = useParams<{ technician: string; id: string }>();
  const [ratingInternet, setRatingInternet] = useState<number | null>(null);
  const [ratingService, setRatingService] = useState<number | null>(null);
  const [ratingResponseTime, setRatingResponseTime] = useState<number | null>(
    null,
  );
  const [ratingTechnicianService, setRatingTechnicianService] = useState<
    number | null
  >(null);
  const [ratingDoYouRecomend, setRatingDoYouRecomend] = useState<number | null>(
    null,
  );
  const [ratingDoYouProblemSolved, setRatingDoYouProblemSolved] = useState<
    number | null
  >(null);
  const [opnion, setOpinion] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [isUsed, setIsUsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const handleSubmit = async () => {
    setSending(true);
    try {
      const response = await fetch(
        `${process.env.REACT_APP_URL}/feedback/${id}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id,
            opnion,
            technician,
            ratingInternet,
            ratingService,
            ratingResponseTime,
            ratingTechnicianService,
            ratingDoYouRecomend,
            ratingDoYouProblemSolved,
          }),
        },
      );

      if (!response.ok) {
        throw new Error("Este link já foi utilizado ou é inválido.");
      }

      setSubmitted(true);
    } catch (error: any) {
      setErrorMessage(error.message);
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    const checkUUID = async () => {
      try {
        const response = await fetch(
          `${process.env.REACT_APP_URL}/feedback/${id}`,
          {
            method: "GET",
            headers: { "Content-Type": "application/json" },
          },
        );

        if (!response.ok) {
          if (response.status === 400) {
            setErrorMessage("O link é inválido ou já foi utilizado.");
            setIsUsed(true);
          } else {
            throw new Error("Erro ao verificar o status do link.");
          }
        } else {
          const data = await response.json();
          setIsUsed(data.used);
        }
      } catch (error) {
        setErrorMessage("Erro ao verificar o status do link. Tente novamente.");
      } finally {
        setLoading(false);
      }
    };

    checkUUID();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center text-slate-300">
        <div className="flex flex-col items-center gap-3">
          <div className="size-10 rounded-full border-4 border-slate-700 border-t-sky-400 animate-spin" />
          <p className="text-sm">Carregando…</p>
        </div>
      </div>
    );
  }

  if (isUsed || errorMessage && !submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-6 py-16">
        <div className="mx-auto max-w-xl w-full bg-slate-800/60 backdrop-blur rounded-3xl border border-slate-700/60 p-8 sm:p-10 text-center shadow-2xl">
          <div className="mx-auto size-14 rounded-full bg-rose-500/15 ring-1 ring-inset ring-rose-500/30 flex items-center justify-center mb-5">
            <span className="text-3xl">⚠️</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
            Não foi possível enviar
          </h2>
          <p className="mt-4 text-base text-rose-300">
            {errorMessage}
          </p>
          <p className="mt-2 text-sm text-slate-400">
            Feche a página e solicite um novo link.
          </p>
          <PopUpError />
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-6 py-16">
        <div className="mx-auto max-w-xl w-full bg-slate-800/60 backdrop-blur rounded-3xl border border-slate-700/60 p-8 sm:p-10 text-center shadow-2xl">
          <div className="mx-auto size-14 rounded-full bg-emerald-500/15 ring-1 ring-inset ring-emerald-500/30 flex items-center justify-center mb-5">
            <span className="text-3xl">✅</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
            Muito obrigado!
          </h2>
          <p className="mt-4 text-base text-emerald-300">
            Seu feedback foi computado.
          </p>
          <p className="mt-2 text-sm text-slate-400">
            Você já pode fechar esta página.
          </p>
          <PopUp />
        </div>
      </div>
    );
  }

  const ratingColor = (value: number, active: boolean) => {
    const palette = [
      "from-rose-600 to-rose-500",
      "from-rose-500 to-orange-500",
      "from-orange-500 to-orange-400",
      "from-orange-400 to-amber-400",
      "from-amber-400 to-yellow-400",
      "from-yellow-400 to-lime-400",
      "from-lime-400 to-emerald-400",
      "from-emerald-400 to-emerald-500",
      "from-emerald-500 to-teal-500",
      "from-teal-500 to-sky-500",
      "from-sky-500 to-indigo-500",
    ];
    const grad = palette[value] || "from-slate-400 to-slate-500";
    return active
      ? `bg-gradient-to-br ${grad} text-white ring-2 ring-white shadow-lg scale-110`
      : "bg-slate-700/40 text-slate-200 hover:bg-slate-700/70";
  };

  const renderRatingScale = (
    ratingValue: number | null,
    setRating: (value: number) => void,
  ) => (
    <div className="flex flex-wrap gap-1.5 sm:gap-2 justify-center">
      {Array.from({ length: 11 }, (_, value) => (
        <button
          key={value}
          type="button"
          onClick={() => setRating(value)}
          className={`size-11 sm:size-12 rounded-xl font-bold text-sm transition-all ${ratingColor(value, ratingValue === value)}`}
        >
          {value}
        </button>
      ))}
    </div>
  );

  const renderYesNo = (
    selected: number | null,
    setSelected: (v: number) => void,
  ) => (
    <div className="flex gap-2 justify-center">
      {[
        { value: 1, label: "Sim", cls: "from-emerald-500 to-emerald-400" },
        { value: 0, label: "Não", cls: "from-rose-500 to-rose-400" },
      ].map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => setSelected(opt.value)}
          className={`flex-1 sm:flex-none sm:w-32 rounded-xl py-3 font-semibold transition-all ${
            selected === opt.value
              ? `bg-gradient-to-br ${opt.cls} text-white ring-2 ring-white shadow-lg`
              : "bg-slate-700/40 text-slate-200 hover:bg-slate-700/70"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );

  const allAnswered =
    ratingInternet !== null &&
    ratingService !== null &&
    ratingResponseTime !== null &&
    ratingTechnicianService !== null &&
    ratingDoYouRecomend !== null &&
    ratingDoYouProblemSolved !== null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-200">
      <Helmet>
        <title>Pesquisa de Satisfação</title>
      </Helmet>

      <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <div className="text-center mb-8">
          <p className="inline-block text-xs uppercase tracking-[0.2em] text-sky-300/80 bg-sky-500/10 ring-1 ring-inset ring-sky-400/20 rounded-full px-3 py-1">
            Wip Telecom
          </p>
          <h1 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight text-white">
            Pesquisa de Satisfação
          </h1>
          <p className="mt-2 text-sm sm:text-base text-slate-400">
            Sua opinião nos ajuda a melhorar o atendimento. Leva menos de um
            minuto.
          </p>
        </div>

        <div className="space-y-4">
          <Card index={1} title="De 0 a 10, como você avalia a nossa internet?">
            {renderRatingScale(ratingInternet, setRatingInternet)}
          </Card>

          <Card
            index={2}
            title="De 0 a 10, como você avalia o nosso atendimento?"
          >
            {renderRatingScale(ratingService, setRatingService)}
          </Card>

          <Card
            index={3}
            title="De 0 a 10, como você avalia o nosso tempo de resposta?"
          >
            {renderRatingScale(ratingResponseTime, setRatingResponseTime)}
          </Card>

          <Card
            index={4}
            title="De 0 a 10, como você avalia o serviço do técnico?"
          >
            {renderRatingScale(
              ratingTechnicianService,
              setRatingTechnicianService,
            )}
          </Card>

          <Card index={5} title="Você recomendaria a Wip Telecom?">
            {renderYesNo(ratingDoYouRecomend, setRatingDoYouRecomend)}
          </Card>

          <Card index={6} title="Seu problema foi resolvido?">
            {renderYesNo(ratingDoYouProblemSolved, setRatingDoYouProblemSolved)}
          </Card>

          <Card index={7} title="Quer deixar um comentário? (opcional)">
            <textarea
              onChange={(e) => setOpinion(e.target.value)}
              placeholder="Escreva uma opinião, sugestão ou crítica…"
              rows={4}
              className="w-full resize-none rounded-xl bg-slate-900/60 border border-slate-700 text-slate-100 placeholder:text-slate-500 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400"
            />
          </Card>

          <button
            onClick={handleSubmit}
            disabled={sending || !allAnswered}
            className="w-full sm:w-auto sm:mx-auto sm:flex inline-flex items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-500 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-sky-900/30 hover:from-sky-400 hover:to-indigo-400 transition disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {sending
              ? "Enviando…"
              : allAnswered
              ? "Enviar feedback"
              : "Responda todas as perguntas para enviar"}
          </button>
        </div>
      </main>
    </div>
  );
};

export default FeedbackPage;
