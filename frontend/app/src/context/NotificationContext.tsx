import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import axios from "axios";
import { useAuth } from "./AuthContext";
import Success from "../pages/Nfcom/Components/Success";
import Error from "../pages/Nfcom/Components/Error";

interface Job {
  id: string;
  type: "cancelamento" | "emissao";
}

interface NotificationContextData {
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
  addJob: (id: string, type: "cancelamento" | "emissao") => void;
}

const NotificationContext = createContext<NotificationContextData>(
  {} as NotificationContextData
);

export const useNotification = () => {
  return useContext(NotificationContext);
};

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeJobs, setActiveJobs] = useState<Job[]>([]);
  const { user } = useAuth();
  const token = user?.token;

  const showSuccess = (message: string) => setSuccess(message);
  const showError = (message: string) => setError(message);

  const addJob = (id: string, type: "cancelamento" | "emissao") => {
    setActiveJobs((prev) => [...prev, { id, type }]);
  };

  const removeJob = (id: string) => {
    setActiveJobs((prev) => prev.filter((job) => job.id !== id));
  };

  useEffect(() => {
    if (activeJobs.length === 0 || !token) return;

    const interval = setInterval(async () => {
      for (const job of activeJobs) {
        try {
          const response = await axios.post(
            `${process.env.REACT_APP_URL}/NFCom/statusJob`,
            { id: job.id },
            {
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
            }
          );

          const jobData = response.data;
          console.log(`Job ${job.id} status:`, jobData.status);

          if (jobData.status === "concluido") {
            removeJob(job.id);

            let errorsCount = 0;
            let successCount = 0;

            const results = Array.isArray(jobData.resultado)
              ? jobData.resultado
              : [jobData.resultado];

            results.forEach((item: any) => {
              if (job.type === "cancelamento") {
                const cStat = item.cStat || item.CStat;
                if (cStat == "135") {
                  successCount++;
                } else {
                  errorsCount++;
                }
              } else {
                // Lógica para emissão (baseada no Nfcom.tsx)
                if (item.success === false) {
                  errorsCount++;
                } else {
                  successCount++;
                }
              }
            });

            if (errorsCount > 0) {
              showError(
                "Ocorreu um erro no processamento das notas. Erros: " +
                  errorsCount +
                  "\n" +
                  JSON.stringify(jobData)
              );
            }
            if (successCount > 0) {
              showSuccess(
                job.type === "cancelamento"
                  ? "Notas Canceladas com sucesso!"
                  : "Notas emitidas com sucesso!"
              );
            }
          } else if (jobData.status === "erro") {
            removeJob(job.id);
            showError(
              "Ocorreu um erro no processamento das notas: " +
                JSON.stringify(jobData.resultado)
            );
          }
        } catch (err) {
          console.error(`Erro ao verificar job ${job.id}:`, err);
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [activeJobs, token]);

  return (
    <NotificationContext.Provider value={{ showSuccess, showError, addJob }}>
      {children}
      {success && (
        <Success message={success} onClose={() => setSuccess(null)} />
      )}
      {error && <Error message={error} onClose={() => setError(null)} />}
    </NotificationContext.Provider>
  );
};
