"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import axios from "axios";
import Success from "@/components/notifications/Success";
import ErrorNotification from "@/components/notifications/Error";
import type { User } from "./auth";

interface Job {
  id: string;
  type: "cancelamento" | "emissao" | "relatório";
}

interface NotificationContextData {
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
  addJob: (id: string, type: "cancelamento" | "emissao" | "relatório") => void;
}

const NotificationContext = createContext<NotificationContextData>(
  {} as NotificationContextData
);

export const useNotification = () => {
  return useContext(NotificationContext);
};

export const NotificationProvider = ({ 
  children, 
  user 
}: { 
  children: ReactNode;
  user: User | null;
}) => {
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeJobs, setActiveJobs] = useState<Job[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    const savedSuccess = localStorage.getItem("notification_success");
    const savedError = localStorage.getItem("notification_error");
    const savedJobs = localStorage.getItem("notification_activeJobs");
    
    if (savedSuccess) setSuccess(savedSuccess);
    if (savedError) setError(savedError);
    if (savedJobs) {
      try {
        setActiveJobs(JSON.parse(savedJobs));
      } catch (e) {
        console.error("Failed to parse saved jobs", e);
      }
    }
  }, []);

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

  const showSuccess = (message: string) => {
    setError(null);
    setSuccess(message);
  };
  const showError = (message: string) => {
    setSuccess(null);
    setError(message);
  };

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
    if (activeJobs.length === 0 || !user?.token) return;

    const interval = setInterval(async () => {
      for (const job of activeJobs) {
        try {
          const response = await axios.post(
            `${process.env.REACT_APP_URL}/NFCom/statusJob`,
            { id: job.id },
            {
              headers: {
                Authorization: `Bearer ${user.token}`,
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
                const isSuccess =
                  item.success === true || (item.cStat || item.CStat) == "135";
                if (isSuccess) {
                  successCount++;
                } else {
                  errorsCount++;
                }
              } else {
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
          } else if (jobData.status === "interrompido") {
            removeJob(job.id);
            console.log(`Job ${job.id} foi interrompido e removido da fila.`);
          }
        } catch (err) {
          console.error(`Erro ao verificar job ${job.id}:`, err);
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [activeJobs, user?.token]);

  return (
    <NotificationContext.Provider value={{ showSuccess, showError, addJob }}>
      {children}
      {error ? (
        <ErrorNotification message={error} onClose={() => setError(null)} />
      ) : success ? (
        <Success message={success} onClose={() => setSuccess(null)} />
      ) : null}
    </NotificationContext.Provider>
  );
};
