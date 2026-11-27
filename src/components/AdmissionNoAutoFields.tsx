"use client";

import { useState } from "react";

function rollFromAdmission(admissionNo: string) {
  const m = String(admissionNo || "").trim().match(/(\d+)(?!.*\d)/);
  return m ? m[1] : "";
}

export default function AdmissionNoAutoFields({
  defaultRollNo = "",
  defaultApplicationNo = "",
  defaultAdmissionNo = "",
}: {
  defaultRollNo?: string;
  defaultApplicationNo?: string;
  defaultAdmissionNo?: string;
}) {
  const [admissionNo, setAdmissionNo] = useState(defaultAdmissionNo);
  const [applicationNo, setApplicationNo] = useState(defaultApplicationNo);
  const [rollNo, setRollNo] = useState(defaultRollNo);
  const [appTouched, setAppTouched] = useState(false);
  const [rollTouched, setRollTouched] = useState(false);

  function onAdmissionChange(v: string) {
    setAdmissionNo(v);
    if (!appTouched) setApplicationNo(v);
    if (!rollTouched) setRollNo(rollFromAdmission(v));
  }

  return (
    <>
      <div>
        <label className="text-sm text-gray-700">Roll No / رول نمبر</label>
        <input
          name="rollNo"
          required
          value={rollNo}
          onChange={(e) => { setRollTouched(true); setRollNo(e.target.value); }}
          className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-200"
          placeholder="e.g. 1"
        />
      </div>
      <div>
        <label className="text-sm text-gray-700">Application No / درخواست نمبر</label>
        <input
          name="applicationNo"
          required
          value={applicationNo}
          onChange={(e) => { setAppTouched(true); setApplicationNo(e.target.value); }}
          placeholder="e.g. MSB-01"
          className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-200"
        />
      </div>
      <div>
        <label className="text-sm text-gray-700">Admission No / داخلہ نمبر</label>
        <input
          name="admissionNo"
          required
          value={admissionNo}
          onChange={(e) => onAdmissionChange(e.target.value)}
          placeholder="e.g. MSB-01"
          className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-200"
        />
      </div>
    </>
  );
}
