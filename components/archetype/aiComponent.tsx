import React from "react";

type AiComponentProps = {
  message?: string;
  loading?: boolean;
};

const AiComponent: React.FC<AiComponentProps> = ({ message, loading }) => {
  return (
    <div className="ai-component">
      <div>
        <strong>AI Response:</strong>
      </div>
      {loading ? <div>Loading...</div> : <div>{message ?? "No response yet."}</div>}
    </div>
  );
};

export default AiComponent;
