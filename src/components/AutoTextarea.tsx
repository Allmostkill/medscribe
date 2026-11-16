import React, { useEffect, useRef } from "react";

// Textarea, которая растягивается по содержимому, а не скроллится
export default function AutoTextarea({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  className: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={onChange}
      rows={1}
      className={className}
      style={{ resize: 'none', overflow: 'hidden' }}
    />
  );
}
