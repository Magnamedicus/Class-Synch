import React, { useState, useEffect, useRef } from "react";
import "../../css/EnterClasses.css";
import { importScheduleFromFile, type ParsedClass } from "../../utils/scheduleImport";
import { readAnswers, writeAnswers } from "../../utils/qaStorage";
import Modal from "../Modal";

interface EnterClassesProps {
    value: string[];
    onChange: (newClasses: string[]) => void;
}

const EnterClasses: React.FC<EnterClassesProps> = ({ value, onChange }) => {
    const [input, setInput] = useState("");
    const [open, setOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [importStatus, setImportStatus] = useState<string | null>(null);
    const [showPreview, setShowPreview] = useState(false);
    const [previewItems, setPreviewItems] = useState<ParsedClass[]>([]);
    const [toast, setToast] = useState<string | null>(null);
    const [isDragOver, setIsDragOver] = useState(false);

    async function importFile(file: File) {
        setImportStatus("Parsing…");
        try {
            const { imported, parsed, errors } = await importScheduleFromFile(file);
            const currentUserRaw = localStorage.getItem("currentUser");
            let classes: string[] = value;
            if (currentUserRaw) {
                const { email } = JSON.parse(currentUserRaw || "{}");
                if (email) {
                    const ans = readAnswers(email);
                    if (Array.isArray(ans?.["school_classes"])) {
                        classes = ans["school_classes"];
                    }
                }
            }
            onChange(classes);
            if (imported > 0) {
                setImportStatus(`Imported ${imported} class${imported === 1 ? "" : "es"}.`);
                setPreviewItems(parsed);
                setShowPreview(true);
                setToast("Upload Successful!");
                setTimeout(() => setToast(null), 2500);
                const patch: Record<string, any> = {};
                for (const c of parsed) {
                    const slug = c.code.toLowerCase();
                    const id = `class_${slug}`;
                    patch[`${id}_meeting_days`] = c.days;
                    patch[`${id}_meeting_time`] = { start: c.start, end: c.end };
                }
                window.dispatchEvent(new CustomEvent("qa:merge-answers", { detail: { patch } }));
            } else {
                setImportStatus(errors?.length ? `No classes imported. ${errors.join("; ")}` : "No classes found in file.");
            }
        } catch (err: any) {
            setImportStatus(`Import failed: ${err?.message || String(err)}`);
        } finally {
            setTimeout(() => setImportStatus(null), 4000);
        }
    }

    const handleAdd = () => {
        if (input.trim() !== "") {
            onChange([...value, input.trim()]);
            setInput("");
        }
    };

    const handleRemove = (cls: string) => {
        onChange(value.filter((c) => c !== cls));
    };

    // ✅ Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        // Prevent browser from opening files when dropped outside the zone
        const prevent = (e: DragEvent) => { e.preventDefault(); e.stopPropagation(); };
        window.addEventListener("dragover", prevent as any);
        window.addEventListener("drop", prevent as any);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            window.removeEventListener("dragover", prevent as any);
            window.removeEventListener("drop", prevent as any);
        };
    }, []);

    return (
        <div className="enter-classes-container">
            <h3 className="option-header">Option 1: Enter Classes Manually</h3>
            <div className="input-row">
                <input
                    type="text"
                    placeholder="Type a class name..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    className="class-input"
                />
                <button onClick={handleAdd} className="add-btn">+ Add</button>
            </div>

            {/* Dropdown */}
            <div className="dropdown-wrapper" ref={dropdownRef}>
                <button
                    type="button"
                    className="dropdown-toggle"
                    onClick={() => setOpen((prev) => !prev)}
                >
                    {value.length} Classes Added ▾
                </button>

                {open && (
                    <ul className="dropdown-list">
                        {value.map((cls, i) => (
                            <li key={i} className="dropdown-item">
                                {cls}
                                <button
                                    type="button"
                                    className="remove-btn-small"
                                    onClick={() => handleRemove(cls)}
                                >
                                    ✕
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <h3 className="option-header">Option 2: Upload Your Schedule</h3>
            <form className="file-upload-form">
                <label
                    htmlFor="file"
                    className={`file-upload-label ${isDragOver ? "is-dragover" : ""}`}
                    onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); }}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); }}
                    onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(false); }}
                    onDrop={async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsDragOver(false);
                        const dt = e.dataTransfer;
                        if (!dt) return;
                        const files = dt.files;
                        if (files && files.length > 0) {
                            await importFile(files[0]);
                        }
                    }}
                >
                    <div className="file-upload-design">
                        <svg viewBox="0 0 640 512" height="2.5em">
                            <path d="M144 480C64.5 480 0 415.5 0 336c0-62.8 40.2-116.2
                96.2-135.9c-.1-2.7-.2-5.4-.2-8.1c0-88.4 71.6-160
                160-160c59.3 0 111 32.2 138.7 80.2C409.9 102
                428.3 96 448 96c53 0 96 43 96 96c0 12.2-2.3
                23.8-6.4 34.6C596 238.4 640 290.1 640 352c0
                70.7-57.3 128-128 128H144zm79-217c-9.4 9.4-9.4
                24.6 0 33.9s24.6 9.4 33.9 0l39-39V392c0 13.3
                10.7 24 24 24s24-10.7 24-24V257.9l39 39c9.4
                9.4 24.6 9.4 33.9 0s9.4-24.6 0-33.9l-80-80c-9.4
                -9.4-24.6-9.4-33.9 0l-80 80z"/>
                        </svg>
                        <p>Drag & Drop</p>
                        <span className="browse-button">Browse File</span>
                    </div>
                    <input
                        id="file"
                        type="file"
                        accept=".ics,.csv,text/csv,text/calendar"
                        onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            await importFile(file);
                            (e.currentTarget as HTMLInputElement).value = "";
                        }}
                    />
                </label>
            </form>
            {importStatus && (
                <div className="import-status" role="status" aria-live="polite">{importStatus}</div>
            )}
            {toast && (
                <div className="toast toast--success">{toast}</div>
            )}
            <div style={{ display: "flex", gap: "0.75rem" }}>
                <button
                    type="button"
                    className="danger-btn"
                    onClick={() => {
                        if (!window.confirm("Remove all classes and related settings? This cannot be undone.")) return;
                        try {
                            const currentUserRaw = localStorage.getItem("currentUser");
                            const { email } = currentUserRaw ? JSON.parse(currentUserRaw) : {};
                            if (email) {
                                const ans = readAnswers(email);
                                const list = Array.isArray(ans?.["school_classes"]) ? (ans["school_classes"] as string[]) : value;
                                const patch: Record<string, any> = { school_classes: [] };
                                // Remove known per-class fields
                                const keys = new Set<string>();
                                for (const cls of list) {
                                    const slug = cls.toLowerCase();
                                    const base = `class_${slug}`;
                                    ["meeting_days","meeting_time","priority","study_hours","pref_times"].forEach((suf) => {
                                        keys.add(`${base}_${suf}`);
                                    });
                                }
                                // Also sweep any stray class_* keys
                                Object.keys(ans || {}).forEach((k) => {
                                    if (/^class_[a-z0-9-]+_(meeting_days|meeting_time|priority|study_hours|pref_times)$/.test(k)) {
                                        keys.add(k);
                                    }
                                });
                                keys.forEach((k) => (patch[k] = undefined));
                                // Persist and notify
                                writeAnswers(email, { ...ans, ...patch });
                                window.dispatchEvent(new CustomEvent("qa:merge-answers", { detail: { patch } }));
                            }
                        } catch {}
                        onChange([]);
                        setOpen(false);
                    }}
                >
                    Clear All Classes
                </button>
            </div>
            <Modal isOpen={showPreview} onClose={() => setShowPreview(false)}>
                <div style={{ minWidth: 360 }}>
                    <h3 style={{ marginTop: 0 }}>Imported Classes</h3>
                    {previewItems.length === 0 ? (
                        <p>No classes parsed.</p>
                    ) : (
                        <ul style={{ listStyle: "none", padding: 0, margin: 0, maxHeight: 300, overflowY: "auto" }}>
                            {previewItems.map((c, idx) => (
                                <li key={idx} style={{ padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                                    <div style={{ fontWeight: 600 }}>{c.code}</div>
                                    <div style={{ opacity: 0.85 }}>
                                        {c.days.join(", ")} • {c.start} – {c.end}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                    <div style={{ marginTop: 16, textAlign: "right" }}>
                        <button type="button" onClick={() => setShowPreview(false)} className="add-btn">Close</button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default EnterClasses;
