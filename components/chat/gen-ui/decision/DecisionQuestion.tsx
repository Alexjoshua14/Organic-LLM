import styles from "../blocks/DecisionMatrix.module.css";

type DecisionQuestionProps = {
  id: string;
  question: string;
  optionCount: number;
};

export function DecisionQuestion({ id, question, optionCount }: DecisionQuestionProps) {
  return (
    <div className={styles.titleRow}>
      <h3 id={id} className={styles.question}>
        {question}
      </h3>
      <p className={styles.meta}>{optionCount} options</p>
    </div>
  );
}
