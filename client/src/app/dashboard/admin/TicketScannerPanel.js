"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { NotFoundException } from "@zxing/library";

export default function TicketScannerPanel({ adminId }) {
  const videoRef = useRef(null);
  const readerRef = useRef(null);
  const controlsRef = useRef(null);

  const [scanning, setScanning] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [manualToken, setManualToken] = useState("");
  const [lastToken, setLastToken] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const glassPanel   = "bg-white/10 backdrop-blur-sm border border-white/10 rounded-xl shadow-sm";
  const panelHeader  = "bg-white/5 border-b border-white/10";
  const glassInput   = "bg-white/10 border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-white/20";
  const strongText   = "text-white";
  const mutedText    = "text-white/60";

  useEffect(() => {
    readerRef.current = new BrowserMultiFormatReader();
    return () => {
      try {
        controlsRef.current?.stop();
      } catch {
        // ignore
      }
      controlsRef.current = null;
      try {
        readerRef.current?.reset();
      } catch {
        // ignore
      }
      readerRef.current = null;
    };
  }, []);

  const stopScan = useCallback(() => {
    try {
      controlsRef.current?.stop();
    } catch {
      // ignore
    }
    controlsRef.current = null;
    setScanning(false);
  }, []);

  const submitToken = useCallback(
    async (qrToken) => {
      const trimmed = (qrToken || "").trim();
      if (!trimmed) return;
      if (!adminId) {
        setError("Missing adminId");
        return;
      }

      setError("");
      setResult(null);
      setVerifying(true);
      setLastToken(trimmed);

      try {
        const res = await fetch("/api/admin/tickets/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ adminId, qrToken: trimmed }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data?.error || "Scan failed");
          if (data?.ticket) setResult({ ticket: data.ticket, message: data.error, success: false });
          return;
        }

        setResult(data);
      } catch (e) {
        setError(e?.message || "Scan failed");
      } finally {
        setVerifying(false);
      }
    },
    [adminId]
  );

  const startScan = useCallback(async () => {
    if (scanning) return;

    setError("");
    setResult(null);

    if (!videoRef.current) {
      setError("Video element not ready");
      return;
    }
    if (!readerRef.current) {
      readerRef.current = new BrowserMultiFormatReader();
    }

    try {
      const constraints = {
        video: {
          facingMode: { ideal: "environment" },
        },
      };

      const controls = await readerRef.current.decodeFromConstraints(
        constraints,
        videoRef.current,
        async (scanResult, scanError) => {
          if (scanResult) {
            const text = scanResult.getText();
            stopScan();
            await submitToken(text);
            return;
          }

          if (scanError && !(scanError instanceof NotFoundException)) {
            // NotFoundException is the normal "no QR in frame" case.
            setError("Camera scan error");
          }
        }
      );

      controlsRef.current = controls;
      setScanning(true);
    } catch (e) {
      setError(
        e?.message ||
          "Could not access camera. Use HTTPS (or localhost) and allow camera permissions."
      );
      stopScan();
    }
  }, [scanning, stopScan, submitToken]);

  const statusPill = useMemo(() => {
    if (verifying) return { label: "Verifying...", cls: "bg-indigo-500/10 text-indigo-200 border border-indigo-400/20" };
    if (scanning)  return { label: "Scanning...",  cls: "bg-green-500/10  text-green-200  border border-green-400/20"  };
    return               { label: "Idle",          cls: "bg-white/10      text-white/70   border border-white/10"       };
  }, [scanning, verifying]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className={`text-2xl font-bold ${strongText}`}>Ticket Scanner</h2>
          <p className={`${mutedText} mt-1`}>Scan the attendee QR to mark the ticket as used.</p>
        </div>
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusPill.cls}`}>
          {statusPill.label}
        </span>
      </div>

      {/* Camera Panel */}
      <div className={`${glassPanel} overflow-hidden`}>
        <div className={`px-6 py-4 ${panelHeader} flex items-center justify-between gap-3 flex-wrap`}>
          <div>
            <div className={`font-semibold ${strongText}`}>Camera</div>
            <div className={`text-xs ${mutedText}`}>Point the camera at the QR code on the attendee screen.</div>
          </div>
          <div className="flex gap-2">
            {!scanning ? (
              <button
                onClick={startScan}
                disabled={verifying}
                className="px-4 py-2 text-sm font-medium bg-white/10 border border-white/10 rounded-lg hover:bg-white/20 transition-colors text-white/80 disabled:opacity-60"
              >
                Start Scan
              </button>
            ) : (
              <button
                onClick={stopScan}
                className="px-4 py-2 text-sm font-medium bg-red-500/10 text-red-200 border border-red-400/20 rounded-lg hover:bg-red-500/15 transition-colors"
              >
                Stop
              </button>
            )}
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Video Feed */}
            <div>
              <div className="rounded-xl overflow-hidden border border-white/10 bg-white/5">
                <video
                  ref={videoRef}
                  className="w-full h-[320px] object-cover"
                  muted
                  playsInline
                  autoPlay
                />
              </div>
              <div className={`mt-3 text-xs ${mutedText}`}>
                If camera permissions are blocked, use manual paste below.
              </div>
            </div>

            {/* Manual Entry */}
            <div className="space-y-4">
              <div className="space-y-2">
                <div className={`text-sm font-medium ${strongText}`}>Manual QR token</div>
                <textarea
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  rows={5}
                  placeholder="Paste the QR token text here"
                  className={`w-full px-3 py-2 text-sm rounded-lg ${glassInput}`}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => submitToken(manualToken)}
                    disabled={verifying}
                    className="px-4 py-2 text-sm font-medium bg-[#FFA500] text-white rounded-lg hover:bg-[#e69500] transition-colors disabled:opacity-60"
                  >
                    Verify
                  </button>
                  <button
                    onClick={() => setManualToken("")}
                    className="px-4 py-2 text-sm font-medium bg-white/10 border border-white/10 rounded-lg hover:bg-white/20 transition-colors text-white/80"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="px-4 py-3 rounded-lg bg-red-500/10 text-red-200 border border-red-400/20 text-sm">
                  {error}
                </div>
              )}

              {/* Result */}
              {result?.ticket && (
                <div className="px-4 py-4 rounded-xl bg-white/10 border border-white/10">
                  <div className={`text-sm font-semibold ${strongText}`}>
                    {result?.message || (result?.success ? "✅ Accepted" : "Result")}
                  </div>
                  <div className={`mt-2 text-xs ${mutedText} space-y-1`}>
                    <div><span className="font-semibold text-white/80">Ticket:</span> {result.ticket.ticketId}</div>
                    <div><span className="font-semibold text-white/80">Status:</span> {result.ticket.status}</div>
                    <div><span className="font-semibold text-white/80">Event:</span> {String(result.ticket.eventId || "—")}</div>
                    <div><span className="font-semibold text-white/80">User:</span> {String(result.ticket.userId || "—")}</div>
                    <div>
                      <span className="font-semibold text-white/80">Redeemed At:</span>{" "}
                      {result.ticket.redeemedAt ? new Date(result.ticket.redeemedAt).toLocaleString() : "—"}
                    </div>
                  </div>
                </div>
              )}

              {/* Last Token */}
              {lastToken && (
                <div className={`text-xs ${mutedText} break-all`}>
                  <span className="font-semibold text-white/80">Last token:</span> {lastToken}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}