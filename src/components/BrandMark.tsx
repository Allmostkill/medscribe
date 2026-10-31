// Знак MagaMED (оригинал: MedCalc, BrandMark на лендинге). Название и знак MagaMED не входят в лицензию AGPL.
export default function BrandMark({ size = 20 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 42 42">
      <rect x="1.25" y="1.25" width="39.5" height="39.5" rx="13" fill="#2d6a99" stroke="#25404b" strokeWidth="2.5" />
      <g transform="translate(9 9)">
        <path d="M12 21s-7-4.6-9.2-9C1.3 8.7 3 5 6.5 5 8.6 5 10 6.3 12 8.4 14 6.3 15.4 5 17.5 5 21 5 22.7 8.7 21.2 12 19 16.4 12 21 12 21Z" fill="#fff" />
        <path d="M12 9.5v5M9.5 12h5" stroke="#2d6a99" strokeWidth="1.8" strokeLinecap="round" />
      </g>
    </svg>
  );
}

export function BrandLockup({ size = 22 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <BrandMark size={size} />
      <div className="flex flex-col gap-[3px]">
        <span className="font-bold text-primary-900 text-[14px] tracking-tight leading-none">MedScribe</span>
        <span className="text-[11px] text-ds-600 leading-none">от MagaMED</span>
      </div>
    </div>
  );
}
