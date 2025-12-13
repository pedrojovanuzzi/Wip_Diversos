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
  type: "cancelamento" | "emissao" | "relatório";
}

interface NotificationContextData {
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
  addJob: (id: string, type: "cancelamento" | "emissao" | "relatório") => void;
}

// const NotificationContext = createContext<NotificationContextData>({
//   showSuccess: () => {},
//   showError: () => {},
//   addJob: () => {},
// });

const NotificationContext = createContext<NotificationContextData>(
  {} as NotificationContextData
);

export const useNotification = () => {
  return useContext(NotificationContext);
};

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const [success, setSuccess] = useState<string | null>(() => {
    return localStorage.getItem("notification_success");
  });
  const [error, setError] = useState<string | null>(() => {
    return localStorage.getItem("notification_error");
  });
  const [activeJobs, setActiveJobs] = useState<Job[]>(() => {
    const savedJobs = localStorage.getItem("notification_activeJobs");
    return savedJobs ? JSON.parse(savedJobs) : [];
  });
  const { user } = useAuth();
  const token = user?.token;

  useEffect(() => {
    if (success) {
      localStorage.setItem("notification_success", success);
    } else {
      localStorage.removeItem("notification_success");
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      localStorage.setItem("notification_error", error);
    } else {
      localStorage.removeItem("notification_error");
    }
  }, [error]);

  useEffect(() => {
    localStorage.setItem("notification_activeJobs", JSON.stringify(activeJobs));
  }, [activeJobs]);

  const showSuccess = (message: string) => setSuccess(message);
  const showError = (message: string) => setError(message);

  const addJob = (
    id: string,
    type: "cancelamento" | "emissao" | "relatório"
  ) => {
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
                `Processamento concluído com erros (${jobData.processados}/${jobData.total}).\n` +
                  "Erros: " +
                  errorsCount +
                  "\n" +
                  JSON.stringify(jobData)
              );
            }
            if (successCount > 0) {
              const baseMessage =
                job.type === "cancelamento"
                  ? "Notas Canceladas com sucesso!"
                  : "Notas emitidas com sucesso!";

              const progressMessage = ` (${jobData.processados}/${jobData.total})`;
              const warningMessage =
                jobData.processados < jobData.total
                  ? "\nATENÇÃO: O processamento parou antes de completar todos os itens."
                  : "";

              showSuccess(baseMessage + progressMessage + warningMessage);
            }
          } else if (jobData.status === "erro") {
            removeJob(job.id);
            showError(
              `Ocorreu um erro no processamento das notas (${jobData.processados}/${jobData.total}): ` +
                JSON.stringify(jobData.resultado)
            );
            console.log(jobData);
          } else if (jobData.status === "pendente") {
            console.log(jobData);
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
