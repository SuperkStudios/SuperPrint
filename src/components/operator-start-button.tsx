"use client";

import { useState } from "react";
import { AdminActionButton } from "@/components/admin-action-button";

const checklist = {
  correctFilamentLoaded: true,
  buildPlateClear: true,
  cameraVisible: true,
  printerAreaSafe: true,
  gcodeVerifiedOnNode: true
};

export function OperatorStartButton({ printJobId, orderNumber }: { printJobId: string; orderNumber: string }) {
  const [expanded, setExpanded] = useState(false);

  if (!expanded) {
    return (
      <button type="button" className="rounded-md border bg-white px-3 py-2 text-sm font-medium hover:bg-muted" onClick={() => setExpanded(true)}>
        Start Physical Print
      </button>
    );
  }

  return (
    <div className="grid gap-2 rounded border bg-white p-3 text-sm">
      <p className="font-medium">Operator safety checklist</p>
      {[
        "Correct filament loaded",
        "Build plate clear",
        "Camera visible",
        "Printer door/area safe",
        "G-code verified on node"
      ].map((item) => (
        <label key={item} className="flex items-center gap-2">
          <input type="checkbox" checked readOnly />
          {item}
        </label>
      ))}
      <AdminActionButton
        endpoint="/api/admin/queue"
        payload={{ action: "approvePhysicalStart", printJobId, checklist }}
        confirm={`Approve physical print start for ${orderNumber}? SuperNode will receive a no-op/manual command next.`}
      >
        Approve physical start
      </AdminActionButton>
    </div>
  );
}
