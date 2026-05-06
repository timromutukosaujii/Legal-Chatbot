import fs from "fs";
import path from "path";

const EVAL_LOG_PATH =
  process.env.RAG_EVAL_LOG_PATH || path.resolve("..", "..", "..", "logs", "rag-eval.log");

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

export function logComparisonEvent(event) {
  const safeEvent = {
    ts: new Date().toISOString(),
    question: String(event?.question || "").slice(0, 2000),
    retrievedSourceTitles: Array.isArray(event?.retrievedSourceTitles)
      ? event.retrievedSourceTitles.slice(0, 10)
      : [],
    confidence: event?.confidence || "low",
    answerType: event?.answerType || "legal_information",
    safetyTriggered: Boolean(event?.safetyTriggered),
    scope: event?.scope || "out_of_scope"
  };

  ensureDir(EVAL_LOG_PATH);
  fs.appendFileSync(EVAL_LOG_PATH, `${JSON.stringify(safeEvent)}\n`, "utf-8");
}
