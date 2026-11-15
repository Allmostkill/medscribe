import type { TranscriptLine } from "../../types";
import BlockShell from "./BlockShell";
import { ChecklistPanel } from "../ChecklistPanel";

interface ChecklistBlockProps {
  transcript: TranscriptLine[];
  type: 'primary' | 'follow-up';
  specialtyId?: string;
}

// Извлечено 1:1 из Dashboard.tsx (было COLUMN 4: STANDARD-OF-CARE CHECKLIST).
// ChecklistPanel сам не трогаем — это просто обёртка для реестра блоков.
export default function ChecklistBlock({ transcript, type, specialtyId }: ChecklistBlockProps) {
  return (
    // Без title: ChecklistPanel приносит собственную шапку с прогрессом.
    <BlockShell>
      <ChecklistPanel transcript={transcript} type={type} specialtyId={specialtyId} />
    </BlockShell>
  );
}
