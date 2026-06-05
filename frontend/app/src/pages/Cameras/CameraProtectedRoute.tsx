import React from "react";
import { Navigate } from "react-router-dom";
import { getCamToken } from "./cameraAuth";

export const CameraProtectedRoute: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const token = getCamToken();
  if (!token) return <Navigate to="/Cameras/Login" replace />;
  return <>{children}</>;
};
