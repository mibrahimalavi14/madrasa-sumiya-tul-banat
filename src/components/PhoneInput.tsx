"use client";

import { useState } from "react";

function formatPhone(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 4) return digits;
  return `${digits.slice(0, 4)}-${digits.slice(4)}`;
}

export default function PhoneInput({
  name,
  defaultValue = "",
  required,
  placeholder,
  className,
  list,
}: {
  name: string;
  defaultValue?: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
  list?: string;
}) {
  const [value, setValue] = useState(() => formatPhone(defaultValue || ""));
  return (
    <input
      name={name}
      value={value}
      onChange={(e) => setValue(formatPhone(e.target.value))}
      required={required}
      placeholder={placeholder || "03XX-XXXXXXX"}
      className={className}
      list={list}
      inputMode="numeric"
      autoComplete="tel"
      maxLength={12}
    />
  );
}
