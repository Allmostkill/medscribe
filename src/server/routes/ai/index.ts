import express from "express";
import { registerLlmRoutes } from "./llm";
import { registerSttEngineRoutes } from "./sttEngine";
import { registerHintsRoutes } from "./hints";
import { registerCommunicationRoutes } from "./communication";
import { registerNoteCheckRoutes } from "./noteCheck";
import { registerPharmaRoutes } from "./pharma";
import { registerDiagnosisRoutes } from "./diagnosis";
import { registerPatientSummaryRoutes } from "./patientSummary";
import { registerAnalyzeRoutes } from "./analyze";

export function registerAiRoutes(app: express.Express) {
  registerLlmRoutes(app);
  registerSttEngineRoutes(app);
  registerHintsRoutes(app);
  registerCommunicationRoutes(app);
  registerNoteCheckRoutes(app);
  registerPharmaRoutes(app);
  registerDiagnosisRoutes(app);
  registerPatientSummaryRoutes(app);
  registerAnalyzeRoutes(app);
}
