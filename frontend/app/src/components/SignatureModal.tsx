import React, { useRef } from "react";
import SignatureCanvas from "react-signature-canvas";

interface Props {
  onSave: (data: string) => void;
  onClose: () => void;
}

export const SignatureModal: React.FC<Props> = ({ onSave, onClose }) => {
  const sigCanvas = useRef<SignatureCanvas>(null);

  const clear = () => sigCanvas.current?.clear();

  const save = () => {
    if (sigCanvas.current) {
      onSave(sigCanvas.current.getCanvas().toDataURL("image/png"));
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-4 rounded-lg shadow-xl w-full max-w-lg">
        <h3 className="text-xl font-bold mb-4">Assinatura</h3>
        <div className="border border-gray-300 rounded mb-4 h-64 bg-gray-50">
          <SignatureCanvas
            ref={sigCanvas}
            penColor="black"
            velocityFilterWeight={0.7}
            minWidth={1}
            maxWidth={2.5}
            throttle={16}
            canvasProps={{
              className: "w-full h-full",
              style: { width: "100%", height: "100%" },
            }}
          />
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={clear} className="bg-gray-300 px-4 py-2 rounded">
            Limpar
          </button>
          <button
            onClick={onClose}
            className="bg-red-500 text-white px-4 py-2 rounded"
          >
            Cancelar
          </button>
          <button
            onClick={save}
            className="bg-blue-600 text-white px-4 py-2 rounded"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
};
